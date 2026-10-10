// Extension background service workers (chrome-extension://, moz-extension://) bypass
// browser CORS entirely and do not require an Access-Control-Allow-Origin header.
// Web origins allowed:
//   - Production:  https://roamtheweb.app, https://www.roamtheweb.app
//   - Vercel previews: https://*.vercel.app
//   - Local dev:   http://localhost:3000
const ALLOWED_ORIGINS = [
  'https://roamtheweb.app',
  'https://www.roamtheweb.app',
  'http://localhost:3000',
];

function originAllowed(origin: string): boolean {
  if (origin.endsWith('.vercel.app')) return true; // Vercel preview deployments
  return ALLOWED_ORIGINS.includes(origin);
}

export function getCorsHeaders(origin: string | null): Record<string, string> {
  // When the origin is missing or unverified, do NOT echo back a wildcard or
  // a default-allowed origin — that's a CORS bypass. Return empty string
  // instead so the browser rejects the response.
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
// origin by default which is not safe when the request origin is unknown.
export const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Vary': 'Origin',
};