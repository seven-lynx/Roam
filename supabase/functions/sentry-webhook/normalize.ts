// Pure payload + markdown helpers for the Sentry → GitHub issue bridge.
//
// Everything in this module is side-effect free and has no imports, so it can
// be unit tested without the function's import-time environment validation or
// `Deno.serve` registration (`index.ts` does both at module scope). The HTTP
// plumbing — env, Sentry enrichment, GitHub calls — stays in `index.ts`.

export type JsonObject = Record<string, unknown>

export interface NormalizedIssue {
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
  /**
   * True only for an `unresolved` issue webhook whose substatus is regressed or
   * escalating. Distinguishes a genuine return of a tracked error from Sentry
   * re-delivering the `created` webhook for a group we already know about, which
   * decides whether an open tracking issue gets a comment or nothing at all.
   */
  isRegression: boolean
  /** The latest event id, when the payload or the enrichment fetch carried one. */
  eventID: string | null
}

export function asObject(v: unknown): JsonObject | null {
  return typeof v === 'object' && v !== null ? (v as JsonObject) : null
}

export function asString(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

export function asNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

/**
 * Dispatch on the webhook resource and return the fields the GitHub issue
 * needs, or `null` for payloads we intentionally ignore (resolved, assigned,
 * archived, metric alerts, unrecognised shapes).
 */
export function normalize(payload: unknown): NormalizedIssue | null {
  const root = asObject(payload)
  const data = asObject(root?.['data'])
  if (!root || !data) return null

  const issueObj = asObject(data['issue'])
  if (issueObj) return normalizeIssueWebhook(root, issueObj)

  const eventObj = asObject(data['event'])
  if (eventObj) return normalizeEventAlert(data, eventObj)

  return null
}

export function normalizeIssueWebhook(root: JsonObject, issue: JsonObject): NormalizedIssue | null {
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
    isRegression,
    // Issue webhooks carry `lastSeen` but no event id; enrichment adds one.
    eventID: null,
  }
}

export function normalizeEventAlert(data: JsonObject, event: JsonObject): NormalizedIssue | null {
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
    release: releaseVersion(event['release']),
    url: asString(event['web_url']) ?? asString(event['issue_url']) ?? '',
    firstSeen: null,
    lastSeen: null,
    count: null,
    userCount: null,
    substatus: null,
    triggeredRule: asString(data['triggered_rule']),
    // An alert says "this event tripped a rule", not "a resolved error came
    // back" — it must not be reported as a regression on an open issue.
    isRegression: false,
    eventID: asString(event['event_id']) ?? asString(event['eventID']),
  }
}

function metadata(event: JsonObject): JsonObject | null {
  return asObject(event['metadata'])
}

/**
 * Exceptions arrive in two different shapes and both have to parse:
 *
 * - webhook payloads carry the exception inline at the top level (`exception.values`);
 * - the REST `…/events/latest/` response that `enrich()` fetches has **no** top-level
 *   `exception` at all — it nests the same data under `entries[]` as
 *   `{ type: 'exception', data: { values } }`.
 *
 * Reading only the top-level key is why every enriched issue filed from 2026-11-07
 * onwards arrived with no `### Stack trace` section even though the token was valid
 * and the fetch succeeded (issue #93).
 */
export function exceptionValues(event: JsonObject): JsonObject[] {
  const inline = asObject(event['exception'])
  const entry = asArray(event['entries'])
    .map((e) => asObject(e))
    .find((e) => e?.['type'] === 'exception')

  const values = asArray(inline?.['values']).length > 0
    ? inline?.['values']
    : asObject(entry?.['data'])?.['values']

  return asArray(values)
    .map((v) => asObject(v))
    .filter((v): v is JsonObject => v !== null)
}

export function stackFrames(value: JsonObject): JsonObject[] {
  const stacktrace = asObject(value['stacktrace'])
  return asArray(stacktrace?.['frames'])
    .map((f) => asObject(f))
    .filter((f): f is JsonObject => f !== null)
}

export function formatFrame(f: JsonObject): string {
  const fn = asString(f['function']) ?? asString(f['raw_function'])
  const file = asString(f['filename']) ?? asString(f['abs_path'])
  const line = f['lineno'] != null ? `:${String(f['lineno'])}` : ''
  const parts: string[] = []
  if (file) parts.push(`${file}${line}`)
  if (fn) parts.push(`in ${fn}`)
  if (!f['in_app']) parts.push('[external]')
  return parts.join(' ')
}

/**
 * `release` is a bare string in webhook payloads but an object (`{ version }`) in the
 * events API, where `asString` alone yields null — leaving the body's `Release` row
 * empty on every enriched issue.
 */
export function releaseVersion(value: unknown): string | null {
  return asString(value) ?? asString(asObject(value)?.['version'])
}

export function tagsToObject(tags: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  for (const t of asArray(tags)) {
    // Issue and alert webhooks send [key, value] pairs…
    const pair = asArray(t)
    if (pair.length >= 2) {
      out[String(pair[0])] = String(pair[1])
      continue
    }
    // …while the events API the enrichment step fetches returns { key, value }.
    const obj = asObject(t)
    if (obj && obj['key'] != null) out[String(obj['key'])] = String(obj['value'] ?? '')
  }
  return out
}

export function extractProjectSlug(url: string | null): string {
  if (!url) return ''
  const m = /\/projects\/[^/]+\/([^/]+)\//.exec(url)
  return m ? m[1] : ''
}

// ── Redaction ───────────────────────────────────────────────────────────────

/**
 * Credentials and PII are stripped before any string can reach a GitHub issue.
 * The repo is public, so anything Sentry echoes back is public too: an Android
 * `UnauthorizedRestException` dumps the failed call's request headers, and those
 * carry the user's live bearer token, their email and the project apikey.
 *
 * Rules run in order — specific credential shapes first, the generic `key=value`
 * sweep last. The `(?!\[)` guard makes the generic rule skip values that are
 * *already* a placeholder, which is what keeps the whole function idempotent.
 */
const REDACTION_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[redacted-jwt]'],
  // Optional surrounding brackets so `apikey=[sb_publishable_x]` collapses to
  // `apikey=[redacted-key]` instead of double-bracketing.
  [/\[?sb_(?:publishable|secret)_[A-Za-z0-9_-]+\]?/g, '[redacted-key]'],
  // `(^|[^A-Za-z])` rather than `\b`: `refresh_token=` and `client_secret=`
  // have no word boundary before the keyword, and `\b` would skip them.
  [
    /(^|[^A-Za-z])(apikey|api[_-]?key|password|passwd|secret|token|authorization)=+(?!\[)[^\s,\]\[:]{4,}/gi,
    '$1$2=[redacted]',
  ],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[redacted-email]'],
]

export function redactSecrets(value: string): string {
  let out = value
  for (const [pattern, replacement] of REDACTION_RULES) out = out.replace(pattern, replacement)
  return out
}

/** Redact, then flatten anything that would break a markdown table cell. */
function mdCell(value: string): string {
  return redactSecrets(value).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|')
}

// ── Markdown builders ───────────────────────────────────────────────────────

export function buildTitle(issue: NormalizedIssue): string {
  const project = issue.projectSlug ? `${issue.projectSlug}: ` : ''
  // Redact before truncating: a clipped token is still a token.
  const base = redactSecrets(issue.title || issue.message || 'Sentry error')
  return `[Sentry] ${project}${truncate(base, 180)}`
}

export function buildBody(issue: NormalizedIssue): string {
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
    .map(([k, v]) => `| ${k} | ${mdCell(String(v))} |`)
    .join('\n')

  const parts = [
    `<!-- sentry-issue:${issue.sentryIssueId} -->`,
    'New or regressed error reported by Sentry.',
    '',
    '| Field | Value |',
    '| --- | --- |',
    rows,
  ]

  if (issue.message) parts.push('', '### Message', '', '```', redactSecrets(issue.message), '```')
  if (issue.culprit) parts.push('', '### Culprit', '', '```', redactSecrets(issue.culprit), '```')
  if (issue.stackFrames.length > 0) {
    const frames = issue.stackFrames.slice(0, 25).map(redactSecrets)
    parts.push('', '### Stack trace', '', '```', frames.join('\n'), '```')
  }
  if (Object.keys(issue.tags).length > 0) {
    const tagRows = Object.entries(issue.tags)
      .map(([k, v]) => `| \`${k}\` | ${mdCell(v)} |`)
      .join('\n')
    parts.push('', '### Tags', '', '| Key | Value |', '| --- | --- |', tagRows)
  }
  if (issue.url) parts.push('', `[View in Sentry](${issue.url})`)

  return parts.join('\n')
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

// ── Dedup decisions (issue #101) ─────────────────────────────────────────────
//
// The bridge keeps one GitHub issue per Sentry group. What happens on the second
// and later webhooks for that group used to be three lines inline in `Deno.serve`,
// where no test could reach it, and the answer was "acknowledge and drop" — so a
// regression of a still-open issue was invisible in GitHub. The decision, the
// lookup query and the comment builders live here instead.

export type DedupAction = 'create' | 'reopen' | 'comment' | 'skip'

/**
 * The GitHub search query that finds the tracking issue for a Sentry group.
 *
 * Two independent keys have to agree before an issue is treated as that tracker,
 * so a hand-filed issue that merely quotes `sentry-issue:<id>` cannot capture the
 * slot — #87 quoted the marker while explaining this very dedup and outranked the
 * real tracking issue:
 *
 * - `label:sentry`, which `createIssue` applies;
 * - `in:title "[Sentry]"`, the prefix `buildTitle` always writes. It still holds
 *   on the 422 path where the labels could not be applied, so neither mechanism
 *   depends on the other one succeeding.
 *
 * Callers must also send `sort=created&order=asc`: GitHub orders search results by
 * best match by default and breaks ties arbitrarily, so `items[0]` is not stable
 * between two queries whose hits both score 1.0.
 */
export function searchQuery(repo: string, sentryIssueId: string): string {
  return `repo:${repo} label:sentry type:issue in:title "[Sentry]" in:body "sentry-issue:${sentryIssueId}"`
}

export function decideAction(
  existing: { number: number; state: string } | null,
  issue: NormalizedIssue,
): DedupAction {
  if (!existing) return 'create'
  if (existing.state !== 'open') return 'reopen'
  // An open tracking issue already carries the story, and a `created`
  // re-delivery says nothing new. A regression does, so record it on the thread.
  return issue.isRegression ? 'comment' : 'skip'
}

/** Marks a comment as ours, and which occurrence of the error it describes. */
export const REGRESSION_PREFIX = '<!-- sentry-regression:'

export function regressionMarker(issue: NormalizedIssue): string {
  const key = issue.eventID
    ? `event:${issue.eventID}`
    // Without enrichment there is no event id, but count and lastSeen still
    // identify a re-delivery of the same webhook.
    : `count:${issue.count ?? '?'}:${issue.lastSeen ?? '?'}`
  return `${REGRESSION_PREFIX}${key} -->`
}

/** A flapping group must not fill the thread: one comment per this window. */
export const REGRESSION_COOLDOWN_MS = 6 * 60 * 60 * 1000

/**
 * Whether the regression described by `issue` should be commented on, given the
 * newest comment on the tracking issue.
 *
 * - the same marker is already posted → Sentry retrying the identical webhook;
 * - our own comment inside the cooldown → the group is flapping, not news;
 * - anything else → comment.
 */
export function shouldComment(
  last: { body: string; createdAt: string | null } | null,
  marker: string,
  now: number,
  cooldownMs: number = REGRESSION_COOLDOWN_MS,
): boolean {
  if (!last) return true
  if (last.body.includes(marker)) return false
  if (!last.body.includes(REGRESSION_PREFIX)) return true
  const posted = last.createdAt ? Date.parse(last.createdAt) : NaN
  if (Number.isNaN(posted)) return true
  return now - posted >= cooldownMs
}

export function buildRegressionComment(issue: NormalizedIssue): string {
  const rows = [
    ['Status', `\`${issue.substatus ?? 'regressed'}\``],
    ['Level', `\`${issue.level}\``],
    ['Events', issue.count ?? '—'],
    ['Affected users', issue.userCount != null ? String(issue.userCount) : '—'],
    ['First seen', issue.firstSeen ?? '—'],
    ['Last seen', issue.lastSeen ?? '—'],
    ['Release', issue.release ? `\`${issue.release}\`` : '—'],
    // Environment is not a field of the normalised issue — it arrives as a tag.
    ['Environment', issue.tags['environment'] ?? '—'],
  ]
    .map(([k, v]) => `| ${k} | ${mdCell(String(v))} |`)
    .join('\n')

  const parts = [
    regressionMarker(issue),
    'Sentry reports this error has **regressed** while the tracking issue was open. ' +
      'The issue is left open — this comment records the new occurrence.',
    '',
    '| Field | Value |',
    '| --- | --- |',
    rows,
  ]
  if (issue.url) parts.push('', `[View in Sentry](${issue.url})`)

  return parts.join('\n')
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a)
  const bBytes = new TextEncoder().encode(b)
  if (aBytes.length !== bBytes.length) return false
  let diff = 0
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i]
  return diff === 0
}
