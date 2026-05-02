// env.ts — Build-time environment validation for the Roam extension.
// Variables are injected by esbuild `define` in build.mjs.
// Called once at SW startup; throws immediately with a clear message if required vars are absent.

declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;
declare const __SENTRY_DSN__: string;

export function validateEnvironment(): void {
  const url = typeof __SUPABASE_URL__ !== 'undefined' ? __SUPABASE_URL__ : '';
  const key = typeof __SUPABASE_ANON_KEY__ !== 'undefined' ? __SUPABASE_ANON_KEY__ : '';
  const dsn = typeof __SENTRY_DSN__ !== 'undefined' ? __SENTRY_DSN__ : '';

  if (!url || !url.startsWith('https://'))
    throw new Error('[roam] SUPABASE_URL is missing or not HTTPS. Set it in the root .env file.');
  if (!key || key.length < 50)
    throw new Error('[roam] SUPABASE_ANON_KEY is missing or looks invalid. Set it in the root .env file.');
  if (!dsn)
    console.warn('[roam] SENTRY_DSN not set — error reporting disabled.');
}
