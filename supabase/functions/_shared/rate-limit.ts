// In-memory per-IP rate limiter for Supabase Edge Functions.
//
// Edge Function isolates persist long enough between invocations that a
// process-local Map gives effective rate limiting against a single client
// hitting one region. It is *not* globally exact — a determined attacker
// distributing requests across regions could exceed the cap by a factor of N
// (where N = number of edge regions). For our threat model (username
// enumeration, lightweight DoS from a single IP), this is sufficient.
//
// For stricter guarantees, swap this for a Postgres-backed counter or an
// external KV store (Upstash, Cloudflare).

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

// Best-effort cleanup: every 1024 calls, drop expired buckets so the Map
// doesn't grow without bound on a long-lived isolate.
let callsSinceSweep = 0
function maybeSweep(now: number) {
  callsSinceSweep++
  if (callsSinceSweep < 1024) return
  callsSinceSweep = 0
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key)
  }
}

/**
 * Extract the caller's IP address from request headers.
 * Supabase Edge runs behind a proxy, so we trust X-Forwarded-For (first hop)
 * or fall back to Fly-Client-IP / a synthetic key.
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('fly-client-ip')
    ?? req.headers.get('cf-connecting-ip')
    ?? 'unknown'
}

/**
 * Returns null when the call is allowed; returns a Response (429) when the
 * caller has exceeded `limit` requests in the last `windowMs` milliseconds.
 *
 * `key` is typically `${functionName}:${clientIp(req)}` so different routes
 * have independent buckets.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: true } | { allowed: false; retryAfterSec: number } {
  const now = Date.now()
  maybeSweep(now)

  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }

  existing.count++
  return { allowed: true }
}
