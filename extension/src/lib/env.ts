/**
 * Environment variable validation for the browser extension (Chrome/Firefox).
 * Fails fast at startup with clear error messages if required vars are missing.
 * 
 * Required vars:
 * - VITE_SUPABASE_URL: Supabase project URL (bundled, public)
 * - VITE_SUPABASE_ANON_KEY: Supabase anon key (bundled, public)
 * - VITE_SENTRY_DSN_EXTENSION: Sentry project DSN (bundled, public)
 * 
 * Validation runs at extension load time (background script init).
 * If validation fails, the extension won't function and will log errors.
 */

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
  // These are injected by the build process (build.mjs)
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN_EXTENSION as string;

  const missingVars: string[] = [];
  const errors: string[] = [];

  // Check Supabase URL
  if (!SUPABASE_URL) {
    missingVars.push('VITE_SUPABASE_URL');
  } else if (!SUPABASE_URL.startsWith('https://')) {
    errors.push(`VITE_SUPABASE_URL must be HTTPS (received: ${SUPABASE_URL})`);
  }

  // Check Supabase key
  if (!SUPABASE_ANON_KEY) {
    missingVars.push('VITE_SUPABASE_ANON_KEY');
  } else if (SUPABASE_ANON_KEY.length < 50) {
    errors.push(`VITE_SUPABASE_ANON_KEY looks invalid (too short: ${SUPABASE_ANON_KEY.length} chars)`);
  }

  // Check Sentry DSN
  if (!SENTRY_DSN) {
    missingVars.push('VITE_SENTRY_DSN_EXTENSION');
  } else if (!SENTRY_DSN.startsWith('https://')) {
    errors.push(`VITE_SENTRY_DSN_EXTENSION must be HTTPS (received: ${SENTRY_DSN})`);
  }

  // Report errors
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
      'The extension will not function without these values.',
      'See extension/README.md for setup instructions.',
    ].join('\n');

    console.error(message);
    
    // Also send to Sentry if DSN is available
    if (SENTRY_DSN) {
      try {
        navigator.sendBeacon(SENTRY_DSN, JSON.stringify({
          message: 'Extension startup failed: ' + message,
          level: 'fatal',
        }));
      } catch (e) {
        // Ignore Sentry errors during initialization
      }
    }

    throw new Error(message);
  }

  return {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    SENTRY_DSN,
  };
}

// Validate at module load
export const env = validateEnvironment();

export function getEnv() {
  return env;
}
