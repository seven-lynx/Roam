import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { validateSupabaseEnv } from './shared'

/**
 * Synchronous server client factory (no cookies). Used for testing and
 * non-request contexts where Next.js cookies() is unavailable.
 */
export function createServerSupabase() {
  const { url, key } = validateSupabaseEnv();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });
}

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
