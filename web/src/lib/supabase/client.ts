import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    console.error('[roam] Missing Supabase env vars:', {
      url: url ? '✓' : 'MISSING',
      key: key ? '✓' : 'MISSING',
    });
  } else {
    console.log('[roam] Supabase initialized:', url);
  }
  
  // Enable session persistence - users stay logged in across reloads
  // They can sign out and switch accounts using the sign out button
  return createSupabaseClient(url!, key!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}
