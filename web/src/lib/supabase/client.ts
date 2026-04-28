import { createBrowserClient } from '@supabase/ssr'

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
  
  // Disable session persistence to prevent auto-login across page reloads.
  // Users must manually sign in each time. This allows debugging multiple accounts.
  // But DO detect sessions in URL for OAuth callbacks.
  return createBrowserClient(url!, key!, {
    auth: {
      persistSession: false,
      detectSessionInUrl: true,
    },
  })
}
