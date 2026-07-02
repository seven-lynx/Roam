import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { logError } from '@/lib/logger'

const PROTECTED_ROUTES = ['/profile', '/settings', '/submit']
const AUTH_REDIRECT_ROUTES = ['/signup', '/android-beta']

export async function proxy(request: NextRequest) {
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
      } else if (authError) {
        logError('middleware', 'Supabase auth.getUser() returned error', {
          errorCode: (authError as { code?: string }).code,
          errorStatus: (authError as { status?: number }).status,
        });
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
    logError('middleware', 'Unexpected error in request proxy middleware', undefined, error as Error);
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
