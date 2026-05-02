import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
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

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(`${origin}/join?error=${encodeURIComponent(exchangeError.message)}`);
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
    // New OAuth user — send to category selection
    return NextResponse.redirect(`${origin}/join?step=categories`);
  }

  return NextResponse.redirect(`${origin}/profile`);
}
