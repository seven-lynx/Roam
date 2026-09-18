/**
 * Shared Supabase client validation
 * Ensures both client and server factories have consistent error handling
 */

export function validateSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) throw new Error(
    'Missing SUPABASE_URL: Set NEXT_PUBLIC_SUPABASE_URL in your .env.local file.'
  );
  if (!key) throw new Error(
    'Missing SUPABASE_ANON_KEY: Set NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.'
  );

  return { url: url as string, key: key as string };
}
