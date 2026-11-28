// env.ts — Build-time environment validation for the Roam extension.
// Variables are injected by esbuild `define` in build.mjs.
// Called once at SW startup; throws immediately with a clear message if required vars are absent.

declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;
declare const __SENTRY_DSN__: string;

/** The three build-time values, together so a test can supply them. */
export interface EnvironmentValues {
  supabaseUrl: string;
  supabaseAnonKey: string;
  sentryDsn: string;
}

/**
 * The values esbuild `define`s. They are read in one place so the default below is
 * computed once, and so a test has something to pass instead of stubbing a global
 * that the transform has already inlined (issue #150).
 */
const BUILD_VALUES: EnvironmentValues = {
  supabaseUrl: typeof __SUPABASE_URL__ !== 'undefined' ? __SUPABASE_URL__ : '',
  supabaseAnonKey: typeof __SUPABASE_ANON_KEY__ !== 'undefined' ? __SUPABASE_ANON_KEY__ : '',
  sentryDsn: typeof __SENTRY_DSN__ !== 'undefined' ? __SENTRY_DSN__ : '',
};

export function validateEnvironment(values: EnvironmentValues = BUILD_VALUES): void {
  const { supabaseUrl: url, supabaseAnonKey: key, sentryDsn: dsn } = values;

  if (!url || !url.startsWith('https://'))
    throw new Error('[roam] SUPABASE_URL is missing or not HTTPS. Set it in the root .env file.');
  if (!key)
    throw new Error('[roam] SUPABASE_ANON_KEY is missing. Set it in the root .env file.');
  if (!dsn)
    console.warn('[roam] SENTRY_DSN not set — error reporting disabled.');
}