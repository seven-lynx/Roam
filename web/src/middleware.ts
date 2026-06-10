import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Auth-aware middleware for route-level protection.
 * - Redirects unauthenticated users from protected routes to /signup
 * - Redirects authenticated users away from /signup and /android-beta
 * - Admin routes: checks email against ADMIN_EMAILS env var
 */

const PROTECTED_ROUTES = ['/profile', '/settings', '/submit'];
const AUTH_REDIRECT_ROUTES = ['/signup', '/android-beta'];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options: _options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Protect routes requiring authentication
  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );
  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/signup';
    url.searchParams.set('mode', 'signin');
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth-specific pages
  const isAuthRoute = AUTH_REDIRECT_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );
  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/profile';
    return NextResponse.redirect(url);
  }

  // Admin route protection
  if (pathname.startsWith('/admin')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/signup';
      url.searchParams.set('mode', 'signin');
      return NextResponse.redirect(url);
    }

    const adminEmails = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase());
    const userEmail = user.email?.toLowerCase() ?? '';

    if (!adminEmails.includes(userEmail)) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/profile',
    '/profile/:path*',
    '/settings',
    '/settings/:path*',
    '/submit',
    '/submit/:path*',
    '/signup',
    '/signup/:path*',
    '/android-beta',
    '/admin',
    '/admin/:path*',
  ],
};