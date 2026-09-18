// GET /functions/v1/activity-feed
// Returns the activity feed for the authenticated user's following list.
// Shows recent activity from users they follow who have public profiles.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json('ok', 200)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 100)
  const offset = parseInt(url.searchParams.get('offset') ?? '0')
  const before = url.searchParams.get('before') ?? null

  const { data, error } = await supabase.rpc('get_activity_feed', {
    p_limit: limit,
    p_offset: offset,
    p_before: before,
  })

  if (error) {
    console.error('RPC error:', error)
    return json({ error: error.message }, 500)
  }

  return json({ activities: data ?? [], has_more: (data ?? []).length === limit })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
