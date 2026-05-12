// Extension background service workers (chrome-extension://, moz-extension://) bypass
// browser CORS entirely and do not require an Access-Control-Allow-Origin header.
// Only the hosted web app needs CORS headers, so a static allowlist is sufficient.
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://roamtheweb.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

