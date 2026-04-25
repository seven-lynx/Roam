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
  
  return createBrowserClient(url!, key!)
}
