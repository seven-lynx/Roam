/**
 * Environment variable validation for Supabase Edge Functions (Deno runtime).
 * Fails fast with clear error messages if required vars are missing.
 * 
 * Each Edge Function should call validateRequired() at startup to ensure
 * all required vars are present before processing requests.
 * 
 * Usage:
 * ```typescript
 * import { validateRequired } from '../_shared/env.ts'
 * 
 * // At the top of your function (before Deno.serve)
 * const env = validateRequired([
 *   'SUPABASE_URL',
 *   'SUPABASE_ANON_KEY',
 * ])
 * ```
 */

export interface EdgeFunctionEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  [key: string]: string;
}

/**
 * Validate required environment variables for an Edge Function.
 * Call this at the top of your function file, before Deno.serve().
 * 
 * @param requiredVars - List of required environment variable names
 * @returns Object with all required vars (will throw if any are missing/invalid)
 * @throws Error if any required variable is missing or invalid
 */
export function validateRequired(requiredVars: string[]): EdgeFunctionEnv {
  const missingVars: string[] = [];
  const errors: string[] = [];
  const result: EdgeFunctionEnv = {};

  for (const varName of requiredVars) {
    const value = Deno.env.get(varName);

    if (!value) {
      missingVars.push(varName);
      continue;
    }

    result[varName] = value;

    // Validate common patterns
    if (varName.includes('URL') && !value.startsWith('https://')) {
      errors.push(`${varName} must be HTTPS (received: ${value})`);
    }

    if (varName.includes('KEY') && value.length < 50) {
      errors.push(`${varName} looks invalid (too short: ${value.length} chars)`);
    }

    if (varName.includes('DSN') && !value.startsWith('https://')) {
      errors.push(`${varName} must be HTTPS (received: ${value})`);
    }
  }

  // Report errors
  if (missingVars.length > 0 || errors.length > 0) {
    const message = [
      '[supabase-edge-functions] Environment validation failed:',
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
      'Edge Functions require these env vars to be set via:',
      '  supabase secrets set VAR_NAME="value"',
      '',
      'See docs/DEPLOYMENT_CHECKLIST.md for setup instructions.',
    ].join('\n');

    console.error(message);
    throw new Error(message);
  }

  return result;
}

/**
 * Get a single environment variable with optional validation.
 * 
 * @param varName - Environment variable name
 * @param required - If true, throws if variable is missing
 * @returns The environment variable value, or undefined if missing
 * @throws Error if required=true and variable is missing
 */
export function getEnv(varName: string, required = false): string | undefined {
  const value = Deno.env.get(varName);
  
  if (required && !value) {
    throw new Error(`[env] Required environment variable is missing: ${varName}`);
  }

  return value;
}

/**
 * Get a required environment variable with validation.
 * Shorthand for getEnv(varName, true).
 * 
 * @param varName - Environment variable name
 * @returns The environment variable value
 * @throws Error if variable is missing
 */
export function getEnvRequired(varName: string): string {
  const value = getEnv(varName, true);
  if (!value) {
    throw new Error(`[env] Required environment variable is missing: ${varName}`);
  }
  return value;
}
