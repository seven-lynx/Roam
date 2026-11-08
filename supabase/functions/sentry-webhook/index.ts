// POST /functions/v1/sentry-webhook
//
// Receives Sentry webhooks and mirrors new/regressed errors as GitHub issues in
// the Roam repo. Deterministic plumbing — no model calls, no decision-making.
//
// Two Sentry payload shapes are handled:
//   1. Issue webhooks       (Sentry-Hook-Resource: issue)       → data.issue
//   2. Issue-alert webhooks (Sentry-Hook-Resource: event_alert) → data.event
//
// The function is deployed with verify_jwt=false (public), so it is protected
// by a shared secret instead: SENTRY_WEBHOOK_SECRET. Sentry sends it as either
// the `x-sentry-webhook-secret` header or the `secret` query parameter.
//
// Payload normalisation and the issue body builders live in `normalize.ts` so
// they can be unit tested without this module's import-time env validation.
import { corsHeaders } from '../_shared/cors.ts'
import { validateRequired } from '../_shared/env.ts'
import { initSentry } from '../_shared/sentry.ts'
import {
  asArray,
  asNumber,
  asObject,
  asString,
  buildBody,
  buildTitle,
  exceptionValues,
  formatFrame,
  normalize,
  releaseVersion,
  stackFrames,
  tagsToObject,
  timingSafeEqual,
  type NormalizedIssue,
} from './normalize.ts'

const env = validateRequired(['SENTRY_WEBHOOK_SECRET', 'GITHUB_PAT'])
const report = initSentry('sentry-webhook')

const GITHUB_API = 'https://api.github.com'
const GITHUB_REPO = Deno.env.get('GITHUB_REPO') ?? 'seven-lynx/Roam'
// Optional. When set, issue webhooks are enriched with the latest event's stack
// trace via Sentry's REST API (issue-alert webhooks already carry it inline).
const SENTRY_AUTH_TOKEN = Deno.env.get('SENTRY_AUTH_TOKEN')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const secret =
    req.headers.get('x-sentry-webhook-secret') ??
    new URL(req.url).searchParams.get('secret')
  if (!secret || !timingSafeEqual(secret, env.SENTRY_WEBHOOK_SECRET)) {
    return json({ error: 'unauthorized' }, 401)
  }

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const issue = normalize(payload)
  if (!issue) {
    // Resolved/assigned/archived or unrecognised — acknowledge so Sentry does
    // not keep retrying a payload we intentionally ignore.
    return json({ ok: true, skipped: true, reason: 'ignored' }, 200)
  }

  try {
    await enrich(issue)

    const existing = await findExisting(issue.sentryIssueId)
    if (existing) {
      if (existing.state === 'open') {
        return json({ ok: true, skipped: true, reason: 'already_open', number: existing.number }, 200)
      }
      await reopen(existing.number, issue)
      return json({ ok: true, reopened: true, number: existing.number }, 200)
    }

    const created = await createIssue(issue)
    return json({ ok: true, created: true, number: created.number }, 200)
  } catch (e) {
    await report(e, 'error', { sentry_issue_id: issue.sentryIssueId })
    return json({ ok: false, error: 'github_failure' }, 502)
  }
})

// ── Optional stack-trace enrichment ─────────────────────────────────────────

async function enrich(issue: NormalizedIssue): Promise<void> {
  if (issue.stackFrames.length > 0) return
  if (!SENTRY_AUTH_TOKEN) {
    // Silent before this: an issue filed without a stack trace looked identical
    // to a Sentry event that simply carried none, and ROAM-EXTENSION-M's body
    // gave no clue that enrichment was off. Say it out loud instead.
    console.warn(
      'sentry-webhook: SENTRY_AUTH_TOKEN unset — filing without a stack trace',
      issue.sentryIssueId,
    )
    return
  }

  const base = sentryApiBase(issue.url)
  if (!base) {
    // The third silent exit. No parseable permalink means there is no API host to
    // ask, so the issue is filed body-only — say it, for the same reason as above.
    console.warn(
      'sentry-webhook: cannot derive the Sentry API base — filing without a stack trace',
      issue.sentryIssueId,
    )
    return
  }

  try {
    const res = await fetch(`${base}/issues/${issue.sentryIssueId}/events/latest/`, {
      headers: { Authorization: `Bearer ${SENTRY_AUTH_TOKEN}` },
    })
    if (!res.ok) {
      // Same silence problem on the other exit: an expired token (401) used to
      // look exactly like an event that carried no frames.
      console.warn('sentry-webhook: enrichment fetch failed', res.status)
      return
    }

    const ev = asObject(await res.json())
    if (!ev) return

    const values = exceptionValues(ev)
    const frames = values.flatMap((v) => stackFrames(v))
    if (frames.length > 0) issue.stackFrames = frames.map(formatFrame)

    const md = asObject(ev['metadata'])
    if (!issue.exceptionType) {
      issue.exceptionType = asString(values[0]?.['type']) ?? asString(md?.['type'])
    }
    if (!issue.message || issue.message === issue.title) {
      issue.message = asString(md?.['value']) ?? asString(values[0]?.['value']) ?? issue.message
    }
    if (Object.keys(issue.tags).length === 0) issue.tags = tagsToObject(ev['tags'])
    if (!issue.release) issue.release = releaseVersion(ev['release'])
  } catch (e) {
    // Enrichment is best-effort; never block issue creation on it.
    console.warn('sentry-webhook: enrichment failed', e)
  }
}

function sentryApiBase(url: string): string | null {
  if (!url) return null
  try {
    return `${new URL(url).origin}/api/0`
  } catch {
    return null
  }
}

// ── GitHub plumbing ─────────────────────────────────────────────────────────

async function gh(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'roam-sentry-webhook',
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}

async function findExisting(sentryIssueId: string): Promise<{ number: number; state: string } | null> {
  const q = encodeURIComponent(`repo:${GITHUB_REPO} type:issue in:body "sentry-issue:${sentryIssueId}"`)
  const res = await gh(`/search/issues?q=${q}&per_page=1`)
  if (!res.ok) return null

  const data = asObject(await res.json())
  const item = asObject(asArray(data?.['items'])[0])
  if (!item) return null

  const number = asNumber(item['number'])
  if (number == null) return null
  return { number, state: asString(item['state']) ?? 'open' }
}

async function createIssue(issue: NormalizedIssue): Promise<{ number: number }> {
  const title = buildTitle(issue)
  const body = buildBody(issue)
  const labels = ['sentry', 'bug']

  let res = await gh(`/repos/${GITHUB_REPO}/issues`, {
    method: 'POST',
    body: JSON.stringify({ title, body, labels }),
  })
  if (res.status === 422) {
    // Labels may not exist on the repo yet; retry without them.
    res = await gh(`/repos/${GITHUB_REPO}/issues`, {
      method: 'POST',
      body: JSON.stringify({ title, body }),
    })
  }
  if (!res.ok) {
    throw new Error(`GitHub create issue failed: HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`)
  }

  const data = asObject(await res.json())
  const number = data ? asNumber(data['number']) : null
  if (number == null) throw new Error('GitHub create issue returned no issue number')
  return { number }
}

async function reopen(number: number, issue: NormalizedIssue): Promise<void> {
  const stateRes = await gh(`/repos/${GITHUB_REPO}/issues/${number}`, {
    method: 'PATCH',
    body: JSON.stringify({ state: 'open' }),
  })
  if (!stateRes.ok) {
    throw new Error(`GitHub reopen failed: HTTP ${stateRes.status}: ${(await stateRes.text()).slice(0, 400)}`)
  }

  await gh(`/repos/${GITHUB_REPO}/issues/${number}/comments`, {
    method: 'POST',
    body: JSON.stringify({
      body: `Sentry reports this error has regressed (level \`${issue.level}\`). Reopened automatically.`,
    }),
  })
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
