/**
 * Tests for the Sentry → GitHub bridge payload helpers.
 * Verifies: dispatch across both Sentry webhook shapes, the reopen rule
 * (regressed/escalating) versus the ignore rule (resolved/assigned), inline
 * stack-frame parsing and `[external]` marking, the shared-secret comparison,
 * and the body markers that dedupe and the degraded-pipeline check rely on.
 *
 * `normalize.ts` is imported directly and has no imports of its own on purpose:
 * `index.ts` validates env and registers `Deno.serve` at import time, so only
 * the pure helpers are reachable from a test.
 */

import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.208.0/assert/mod.ts"
import {
  buildBody,
  buildTitle,
  formatFrame,
  normalize,
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
  // Issue webhooks carry no frames — enrichment fills them in later.
  assertEquals(issue.stackFrames.length, 0)
  assertEquals(issue.tags, {})
})

Deno.test('normalize - unresolved + regressed/escalating reopens, the rest is ignored', () => {
  for (const substatus of ['regressed', 'escalating']) {
    const issue = required(issueWebhook('unresolved', substatus))
    assertEquals(issue.substatus, substatus)
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
