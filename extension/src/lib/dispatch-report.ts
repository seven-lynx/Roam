// dispatch-report.ts — how the service worker reports a message it dispatched.
//
// Kept out of background.ts so the decision can be tested without importing the
// service worker, whose module scope starts the Chrome listeners. A worker that does
// not recognise a request type is answering a newer popup from an older build: that is
// version skew, not a handler failure, so it is reported at `warning` instead of
// `error` (issue #105).

import type { Response } from './messages';

/** Failure code for a request type the running worker has no `case` for. */
export const UNKNOWN_MESSAGE_TYPE = 'UNKNOWN_MESSAGE_TYPE';

/** What the popup shows when it reaches a worker from an older build. */
export const UNKNOWN_MESSAGE_ERROR = 'Roam was updated. Close and reopen the extension.';

/**
 * Request types that fail in normal operation — a rejected password, no profile yet, a
 * public profile the user has not filled in. Every dispatched type passes through
 * `dispatchReport`, so this set is the whole exclusion list.
 */
const EXPECTED_FAILURES = new Set([
  'SIGN_IN_EMAIL',
  'SIGN_UP_EMAIL',
  'GET_PROFILE',
  'GET_PROFILE_PUBLIC',
]);

/** The `default:` arm of `_dispatch`. */
export function unknownMessageTypeResponse(): Response<never> {
  return { ok: false, code: UNKNOWN_MESSAGE_TYPE, error: UNKNOWN_MESSAGE_ERROR };
}

export type ReportDecision =
  | { report: false }
  | { report: true; level: 'warning' | 'error' };

/** Decides whether a failed dispatch reaches Sentry, and at what level. */
export function dispatchReport(type: string, result: Response): ReportDecision {
  if (result.ok || EXPECTED_FAILURES.has(type)) return { report: false };
  return { report: true, level: result.code === UNKNOWN_MESSAGE_TYPE ? 'warning' : 'error' };
}
