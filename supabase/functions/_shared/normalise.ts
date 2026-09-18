// URL normalization — canonical implementation for all Roam surfaces.
//
// Removes tracking parameters, standardizes protocol/hostname formatting,
// and strips fragments. Run this on every URL before:
// - Inserting into the urls table (seeding or user submission)
// - Checking for duplicates
// - Storing in browser storage (extension)
//
// Node.js equivalent: scripts/lib/seed.js normaliseUrl()
// Extension equivalent: extension/src/background/background.ts (if any)
// Keep all three in sync when adding new tracking params or changing rules.
//
// Order of operations:
// 1. Parse as URL (throws on invalid input)
// 2. Enforce HTTPS (throw if not http/https)
// 3. Lowercase hostname
// 4. Strip www. prefix
// 5. Delete known tracking params (UTM, fbclid, gclid, etc.)
// 6. Delete hash/fragment
// 7. Strip trailing slash (except for root "/")

export function normalizeUrl(raw: string): string {
  const u = new URL(raw) // throws on invalid URL

  if (!['http:', 'https:'].includes(u.protocol)) {
    throw new Error('Only http and https URLs are allowed')
  }

  u.protocol = 'https:'
  u.hostname = u.hostname.toLowerCase()

  if (u.hostname.startsWith('www.')) {
    u.hostname = u.hostname.slice(4)
  }

  // Strip known tracking and UTM parameters
  const STRIP_PARAMS = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'fbclid',
    'gclid',
    'mc_cid',
    'mc_eid',
    'ref',
  ]
  STRIP_PARAMS.forEach((p) => u.searchParams.delete(p))

  u.hash = ''

  // Strip trailing slash, except for root "/"
  if (u.pathname !== '/' && u.pathname.endsWith('/')) {
    u.pathname = u.pathname.slice(0, -1)
  }

  return u.toString()
}
