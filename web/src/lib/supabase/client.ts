import { createBrowserClient } from '@supabase/ssr'
import { validateSupabaseEnv } from './shared'

export function createClient() {
  const { url, key } = validateSupabaseEnv();
  return createBrowserClient(url, key);
}
