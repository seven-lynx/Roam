import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isAuthSessionMissingError, type User } from '@supabase/supabase-js'
import { logError } from '@/lib/logger'

const PROTECTED_ROUTES = ['/profile', '/settings', '/submit']
const AUTH_REDIRECT_ROUTES = ['/signup']

// Error codes that only say the request carried a credential which is no longer
// usable: it expired, or Supabase already rotated or revoked it. That is expected
// state for a returning or anonymous visitor, not a fault — reporting it filed one
// Sentry error per page view (issues #55 and #87 / ROAM-WEB-4).
const STALE_CREDENTIAL_CODES: readonly string[] = [
  'refresh_token_not_found',
  'refresh_token_already_used',
  'session_not_found',
  'session_expired',
]

// `sb-<project-ref>-auth-token`, chunked by @supabase/ssr as `….0`, `….1`, …
const AUTH_COOKIE_PATTERN = /^sb-.+-auth-token(\.\d+)?$/

/**
 * True when the auth error means "no usable session" rather than "auth is broken".
 * A visitor with no cookie at all and a visitor whose cookie was already rotated
 * both land here.
 */
function isStaleCredentialError(error: unknown): boolean {
  if (isAuthSessionMissingError(error)) return true
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' && STALE_CREDENTIAL_CODES.includes(code)
}

/**
 * Expire the stale auth cookie so the visitor stops re-sending a credential that
 * cannot be refreshed. A failed refresh rotates nothing, so there is no freshly
 * minted cookie to leave alone.
 */
function clearStaleAuthCookies(request: NextRequest, response: NextResponse): void {
  for (const { name } of request.cookies.getAll()) {
    if (!AUTH_COOKIE_PATTERN.test(name)) continue
    request.cookies.delete(name)
    response.cookies.delete(name)
  }
}

export async function middleware(request: NextRequest) {
  try {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options),
            )
          },
        },
      },
    )

    // Refresh the session if it has expired.
    // IMPORTANT: do not run any logic between createServerClient and getUser.
    let user: User | null = null;
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (!authError && authUser) {
        user = authUser;
      } else if (authError && !isStaleCredentialError(authError)) {
        // Report only a genuine auth failure, and keep enough context to identify
        // it: the sanitizer drops any key it does not whitelist (see lib/logger.ts).
        logError('middleware', 'Supabase auth.getUser() returned error', {
          reason: authError.name,
          errorCode: authError.code,
          errorStatus: authError.status,
        });
      } else if (authError) {
        // No usable session, which is the normal state for anonymous traffic and
        // for a returning visitor whose refresh token was already rotated. Drop the
        // dead cookie instead of retrying it on every request.
        clearStaleAuthCookies(request, supabaseResponse);
      }
    } catch (error) {
      logError('middleware', 'Failed to retrieve authenticated user from Supabase', undefined, error as Error);
      // Continue with unauthenticated user — all public paths remain accessible
    }

    const pathname = request.nextUrl.pathname

    // Protect routes requiring authentication
    const isProtected = PROTECTED_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route + '/')
    )
    if (isProtected && !user) {
      const url = new URL('/signup', request.url)
      url.searchParams.set('mode', 'signin')
      return NextResponse.redirect(url)
    }

    // Redirect authenticated users away from auth-specific pages
    const isAuthRoute = AUTH_REDIRECT_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route + '/')
    )
    if (isAuthRoute && user) {
      return NextResponse.redirect(new URL('/profile', request.url))
    }

    // Protect /admin — redirect unauthenticated or non-admin users to /
    if (pathname.startsWith('/admin')) {
      if (!user) {
        const url = new URL('/signup', request.url)
        url.searchParams.set('mode', 'signin')
        return NextResponse.redirect(url)
      }

      // Safely check admin role with type guards
      const isAdmin =
        typeof user?.app_metadata === 'object' &&
        user.app_metadata !== null &&
        (user.app_metadata as Record<string, unknown>)?.role === 'admin';

      if (!isAdmin) {
        return NextResponse.redirect(new URL('/', request.url))
      }
    }

    // Protect /moderator — accessible to admins and moderators
    if (pathname.startsWith('/moderator')) {
      if (!user) {
        const url = new URL('/signup', request.url)
        url.searchParams.set('mode', 'signin')
        return NextResponse.redirect(url)
      }

      const role =
        typeof user?.app_metadata === 'object' &&
        user.app_metadata !== null
          ? (user.app_metadata as Record<string, unknown>)?.role
          : undefined;

      if (role !== 'admin' && role !== 'moderator') {
        return NextResponse.redirect(new URL('/', request.url))
      }
    }

    return supabaseResponse
  } catch (error) {
    // Catch any unexpected errors in middleware
    logError('middleware', 'Unexpected error in request middleware', undefined, error as Error);
    // Return a safe response that allows the request to continue (user will see page or auth required)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    // Run on all paths except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}