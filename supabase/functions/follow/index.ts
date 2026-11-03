// POST /functions/v1/follow
// Handles the asymmetric follow graph for the authenticated user.
//
// Actions:
//   follow   — { action, following_id }
//              Follows are always immediate; no approval required.
//   unfollow — { action, following_id }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, getCorsHeaders } from '../_shared/cors.ts'
import { awardXpAndEvaluate } from '../_shared/gamification.ts'

Deno.serve(async (req) => {
  const headers = getCorsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, headers)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )

  // Service-role client for cross-user awards: gain_follower targets the
  // followed user, which the hardened award_xp (auth.uid() = p_user_id)
  // disallows for the authenticated caller.
  const svc = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const action = body.action as string | undefined
  const followingId = body.following_id as string | undefined

  if (!action || !followingId) return json({ error: 'action and following_id required' }, 400)

  if (action === 'follow') {
    const { error } = await supabase
      .from('follows')
      .upsert({ follower_id: user.id, following_id: followingId }, { onConflict: 'follower_id,following_id' })

    if (error) return json({ error: error.message }, 500)

    // Track follow action in user_actions (triggers challenge progress)
    await supabase.from("user_actions").insert({
      user_id: user.id,
      action_type: "follow",
      metadata: { target_user_id: followingId }
    })

    // Fire-and-forget: award follow/gain-follower XP + re-evaluate badges for both.
    EdgeRuntime.waitUntil(
      (async () => {
        await awardXpAndEvaluate(
          supabase, user.id, 'follow_user',
          { target_user_id: followingId },
          `follow:${user.id}:${followingId}`,
        )
        await awardXpAndEvaluate(
          svc, followingId, 'gain_follower',
          { follower_id: user.id },
          `gain:${followingId}:${user.id}`,
        )
      })()
    )

    return json({ success: true })
  }

  if (action === 'unfollow') {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', followingId)

    if (error) return json({ error: error.message }, 500)
    return json({ success: true })
  }

  return json({ error: 'Unknown action' }, 400)
})

function json(data: unknown, status = 200, extraHeaders?: Record<string, string>) {
  const h: Record<string, string> = { ...corsHeaders, 'Content-Type': 'application/json' }
  if (extraHeaders) Object.assign(h, extraHeaders)
  return new Response(JSON.stringify(data), { status, headers: h })
}