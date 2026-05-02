import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { validateSupabaseEnv } from './shared'

export async function createClient() {
  const { url, key } = validateSupabaseEnv();
  const cookieStore = await cookies()
  
  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // setAll called from a Server Component — cookies will be set by
            // the middleware on the next request instead.
          }
        },
      },
    },
  )
}
