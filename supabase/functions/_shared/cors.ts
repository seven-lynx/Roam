// CORS for every Edge Function.
//
// Callers and how their origin is treated:
//   - Extension builds. Chrome's MV3 service worker and Firefox's MV3 event page both
//     call us from their own origin (chrome-extension://<id>, moz-extension://<uuid>).
//     Firefox does NOT exempt that request from CORS on the strength of
//     host_permissions: the response must carry a readable Access-Control-Allow-Origin
//     or the fetch rejects before any body is seen (reported as "Failed to send a
//     request to the Edge Function"). The id is per-install, so no fixed value can
//     ever match — echo the origin that arrived.
//   - Web origins allowed:
//       - Production:  https://roamtheweb.app, https://www.roamtheweb.app
//       - Vercel previews: https://*.vercel.app
//       - Local dev:   http://localhost:3000
//
// Echoing an extension origin grants no ambient authority: these endpoints
// authenticate with a Bearer JWT in a header and never set
// Access-Control-Allow-Credentials, so no cookie rides along to be replayed.
const ALLOWED_ORIGINS = [
  'https://roamtheweb.app',
  'https://www.roamtheweb.app',
  'http://localhost:3000',
];

// Demand the shape of both id formats rather than trusting any scheme-prefixed string.
const EXTENSION_ORIGIN_RE = /^(?:chrome|moz)-extension:\/\/[A-Za-z0-9-]+$/;

function originAllowed(origin: string): boolean {
  if (EXTENSION_ORIGIN_RE.test(origin)) return true;
  if (origin.endsWith('.vercel.app')) return true; // Vercel preview deployments
  return ALLOWED_ORIGINS.includes(origin);
}

export function getCorsHeaders(origin: string | null): Record<string, string> {
  // When the origin is missing or unverified, do NOT echo back a wildcard or
  // a default-allowed origin — that's a CORS bypass. Return empty string
  // instead so the browser rejects the response. Extension origins are verified
  // by shape in originAllowed(), so they are echoed like any web origin.
  const allowed = origin && originAllowed(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin',
  };
}

// Backward-compatible static export for existing consumers.
// ⚠ Prefer getCorsHeaders(req) — this static export echoes the production
// origin by default, which is wrong for an extension caller (its origin is
// moz-extension://<uuid>, and the browser rejects the mismatched header).
export const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Vary': 'Origin',
};