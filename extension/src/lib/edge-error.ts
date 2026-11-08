// edge-error.ts — how a failed Edge Function call is classified, and what the user
// is told about it.
//
// supabase-js reports three failure classes from invoke():
//   FunctionsFetchError — the request never got a response: DNS, TLS, a dropped
//                         connection, or a CORS rejection. `context` holds the raw
//                         fetch error, so there is no status code or body to read.
//   FunctionsRelayError — the Supabase relay could not reach the function.
//   FunctionsHttpError  — the function answered with a non-2xx; status and body are
//                         readable, so a retry is pointless and it is never retried.
// The first two both mean "we never got a usable answer": worth one more attempt, and
// worth saying in plain words rather than echoing the SDK (DESIGN.md §10).

/** User-facing copy for a call that never reached the function. */
export const EDGE_UNREACHABLE_MESSAGE =
  "Couldn't reach Roam's servers. Check your connection and try again.";

const RETRYABLE_EDGE_ERRORS = new Set(['FunctionsFetchError', 'FunctionsRelayError']);

/**
 * True when the failure means "no usable answer" — a dropped connection or a relay
 * blip, as opposed to a function that answered with an error.
 *
 * Matched by error name, because the SDK's message ("Failed to send a request to the
 * Edge Function") contains none of the words the retry predicate looks for.
 */
export function isRetryableEdgeFailure(err: unknown): boolean {
  const name = (err as { name?: unknown } | null)?.name;
  return typeof name === 'string' && RETRYABLE_EDGE_ERRORS.has(name);
}
