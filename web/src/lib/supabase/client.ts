import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { validateSupabaseEnv } from './shared'

export function createClient() {
  const { url, key } = validateSupabaseEnv();
  
  // Enable session persistence - users stay logged in across reloads
  // They can sign out and switch accounts using the sign out button
  return createSupabaseClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}
