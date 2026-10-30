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
import { corsHeaders } from '../_shared/cors.ts'
import { validateRequired } from '../_shared/env.ts'
import { initSentry } from '../_shared/sentry.ts'

const env = validateRequired(['SENTRY_WEBHOOK_SECRET', 'GITHUB_PAT'])
const report = initSentry('sentry-webhook')

const GITHUB_API = 'https://api.github.com'
const GITHUB_REPO = Deno.env.get('GITHUB_REPO') ?? 'seven-lynx/Roam'
// Optional. When set, issue webhooks are enriched with the latest event's stack
// trace via Sentry's REST API (issue-alert webhooks already carry it inline).
const SENTRY_AUTH_TOKEN = Deno.env.get('SENTRY_AUTH_TOKEN')

interface NormalizedIssue {
  sentryIssueId: string
  title: string
  level: string
  platform: string
  projectSlug: string
  culprit: string | null
  message: string
  exceptionType: string | null
  stackFrames: string[]
  tags: Record<string, string>
  release: string | null
  url: string
  firstSeen: string | null
  lastSeen: string | null
  count: string | null
  userCount: number | null
  substatus: string | null
  triggeredRule: string | null
}

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

// ── Payload normalisation ────────────────────────────────────────────────────

type JsonObject = Record<string, unknown>

function asObject(v: unknown): JsonObject | null {
  return typeof v === 'object' && v !== null ? (v as JsonObject) : null
}

function asString(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

function asNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function normalize(payload: unknown): NormalizedIssue | null {
  const root = asObject(payload)
  const data = asObject(root?.['data'])
  if (!root || !data) return null

  const issueObj = asObject(data['issue'])
  if (issueObj) return normalizeIssueWebhook(root, issueObj)

  const eventObj = asObject(data['event'])
  if (eventObj) return normalizeEventAlert(data, eventObj)

  return null
}

function normalizeIssueWebhook(root: JsonObject, issue: JsonObject): NormalizedIssue | null {
  const action = asString(root['action'])
  const substatus = asString(issue['substatus'])
  const isNew = action === 'created'
  const isRegression =
    action === 'unresolved' && (substatus === 'regressed' || substatus === 'escalating')
  if (!isNew && !isRegression) return null

  const metadata = asObject(issue['metadata'])
  const project = asObject(issue['project'])

  return {
    sentryIssueId: issue['id'] != null ? String(issue['id']) : '',
    title: asString(issue['title']) ?? 'Untitled Sentry issue',
    level: asString(issue['level']) ?? 'error',
    platform: asString(issue['platform']) ?? '',
    projectSlug: asString(project?.['slug']) ?? '',
    culprit: asString(issue['culprit']),
    message: asString(metadata?.['value']) ?? asString(issue['title']) ?? '',
    exceptionType: asString(metadata?.['type']),
    stackFrames: [],
    tags: {},
    release: null,
    url: asString(issue['web_url']) ?? asString(issue['permalink']) ?? '',
    firstSeen: asString(issue['firstSeen']),
    lastSeen: asString(issue['lastSeen']),
    count: issue['count'] != null ? String(issue['count']) : null,
    userCount: asNumber(issue['userCount']),
    substatus,
    triggeredRule: null,
  }
}

function normalizeEventAlert(data: JsonObject, event: JsonObject): NormalizedIssue | null {
  const sentryIssueId = event['issue_id'] != null ? String(event['issue_id']) : ''
  if (!sentryIssueId) return null // metric alerts etc. — not our concern

  const values = exceptionValues(event)
  const frames = values.flatMap((v) => stackFrames(v))
  const first = values[0]

  return {
    sentryIssueId,
    title: asString(event['title']) ?? asString(first?.['value']) ?? 'Untitled Sentry issue',
    level: asString(event['level']) ?? 'error',
    platform: asString(event['platform']) ?? '',
    projectSlug: extractProjectSlug(asString(event['url'])),
    culprit: asString(event['culprit']),
    message: asString(metadata(event)?.['value']) ?? asString(first?.['value']) ?? asString(event['title']) ?? '',
    exceptionType: asString(metadata(event)?.['type']) ?? asString(first?.['type']),
    stackFrames: frames.map(formatFrame),
    tags: tagsToObject(event['tags']),
    release: asString(event['release']),
    url: asString(event['web_url']) ?? asString(event['issue_url']) ?? '',
    firstSeen: null,
    lastSeen: null,
    count: null,
    userCount: null,
    substatus: null,
    triggeredRule: asString(data['triggered_rule']),
  }
}

function metadata(event: JsonObject): JsonObject | null {
  return asObject(event['metadata'])
}

function exceptionValues(event: JsonObject): JsonObject[] {
  const exception = asObject(event['exception'])
  return asArray(exception?.['values'])
    .map((v) => asObject(v))
    .filter((v): v is JsonObject => v !== null)
}

function stackFrames(value: JsonObject): JsonObject[] {
  const stacktrace = asObject(value['stacktrace'])
  return asArray(stacktrace?.['frames'])
    .map((f) => asObject(f))
    .filter((f): f is JsonObject => f !== null)
}

function formatFrame(f: JsonObject): string {
  const fn = asString(f['function']) ?? asString(f['raw_function'])
  const file = asString(f['filename']) ?? asString(f['abs_path'])
  const line = f['lineno'] != null ? `:${String(f['lineno'])}` : ''
  const parts: string[] = []
  if (file) parts.push(`${file}${line}`)
  if (fn) parts.push(`in ${fn}`)
  if (!f['in_app']) parts.push('[external]')
  return parts.join(' ')
}

function tagsToObject(tags: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  for (const t of asArray(tags)) {
    const pair = asArray(t)
    if (pair.length >= 2) out[String(pair[0])] = String(pair[1])
  }
  return out
}

function extractProjectSlug(url: string | null): string {
  if (!url) return ''
  const m = /\/projects\/[^/]+\/([^/]+)\//.exec(url)
  return m ? m[1] : ''
}

// ── Optional stack-trace enrichment ─────────────────────────────────────────

async function enrich(issue: NormalizedIssue): Promise<void> {
  if (issue.stackFrames.length > 0 || !SENTRY_AUTH_TOKEN) return

  const base = sentryApiBase(issue.url)
  if (!base) return

  try {
    const res = await fetch(`${base}/issues/${issue.sentryIssueId}/events/latest/`, {
      headers: { Authorization: `Bearer ${SENTRY_AUTH_TOKEN}` },
    })
    if (!res.ok) return

    const ev = asObject(await res.json())
    if (!ev) return

    const values = exceptionValues(ev)
    const frames = values.flatMap((v) => stackFrames(v))
    if (frames.length > 0) issue.stackFrames = frames.map(formatFrame)

    const md = metadata(ev)
    if (!issue.exceptionType) {
      issue.exceptionType = asString(values[0]?.['type']) ?? asString(md?.['type'])
    }
    if (!issue.message || issue.message === issue.title) {
      issue.message = asString(md?.['value']) ?? asString(values[0]?.['value']) ?? issue.message
    }
    if (Object.keys(issue.tags).length === 0) issue.tags = tagsToObject(ev['tags'])
    if (!issue.release) issue.release = asString(ev['release'])
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

// ── Markdown builders ───────────────────────────────────────────────────────

function buildTitle(issue: NormalizedIssue): string {
  const project = issue.projectSlug ? `${issue.projectSlug}: ` : ''
  const base = issue.title || issue.message || 'Sentry error'
  return `[Sentry] ${project}${truncate(base, 180)}`
}

function buildBody(issue: NormalizedIssue): string {
  const rows = [
    ['Level', `\`${issue.level}\``],
    ['Platform', issue.platform || '—'],
    ['Project', issue.projectSlug || '—'],
    ['Release', issue.release ? `\`${issue.release}\`` : '—'],
    ['First seen', issue.firstSeen ?? '—'],
    ['Last seen', issue.lastSeen ?? '—'],
    ['Events', issue.count ?? '—'],
    ['Affected users', issue.userCount != null ? String(issue.userCount) : '—'],
    ['Status', issue.substatus ?? issue.triggeredRule ?? '—'],
  ]
    .map(([k, v]) => `| ${k} | ${v} |`)
    .join('\n')

  const parts = [
    `<!-- sentry-issue:${issue.sentryIssueId} -->`,
    'New or regressed error reported by Sentry.',
    '',
    '| Field | Value |',
    '| --- | --- |',
    rows,
  ]

  if (issue.message) parts.push('', '### Message', '', '```', issue.message, '```')
  if (issue.culprit) parts.push('', '### Culprit', '', '```', issue.culprit, '```')
  if (issue.stackFrames.length > 0) {
    parts.push('', '### Stack trace', '', '```', issue.stackFrames.slice(0, 25).join('\n'), '```')
  }
  if (Object.keys(issue.tags).length > 0) {
    const tagRows = Object.entries(issue.tags)
      .map(([k, v]) => `| \`${k}\` | ${v} |`)
      .join('\n')
    parts.push('', '### Tags', '', '| Key | Value |', '| --- | --- |', tagRows)
  }
  if (issue.url) parts.push('', `[View in Sentry](${issue.url})`)

  return parts.join('\n')
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a)
  const bBytes = new TextEncoder().encode(b)
  if (aBytes.length !== bBytes.length) return false
  let diff = 0
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i]
  return diff === 0
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
