import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const origin = url.origin;

  if (error) {
    return NextResponse.redirect(`${origin}/join?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/join`);
  }

  // Build the response first — session cookies must be set directly on the
  // redirect response. Using cookieStore.set() from next/headers is NOT
  // sufficient here because those cookies don't get propagated to an explicit
  // NextResponse.redirect() object.
  let response = NextResponse.redirect(new URL(`${origin}/profile`));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) =>
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          ),
      },
    },
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/join?error=${encodeURIComponent(exchangeError.message)}`,
    );
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/join`);
  }

  // Check if this is a new user (no username set yet)
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('user_id', user.id)
    .single();

  if (!profile?.username) {
    // New OAuth user — send to category selection.
    // Copy session cookies onto the new redirect response.
    const newUserResponse = NextResponse.redirect(
      new URL(`${origin}/join?step=categories`),
    );
    response.cookies.getAll().forEach((cookie) =>
      newUserResponse.cookies.set(cookie.name, cookie.value, cookie),
    );
    return newUserResponse;
  }

  return response;
}
