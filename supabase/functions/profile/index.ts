// GET /functions/v1/profile?username=<username>
// Returns public profile data for a given username, including follower/following
// counts and public collections. Used by the Next.js web layer.
// Private profiles are hidden from unauthenticated callers (RLS on profiles).
//
// Follower/following counts are fetched with the service role key to bypass
// the follows RLS (which restricts reads to the involved parties). Counts are
// aggregate numbers — no private relationship data is exposed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { clientIp, rateLimit } from '../_shared/rate-limit.ts'

// 60 requests per minute per IP — enough for normal browsing of profile pages,
// well below the rate needed for username enumeration (~5 req/sec sustained).
const RATE_LIMIT = 60
const WINDOW_MS = 60_000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const ip = clientIp(req)
  const limit = rateLimit(`profile:${ip}`, RATE_LIMIT, WINDOW_MS)
  if (!limit.allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests' }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': String(limit.retryAfterSec),
        },
      },
    )
  }

  const url = new URL(req.url)
  const username = url.searchParams.get('username')
  if (!username) return json({ error: 'username query parameter is required' }, 400)

  // User-context client: respects RLS on profiles (hides private profiles)
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )

  // Service role client: used only for aggregate counts on follows
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: profile, error: profileError } = await userClient
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, is_public, created_at')
    .eq('username', username)
    .single()

  if (profileError || !profile) return json({ error: 'Profile not found' }, 404)

  const [followersRes, followingRes, collectionsRes] = await Promise.all([
    adminClient
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', profile.id)
      .eq('is_pending', false),
    adminClient
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', profile.id)
      .eq('is_pending', false),
    userClient
      .from('collections')
      .select('id, name, slug, created_at')
      .eq('user_id', profile.id)
      .eq('is_public', true)
      .order('created_at', { ascending: false }),
  ])

  return json({
    ...profile,
    follower_count: followersRes.count ?? 0,
    following_count: followingRes.count ?? 0,
    collections: collectionsRes.data ?? [],
  })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
