// Request validation for the `rate` Edge Function.
//
// The handler used to accept any string as `url_id`, so an empty id reached
// PostgREST and came back as `22P02 invalid input syntax for type uuid`, which
// the function reported as a generic 500. Two Sentry groups (ROAM-ANDROID-5 and
// ROAM-ANDROID-16, 75 events) were exactly that shape: the Android client's
// placeholder states build `RoamUrl(id = "")`, and tapping thumbs up/down there
// posted `{"url_id":"","value":1}` (a 23-byte body).
//
// Validate before the write, so a malformed id is a 400 and never a 500.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True when `value` is a canonical 8-4-4-4-12 UUID string (any case). */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}
