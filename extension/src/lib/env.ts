/**
 * Environment variable validation for the browser extension (Chrome/Firefox).
 * Fails fast at startup with clear error messages if required vars are missing.
 *
 * Variables are injected at build time by build.mjs via esbuild `define`:
 * - __SUPABASE_URL__
 * - __SUPABASE_ANON_KEY__
 * - __SENTRY_DSN__
 */

declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;
declare const __SENTRY_DSN__: string;

interface ExtensionEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SENTRY_DSN: string;
}

/**
 * Validate environment at extension startup.
 * Called once from background.ts to ensure all required vars are present.
 */
export function validateEnvironment(): ExtensionEnv {
  // These are replaced at build time by esbuild define (build.mjs)
  const SUPABASE_URL: string = typeof __SUPABASE_URL__ !== 'undefined' ? __SUPABASE_URL__ : '';
  const SUPABASE_ANON_KEY: string = typeof __SUPABASE_ANON_KEY__ !== 'undefined' ? __SUPABASE_ANON_KEY__ : '';
  const SENTRY_DSN: string = typeof __SENTRY_DSN__ !== 'undefined' ? __SENTRY_DSN__ : '';

  const missingVars: string[] = [];
  const errors: string[] = [];

  // Check Supabase URL
  if (!SUPABASE_URL) {
    missingVars.push('SUPABASE_URL');
  } else if (!SUPABASE_URL.startsWith('https://')) {
    errors.push(`SUPABASE_URL must be HTTPS (received: ${SUPABASE_URL})`);
  }

  // Check Supabase key
  if (!SUPABASE_ANON_KEY) {
    missingVars.push('SUPABASE_ANON_KEY');
  } else if (SUPABASE_ANON_KEY.length < 50) {
    errors.push(`SUPABASE_ANON_KEY looks invalid (too short: ${SUPABASE_ANON_KEY.length} chars)`);
  }

  // Report errors (Sentry DSN is optional — warn only)
  if (!SENTRY_DSN) {
    console.warn('[roam-extension] SENTRY_DSN not set — error reporting disabled');
  }

  if (missingVars.length > 0 || errors.length > 0) {
    const message = [
      '[roam-extension] Environment validation failed:',
      '',
      ...(missingVars.length > 0 ? [
        'Missing required variables:',
        ...missingVars.map(v => `  - ${v}`),
      ] : []),
      ...(errors.length > 0 ? [
        'Invalid variable values:',
        ...errors.map(e => `  - ${e}`),
      ] : []),
      '',
      'Ensure SUPABASE_URL and SUPABASE_ANON_KEY are set in the root .env file.',
    ].join('\n');

    console.error(message);
    throw new Error(message);
  }

  return { SUPABASE_URL, SUPABASE_ANON_KEY, SENTRY_DSN };
}
