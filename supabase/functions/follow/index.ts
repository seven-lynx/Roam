// POST /functions/v1/follow
// Handles the asymmetric follow graph for the authenticated user.
//
// Actions:
//   follow   — { action, following_id }
//              Follows are always immediate; no approval required.
//   unfollow — { action, following_id }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const headers = getCorsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, headers)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
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

    // Fire-and-forget: evaluate badges for both users
    EdgeRuntime.waitUntil(
      (async () => {
        try {
          await supabase.functions.invoke('evaluate-badges', { body: { user_id: user.id } })
          await supabase.functions.invoke('evaluate-badges', { body: { user_id: followingId } })
        } catch { /* best effort */ }
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
  const h: Record<string, string> = { ...headers, 'Content-Type': 'application/json' }
  if (extraHeaders) Object.assign(h, extraHeaders)
  return new Response(JSON.stringify(data), { status, headers: h })
}