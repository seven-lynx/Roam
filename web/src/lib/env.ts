/**
 * Environment variable validation for the Next.js web platform.
 * Fails fast at startup with clear error messages if required vars are missing.
 * 
 * Required vars:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL (public, safe to expose)
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase anon key (public, safe to expose)
 * - NEXT_PUBLIC_SENTRY_DSN: Sentry error tracking (public, safe to expose)
 * - SENTRY_AUTH_TOKEN: Sentry upload token (private, for Vercel CI only)
 * 
 * Optional vars (development):
 * - NEXT_PUBLIC_SUPABASE_API_URL: Override Supabase API endpoint
 * 
 * This module is imported by the root layout to ensure validation runs early.
 */

interface EnvVars {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  NEXT_PUBLIC_SENTRY_DSN: string;
  SENTRY_AUTH_TOKEN?: string;
}

// Validate at module load time (before any app logic runs)
function validateEnvironment(): EnvVars {
  const missingVars: string[] = [];
  const errors: string[] = [];

  // Check required public vars (safe to expose in browser)
  const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!NEXT_PUBLIC_SUPABASE_URL) {
    missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
  } else if (!NEXT_PUBLIC_SUPABASE_URL.startsWith('https://')) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL must be an HTTPS URL (received: ' + NEXT_PUBLIC_SUPABASE_URL + ')');
  }

  const NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    missingVars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  } else if (NEXT_PUBLIC_SUPABASE_ANON_KEY.length < 50) {
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY looks invalid (too short: ' + NEXT_PUBLIC_SUPABASE_ANON_KEY.length + ' chars)');
  }

  const NEXT_PUBLIC_SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!NEXT_PUBLIC_SENTRY_DSN) {
    missingVars.push('NEXT_PUBLIC_SENTRY_DSN');
  } else if (!NEXT_PUBLIC_SENTRY_DSN.startsWith('https://')) {
    errors.push('NEXT_PUBLIC_SENTRY_DSN must be an HTTPS URL (received: ' + NEXT_PUBLIC_SENTRY_DSN + ')');
  }

  // Check optional private vars (Vercel CI/CD only)
  const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
  if (!SENTRY_AUTH_TOKEN && process.env.VERCEL) {
    // In Vercel production/preview, warn if missing but don't fail
    console.warn('[env] SENTRY_AUTH_TOKEN missing — source maps may not upload to Sentry');
  }

  // Report errors
  if (missingVars.length > 0) {
    const message = [
      '[env] Next.js web platform is missing required environment variables:',
      '',
      missingVars.map(v => `  - ${v}`).join('\n'),
      '',
      'See .env.example or docs/DEPLOYMENT_CHECKLIST.md for setup instructions.',
    ].join('\n');
    console.error(message);
    throw new Error(message);
  }

  if (errors.length > 0) {
    const message = [
      '[env] Next.js web platform has invalid environment variables:',
      '',
      errors.map(e => `  - ${e}`).join('\n'),
      '',
      'Please check the values in your .env file.',
    ].join('\n');
    console.error(message);
    throw new Error(message);
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SENTRY_DSN,
    SENTRY_AUTH_TOKEN,
  };
}

// Validate and export the config
export const env = validateEnvironment();

// Type-safe export for use in code
export function getEnv() {
  return env;
}
