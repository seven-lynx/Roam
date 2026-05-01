import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
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
            subabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Refresh the session if it has expired.
  // IMPORTANT: do not run any logic between createServerClient and getUser.
  let user: any = null;
  try {
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (!authError && authUser) {
      user = authUser;
    }
  } catch (error) {
    console.error('[roam-web] Auth error:', error);
    // Continue with unauthenticated user
  }

  // Protect /admin — redirect unauthenticated or non-admin users to /
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    
    // Safely check admin role with type guards
    const isAdmin =
      typeof user?.app_metadata === 'object' &&
      user.app_metadata !== null &&
      (user.app_metadata as Record<string, any>)?.role === 'admin';
    
    if (!isAdmin) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Run on all paths except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
