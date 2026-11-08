/**
 * Tests for the Sentry → GitHub bridge payload helpers.
 * Verifies: dispatch across both Sentry webhook shapes, the reopen rule
 * (regressed/escalating) versus the ignore rule (resolved/assigned), the dedup
 * decision once a group already has an issue (create / reopen / comment / skip),
 * inline stack-frame parsing and `[external]` marking, the shared-secret
 * comparison, and the body markers the degraded-pipeline check relies on.
 *
 * `normalize.ts` is imported directly and has no imports of its own on purpose:
 * `index.ts` validates env and registers `Deno.serve` at import time, so only
 * the pure helpers are reachable from a test.
 */

import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.208.0/assert/mod.ts"
import {
  buildBody,
  buildRegressionComment,
  buildTitle,
  decideAction,
  exceptionValues,
  formatFrame,
  normalize,
  redactSecrets,
  regressionMarker,
  releaseVersion,
  searchQuery,
  shouldComment,
  stackFrames,
  tagsToObject,
  timingSafeEqual,
  type NormalizedIssue,
} from '../sentry-webhook/normalize.ts'

const ISSUE_ID = '7821467944'
const ALERT_ISSUE_ID = '1234567890'

/** Issue webhook: `Sentry-Hook-Resource: issue` → data.issue */
// deno-lint-ignore no-explicit-any
function issueWebhook(action: string, substatus: string | null = 'new'): any {
  return {
    action,
    data: {
      issue: {
        id: ISSUE_ID,
        title: 'ReferenceError: BootSequence is not defined',
        culprit: 'web/src/app/page.tsx',
        level: 'error',
        platform: 'javascript',
        project: { slug: 'roam-web' },
        metadata: { type: 'ReferenceError', value: 'BootSequence is not defined' },
        web_url: `https://7-lynx.sentry.io/issues/${ISSUE_ID}/`,
        firstSeen: '2026-11-01T07:54:00Z',
        lastSeen: '2026-11-01T07:56:00Z',
        count: '2',
        userCount: 0,
        substatus,
      },
    },
  }
}

/** Issue-alert webhook: `Sentry-Hook-Resource: event_alert` → data.event */
// deno-lint-ignore no-explicit-any
function eventAlert(): any {
  return {
    action: 'triggered',
    data: {
      triggered_rule: 'Send a notification for high priority issues',
      event: {
        issue_id: ALERT_ISSUE_ID,
        title: 'TypeError: cannot read property "x" of undefined',
        culprit: 'web/src/app/page.tsx in Page',
        level: 'error',
        platform: 'javascript',
        url: `https://7-lynx.sentry.io/projects/7-lynx/roam-web/issues/${ALERT_ISSUE_ID}/`,
        web_url: `https://7-lynx.sentry.io/issues/${ALERT_ISSUE_ID}/`,
        release: '1b404c8',
        metadata: { type: 'TypeError', value: 'cannot read property "x" of undefined' },
        tags: [['environment', 'production'], ['release', '1b404c8']],
        exception: {
          values: [
            {
              type: 'TypeError',
              value: 'cannot read property "x" of undefined',
              stacktrace: {
                frames: [
                  { filename: 'web/src/app/page.tsx', lineno: 42, function: 'Page', in_app: true },
                  {
                    filename: 'node_modules/react-dom/client.js',
                    lineno: 7,
                    function: 'render',
                    in_app: false,
                  },
                ],
              },
            },
          ],
        },
      },
    },
  }
}

/**
 * The shape `GET /api/0/issues/<id>/events/latest/` returns — what `enrich()` fetches.
 * Trimmed to the keys the bridge reads, but structurally exact: the exception sits
 * under `entries[]` (there is no top-level `exception`), `tags` are `{ key, value }`
 * objects, and `release` is an object. Copied from a real payload on 2026-11-08.
 */
// deno-lint-ignore no-explicit-any
function restEvent(): any {
  return {
    eventID: 'b72cb2571486469901c02d14c5a4ed70',
    platform: 'java',
    metadata: {
      type: 'UnauthorizedRestException',
      value: '{"error":"Failed to record rating"}',
    },
    entries: [
      {
        type: 'exception',
        data: {
          values: [
            {
              type: 'UnauthorizedRestException',
              value: '{"error":"Failed to record rating"}',
              stacktrace: {
                frames: [
                  { filename: 'ZygoteInit.java', function: 'main', in_app: false },
                  {
                    filename: 'app/src/main/java/app/roam/data/RoamRepository.kt',
                    lineno: 119,
                    function: 'recordRating',
                    in_app: true,
                  },
                ],
              },
            },
          ],
        },
      },
      { type: 'breadcrumbs', data: { values: [] } },
    ],
    tags: [
      { key: 'environment', value: 'production' },
      { key: 'release', value: 'app.roam.android@1.4.0+35' },
    ],
    release: { id: 2080575488, version: 'app.roam.android@1.4.0+35', status: 'open' },
  }
}

function required(payload: unknown): NormalizedIssue {
  const issue = normalize(payload)
  if (!issue) throw new Error('expected the payload to normalize, got null')
  return issue
}

// ── Payload dispatch ────────────────────────────────────────────────────────

Deno.test('normalize - issue webhook, action=created', () => {
  const issue = required(issueWebhook('created'))

  assertEquals(issue.sentryIssueId, ISSUE_ID)
  assertEquals(issue.title, 'ReferenceError: BootSequence is not defined')
  assertEquals(issue.message, 'BootSequence is not defined')
  assertEquals(issue.exceptionType, 'ReferenceError')
  assertEquals(issue.level, 'error')
  assertEquals(issue.platform, 'javascript')
  assertEquals(issue.projectSlug, 'roam-web')
  assertEquals(issue.culprit, 'web/src/app/page.tsx')
  assertEquals(issue.url, `https://7-lynx.sentry.io/issues/${ISSUE_ID}/`)
  assertEquals(issue.count, '2')
  assertEquals(issue.userCount, 0)
  assertEquals(issue.substatus, 'new')
  assertEquals(issue.triggeredRule, null)
  assertEquals(issue.isRegression, false)
  // Issue webhooks carry no event id — enrichment supplies one later.
  assertEquals(issue.eventID, null)
  // Issue webhooks carry no frames — enrichment fills them in later.
  assertEquals(issue.stackFrames.length, 0)
  assertEquals(issue.tags, {})
})

Deno.test('normalize - unresolved + regressed/escalating reopens, the rest is ignored', () => {
  for (const substatus of ['regressed', 'escalating']) {
    const issue = required(issueWebhook('unresolved', substatus))
    assertEquals(issue.substatus, substatus)
    assertEquals(issue.isRegression, true)
    assertEquals(issue.sentryIssueId, ISSUE_ID)
  }

  for (const [action, substatus] of [
    ['resolved', 'resolved'],
    ['assigned', 'ongoing'],
    ['archived', 'archived'],
    ['unresolved', 'ongoing'],
    ['ignored', null],
  ] as const) {
    assertEquals(normalize(issueWebhook(action, substatus)), null)
  }
})

Deno.test('normalize - unrecognised payloads are ignored', () => {
  assertEquals(normalize(null), null)
  assertEquals(normalize(undefined), null)
  assertEquals(normalize({}), null)
  assertEquals(normalize({ action: 'created' }), null)
  assertEquals(normalize({ data: {} }), null)
  assertEquals(normalize({ data: { issue: 'not-an-object' } }), null)
})

Deno.test('normalize - event_alert parses inline frames and tags', () => {
  const issue = required(eventAlert())

  assertEquals(issue.sentryIssueId, ALERT_ISSUE_ID)
  assertEquals(issue.triggeredRule, 'Send a notification for high priority issues')
  assertEquals(issue.release, '1b404c8')
  assertEquals(issue.projectSlug, 'roam-web')
  assertEquals(issue.exceptionType, 'TypeError')
  assertEquals(issue.tags, { environment: 'production', release: '1b404c8' })
  assertEquals(issue.stackFrames, [
    'web/src/app/page.tsx:42 in Page',
    'node_modules/react-dom/client.js:7 in render [external]',
  ])
  // Fields only the issue resource carries stay null.
  assertEquals(issue.firstSeen, null)
  assertEquals(issue.count, null)
  assertEquals(issue.substatus, null)
  // An alert says an event tripped a rule; it is not a regression report.
  assertEquals(issue.isRegression, false)
})

Deno.test('normalize - event_alert without issue_id (metric alert) is ignored', () => {
  const payload = eventAlert()
  delete payload.data.event.issue_id
  assertEquals(normalize(payload), null)
})

Deno.test('normalize - project slug is read from the /projects/<org>/<slug>/ path', () => {
  assertEquals(required(eventAlert()).projectSlug, 'roam-web')

  // Issue URLs carry no project segment, so the slug is simply absent.
  const payload = eventAlert()
  payload.data.event.url = `https://7-lynx.sentry.io/issues/${ALERT_ISSUE_ID}/`
  assertEquals(required(payload).projectSlug, '')
})

// ── Enrichment shapes (issue #93) ───────────────────────────────────────────
//
// The events API nests the exception under `entries[]`; only webhook payloads put it
// at the top level. Reading just the top-level key silently filed every enriched
// issue with no stack trace, so both shapes are pinned here.

Deno.test('exceptionValues - reads the REST entries[] shape enrichment fetches', () => {
  const event = restEvent()
  assertEquals(event.exception, undefined)

  const values = exceptionValues(event)
  assertEquals(values.length, 1)
  assertEquals(values[0]['type'], 'UnauthorizedRestException')
  assertEquals(
    values.flatMap(stackFrames).map(formatFrame),
    [
      'ZygoteInit.java in main [external]',
      'app/src/main/java/app/roam/data/RoamRepository.kt:119 in recordRating',
    ]
  )

  // The inline webhook shape still parses unchanged.
  assertEquals(exceptionValues(eventAlert().data.event).length, 1)

  // A native crash with no frames must stay empty rather than throw.
  const frameLess = { entries: [{ type: 'exception', data: { values: [{ type: 'SIGSEGV' }] } }] }
  assertEquals(exceptionValues(frameLess).length, 1)
  assertEquals(exceptionValues(frameLess).flatMap(stackFrames).length, 0)

  // Neither shape present.
  assertEquals(exceptionValues({}), [])
})

Deno.test('releaseVersion - object from the events API, string from webhooks', () => {
  assertEquals(releaseVersion('1b404c8'), '1b404c8')
  assertEquals(releaseVersion({ version: 'app.roam.android@1.4.0+35' }), 'app.roam.android@1.4.0+35')
  assertEquals(releaseVersion(null), null)
  assertEquals(releaseVersion({}), null)
  assertEquals(releaseVersion(undefined), null)
})

Deno.test('buildBody - an issue enriched from the events API renders its stack trace', () => {
  // What enrich() does to an issue-webhook payload, minus the network call.
  const event = restEvent()
  const issue = required(issueWebhook('created'))
  issue.stackFrames = exceptionValues(event).flatMap(stackFrames).map(formatFrame)
  issue.tags = tagsToObject(event.tags)
  issue.release = releaseVersion(event.release)

  const body = buildBody(issue)
  assertStringIncludes(body, '### Stack trace')
  assertStringIncludes(body, 'app/src/main/java/app/roam/data/RoamRepository.kt:119 in recordRating')
  assertStringIncludes(body, '### Tags')
  assertStringIncludes(body, '| `environment` | production |')
  assertStringIncludes(body, '| Release | `app.roam.android@1.4.0+35` |')
})

Deno.test('formatFrame - absolute paths, raw_function, external marking', () => {
  assertEquals(
    formatFrame({ abs_path: '/app/src/index.js', raw_function: 'anonymous', lineno: 3, in_app: true }),
    '/app/src/index.js:3 in anonymous'
  )
  assertEquals(formatFrame({ filename: 'no-lineno.js', function: 'x', in_app: true }), 'no-lineno.js in x')
  assert(formatFrame({ filename: 'vendor.js', function: 'y', in_app: false }).endsWith('[external]'))
})

Deno.test('timingSafeEqual - matches only identical secrets', () => {
  assertEquals(timingSafeEqual('s3cret', 's3cret'), true)
  assertEquals(timingSafeEqual('', ''), true)
  assertEquals(timingSafeEqual('s3cret', 's3cret2'), false) // length mismatch
  assertEquals(timingSafeEqual('s3cret', 'S3CRET'), false) // same length, different bytes
  assertEquals(timingSafeEqual('s3cret', ''), false)
})

// ── Markdown builders ───────────────────────────────────────────────────────

Deno.test('buildBody - always opens with the dedupe marker', () => {
  const issueBody = buildBody(required(issueWebhook('created')))
  assert(issueBody.startsWith(`<!-- sentry-issue:${ISSUE_ID} -->`))
  assertStringIncludes(issueBody, 'New or regressed error reported by Sentry.')
  assertStringIncludes(issueBody, '[View in Sentry]')

  const alertBody = buildBody(required(eventAlert()))
  assert(alertBody.startsWith(`<!-- sentry-issue:${ALERT_ISSUE_ID} -->`))
})

Deno.test('buildBody - stack trace section only when frames exist', () => {
  const issueBody = buildBody(required(issueWebhook('created')))
  assert(!issueBody.includes('### Stack trace'))

  const alertBody = buildBody(required(eventAlert()))
  assertStringIncludes(alertBody, '### Stack trace')
  assertStringIncludes(alertBody, 'web/src/app/page.tsx:42 in Page')
  assertStringIncludes(alertBody, '### Tags')
})

Deno.test('buildTitle - project-prefixed and bounded', () => {
  assertEquals(
    buildTitle(required(issueWebhook('created'))),
    '[Sentry] roam-web: ReferenceError: BootSequence is not defined'
  )

  const payload = issueWebhook('created')
  payload.data.issue.title = 'x'.repeat(400)
  const title = buildTitle(required(payload))
  assertEquals(title.startsWith('[Sentry] roam-web: '), true)
  assertEquals(title.endsWith('…'), true)
  assertEquals(title.length <= '[Sentry] roam-web: '.length + 180, true)
})

// ── Redaction ───────────────────────────────────────────────────────────────

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhNTU5YTRiZSJ9.c2lnbmF0dXJlLWhlcmU'
const APIKEY = 'sb_publishable_TESTKEY0000000000000000'

/** The shape an Android `UnauthorizedRestException` carries: a header dump. */
const HEADER_DUMP = [
  '{"error":"Failed to record rating"}',
  'URL: https://example.supabase.co/functions/v1/rate',
  `Headers: [Authorization=[Bearer ${JWT}], x-region=[any, any], apikey=[${APIKEY}], X-Client-Info=[supabase-kt/3.0.2], Accept=[application/json]]`,
  'Http Method: POST',
  'Reporter: joel.coleman@example.com',
].join('\n')

Deno.test('redactSecrets - strips every credential class', () => {
  const cases: Array<[string, string]> = [
    [`Bearer ${JWT}`, 'Bearer [redacted]'],
    [JWT, '[redacted-jwt]'],
    [`apikey=[${APIKEY}]`, 'apikey=[redacted-key]'],
    [APIKEY, '[redacted-key]'],
    ['password=hunter2hunter2', 'password=[redacted]'],
    ['refresh_token=abcd1234', 'refresh_token=[redacted]'],
    [`Authorization=[Bearer ${JWT}]`, 'Authorization=[Bearer [redacted]]'],
    ['joel.coleman@example.com', '[redacted-email]'],
  ]
  for (const [input, expected] of cases) assertEquals(redactSecrets(input), expected, input)
})

Deno.test('redactSecrets - is idempotent', () => {
  const once = redactSecrets(HEADER_DUMP)
  assertEquals(redactSecrets(once), once)
})

Deno.test('redactSecrets - leaves ordinary error text and URLs alone', () => {
  const keep = [
    '[ERROR] [middleware] Supabase auth.getUser() returned error',
    'HTTP request to https://example.supabase.co/auth/v1/token?grant_type=pkce (POST) failed',
    'x-region=[any, any], Accept=[application/json]',
    'TypeError: cannot read property "x" of undefined',
  ]
  for (const s of keep) assertEquals(redactSecrets(s), s)
})

Deno.test('buildBody - an exception that dumps its headers publishes no credential', () => {
  const payload = issueWebhook('created')
  payload.data.issue.metadata.value = HEADER_DUMP
  const body = buildBody(required(payload))

  // Credentials are gone…
  assert(!body.includes('eyJ'), 'JWT leaked into the body')
  assert(!body.includes('sb_publishable'), 'apikey leaked into the body')
  assert(!body.includes('joel.coleman@example.com'), 'email leaked into the body')
  // …their placeholders, and the diagnostic value, are not.
  assertStringIncludes(body, 'Bearer [redacted]')
  assertStringIncludes(body, 'apikey=[redacted-key]')
  assertStringIncludes(body, 'Reporter: [redacted-email]')
  assertStringIncludes(body, 'URL: https://example.supabase.co/functions/v1/rate')
  assertStringIncludes(body, 'x-region=[any, any]')
})

Deno.test('buildTitle - a credential in the title is redacted', () => {
  const payload = issueWebhook('created')
  payload.data.issue.title = `UnauthorizedRestException: token=${JWT}`
  assertEquals(
    buildTitle(required(payload)),
    '[Sentry] roam-web: UnauthorizedRestException: token=[redacted-jwt]'
  )
})

Deno.test('buildBody - tag and stack-frame values are redacted too', () => {
  const payload = eventAlert()
  payload.data.event.tags = [['url', 'https://example.test/page?token=abcd1234']]
  payload.data.event.exception.values[0].stacktrace.frames = [
    {
      filename: 'https://cdn.example.test/app.js?token=abcd1234',
      lineno: 1,
      function: 'f',
      in_app: true,
    },
  ]
  const body = buildBody(required(payload))

  assertStringIncludes(body, '| `url` | https://example.test/page?token=[redacted] |')
  assertStringIncludes(body, 'https://cdn.example.test/app.js?token=[redacted]:1 in f')
  assert(!body.includes('abcd1234'))
})

// ── Tags ────────────────────────────────────────────────────────────────────

Deno.test('tagsToObject - accepts webhook pairs and events-API objects', () => {
  assertEquals(
    tagsToObject([
      ['environment', 'production'],
      { key: 'device', value: 'SM-G998U' },
      { key: 'no_value' },
      'nonsense',
      null,
    ]),
    { environment: 'production', device: 'SM-G998U', no_value: '' }
  )
})

Deno.test('normalize - events-API tag objects reach the body', () => {
  // Enrichment fetches the events API, which returns { key, value }; before this
  // the Tags section silently never rendered for an enriched issue.
  const payload = eventAlert()
  payload.data.event.tags = [{ key: 'device', value: 'SM-G998U' }]
  const issue = required(payload)
  assertEquals(issue.tags, { device: 'SM-G998U' })
  assertStringIncludes(buildBody(issue), '| `device` | SM-G998U |')
})

Deno.test('buildBody - a pipe in a tag value cannot break the table', () => {
  const payload = eventAlert()
  payload.data.event.tags = [['note', 'a|b']]
  assertStringIncludes(buildBody(required(payload)), '| `note` | a\\|b |')
})

// ── Dedup decisions (issue #101) ─────────────────────────────────────────────
//
// What the bridge does on the second and later webhook for a group used to be
// three inline lines in `Deno.serve`: matched issue open → acknowledge and drop.
// A regression of a still-open error therefore never reached GitHub, and the
// lookup that found the issue was unscoped, so a hand-filed issue quoting the
// `sentry-issue:<id>` marker could take the slot. Both are pinned here.

Deno.test('searchQuery - scopes the lookup to issues the webhook filed', () => {
  const q = searchQuery('seven-lynx/Roam', ISSUE_ID)

  assertStringIncludes(q, 'repo:seven-lynx/Roam')
  assertStringIncludes(q, `in:body "sentry-issue:${ISSUE_ID}"`)
  // Both keys: the label is what `createIssue` applies, the title prefix is what
  // survives the 422 path where the label could not be applied at all.
  assertStringIncludes(q, 'label:sentry')
  assertStringIncludes(q, 'in:title "[Sentry]"')
})

Deno.test('decideAction - create, reopen, comment, skip', () => {
  const regression = required(issueWebhook('unresolved', 'regressed'))
  const created = required(issueWebhook('created'))

  assertEquals(decideAction(null, created), 'create')
  assertEquals(decideAction({ number: 55, state: 'closed' }, regression), 'reopen')
  // The defect this fixes: an open tracker used to swallow the regression.
  assertEquals(decideAction({ number: 55, state: 'open' }, regression), 'comment')
  // Sentry re-delivering `created` for a group we already track says nothing new.
  assertEquals(decideAction({ number: 55, state: 'open' }, created), 'skip')
})

Deno.test('normalize - the event id survives both payload shapes', () => {
  // Enrichment fills the issue-webhook case from the events API, not the payload.
  assertEquals(required(issueWebhook('created')).eventID, null)

  const payload = eventAlert()
  payload.data.event.event_id = 'b72cb2571486469901c02d14c5a4ed70'
  assertEquals(required(payload).eventID, 'b72cb2571486469901c02d14c5a4ed70')
})

Deno.test('regressionMarker - event id when known, count/lastSeen otherwise', () => {
  const enriched = required(issueWebhook('unresolved', 'regressed'))
  enriched.eventID = 'abc123'
  assertEquals(regressionMarker(enriched), '<!-- sentry-regression:event:abc123 -->')

  const plain = required(issueWebhook('unresolved', 'regressed'))
  assertEquals(
    regressionMarker(plain),
    '<!-- sentry-regression:count:2:2026-11-01T07:56:00Z -->',
  )
})

Deno.test('shouldComment - a retry or a flapping group does not comment', () => {
  const issue = required(issueWebhook('unresolved', 'regressed'))
  issue.eventID = 'abc123'
  const marker = regressionMarker(issue)
  const now = Date.parse('2026-11-08T21:37:18Z')
  const quietSince = (body: string, createdAt?: string | null) => ({ body, createdAt: createdAt ?? null })

  // Nothing on the thread yet.
  assert(shouldComment(null, marker, now))
  // Somebody else's comment is not a reason to stay quiet.
  assert(shouldComment(quietSince('me too', '2026-11-08T21:00:00Z'), marker, now))
  // Sentry retrying the identical webhook.
  assert(!shouldComment(quietSince(`note\n\n${marker}`, '2026-11-08T20:00:00Z'), marker, now))
  // A different occurrence inside the cooldown: the group is flapping.
  assert(!shouldComment(quietSince('<!-- sentry-regression:event:older -->', '2026-11-08T21:00:00Z'), marker, now))
  // …but past the window it is news again.
  assert(shouldComment(quietSince('<!-- sentry-regression:event:older -->', '2026-11-08T06:00:00Z'), marker, now))
  // An unparseable timestamp must not silence a real regression.
  assert(shouldComment(quietSince('<!-- sentry-regression:event:older -->'), marker, now))
})

Deno.test('buildRegressionComment - carries the marker, the facts, and the link', () => {
  const issue = required(issueWebhook('unresolved', 'regressed'))
  issue.eventID = 'abc123'
  issue.release = '2ae071e'
  issue.count = '41'
  issue.userCount = 7
  // Environment is a tag, not a field of the normalised issue.
  issue.tags = { environment: 'production' }

  const comment = buildRegressionComment(issue)

  assertStringIncludes(comment, '<!-- sentry-regression:event:abc123 -->')
  assertStringIncludes(comment, '| Status | `regressed` |')
  assertStringIncludes(comment, '| Events | 41 |')
  assertStringIncludes(comment, '| Affected users | 7 |')
  assertStringIncludes(comment, '| Release | `2ae071e` |')
  assertStringIncludes(comment, '| Environment | production |')
  assertStringIncludes(comment, `[View in Sentry](${issue.url})`)
})

Deno.test('buildRegressionComment - a credential in a tag value stays off GitHub', () => {
  const issue = required(issueWebhook('unresolved', 'regressed'))
  issue.tags = { environment: `Authorization=[Bearer ${JWT}]` }

  const comment = buildRegressionComment(issue)

  assert(!comment.includes(JWT), 'JWT leaked into the regression comment')
  assertStringIncludes(comment, 'Bearer [redacted]')
})

