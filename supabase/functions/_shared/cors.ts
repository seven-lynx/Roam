// Extension background service workers (chrome-extension://, moz-extension://) bypass
// browser CORS entirely and do not require an Access-Control-Allow-Origin header.
// Web origins allowed:
//   - Production:  https://roamtheweb.app
//   - Vercel previews: https://*.vercel.app
//   - Local dev:   http://localhost:3000
const ALLOWED_ORIGINS = [
  'https://roamtheweb.app',
  'http://localhost:3000',
];

function originAllowed(origin: string): boolean {
  if (origin.endsWith('.vercel.app')) return true; // Vercel preview deployments
  return ALLOWED_ORIGINS.includes(origin);
}

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && originAllowed(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin',
  };
}

// Backward-compatible static export for existing consumers
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://roamtheweb.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Vary': 'Origin',
};

