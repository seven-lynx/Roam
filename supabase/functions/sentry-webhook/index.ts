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
  buildRegressionComment,
  buildTitle,
  decideAction,
  exceptionValues,
  formatFrame,
  normalize,
  regressionMarker,
  releaseVersion,
  searchQuery,
  shouldComment,
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
      const action = decideAction(existing, issue)

      if (action === 'reopen') {
        await reopen(existing.number, issue)
        return json({ ok: true, reopened: true, number: existing.number }, 200)
      }
      if (action === 'comment') {
        // A regression of a still-open error. Reporting it on the thread is the
        // whole point: without this the webhook acknowledged and dropped every
        // occurrence after the first one filed the issue (#101).
        const posted = await commentRegression(existing.number, issue)
        return posted
          ? json({ ok: true, commented: true, number: existing.number }, 200)
          : json(
            { ok: true, skipped: true, reason: 'duplicate_regression', number: existing.number },
            200,
          )
      }
      return json({ ok: true, skipped: true, reason: 'already_open', number: existing.number }, 200)
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

    // The regression-comment marker keys off this: it is what tells a Sentry retry
    // of the same webhook apart from a genuinely new occurrence.
    issue.eventID = asString(ev['eventID']) ?? asString(ev['event_id'])

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
  const q = encodeURIComponent(searchQuery(GITHUB_REPO, sentryIssueId))
  // `sort=created&order=asc` is not cosmetic: GitHub scores search results itself,
  // and two hits for the same group came back tied at 1.0 in *different* orders a
  // few hours apart. `items[0]` is only a usable dedupe key if the order is pinned.
  const res = await gh(`/search/issues?q=${q}&sort=created&order=asc&per_page=5`)
  if (!res.ok) {
    // A failing search is not "no match". Returning null here used to send the
    // caller straight to createIssue, filing the same group a second time — and the
    // search API carries its own, far smaller quota, so a regression storm is
    // exactly when it trips. Throw instead: the handler answers 502 and Sentry
    // retries rather than the repo growing a duplicate.
    throw new Error(
      `GitHub search failed: HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`,
    )
  }

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
  let labelled = true
  if (res.status === 422) {
    // Labels may not exist on the repo yet; retry without them.
    labelled = false
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

  if (!labelled) {
    // The dedupe query is scoped to `label:sentry`, so an issue filed without the
    // label is invisible to it and the group gets filed again next time. The title
    // prefix still catches that case, but restore the label where we can.
    const patched = await gh(`/repos/${GITHUB_REPO}/issues/${number}`, {
      method: 'PATCH',
      body: JSON.stringify({ labels }),
    })
    if (!patched.ok) {
      console.warn(
        'sentry-webhook: filed without the sentry label; dedupe relies on the title prefix',
        number,
        patched.status,
      )
    }
  }

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

  const comment = await gh(`/repos/${GITHUB_REPO}/issues/${number}/comments`, {
    method: 'POST',
    body: JSON.stringify({
      body: `Sentry reports this error has regressed (level \`${issue.level}\`). Reopened automatically.`,
    }),
  })
  if (!comment.ok) {
    // The reopen itself landed, so answering 502 costs nothing: Sentry retries, the
    // retry finds the issue open and takes the regression-comment path instead,
    // which recovers the note. Swallowing it left the issue reopened and mute.
    throw new Error(
      `GitHub reopen comment failed: HTTP ${comment.status}: ${(await comment.text()).slice(0, 400)}`,
    )
  }
}

/**
 * Records a regression on an issue that is already open. Returns whether a comment
 * was actually written — a Sentry retry of the same event, or a group flapping
 * inside the cooldown, is acknowledged without touching the thread.
 */
async function commentRegression(number: number, issue: NormalizedIssue): Promise<boolean> {
  const marker = regressionMarker(issue)

  const lastRes = await gh(
    `/repos/${GITHUB_REPO}/issues/${number}/comments?per_page=1&sort=created&direction=desc`,
  )
  if (!lastRes.ok) {
    throw new Error(
      `GitHub comment lookup failed: HTTP ${lastRes.status}: ${(await lastRes.text()).slice(0, 400)}`,
    )
  }

  const newest = asObject(asArray(await lastRes.json())[0])
  const last = newest
    ? { body: asString(newest['body']) ?? '', createdAt: asString(newest['created_at']) }
    : null
  if (!shouldComment(last, marker, Date.now())) return false

  // The id matters: it is the only record of which event the note describes, and
  // Sentry's own issue page is the thing being replaced here.
  const res = await gh(`/repos/${GITHUB_REPO}/issues/${number}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body: buildRegressionComment(issue) }),
  })
  if (!res.ok) {
    throw new Error(
      `GitHub regression comment failed: HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`,
    )
  }
  return true
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
