// POST /functions/v1/follow
// Handles the asymmetric follow graph for the authenticated user.
//
// Actions:
//   follow   — { action, following_id }
//              If the target profile is private, inserts with is_pending = true.
//   unfollow — { action, following_id }
//   accept   — { action, follower_id }  (current user accepts an incoming request)
//   reject   — { action, follower_id }  (current user rejects an incoming request)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const action = body.action as string

  switch (action) {
    // ── Follow ──────────────────────────────────────────────────────────────
    case 'follow': {
      const { following_id } = body
      if (typeof following_id !== 'string') return json({ error: 'following_id is required' }, 400)

      // Check whether the target profile is private
      const { data: target } = await supabase
        .from('profiles')
        .select('is_public')
        .eq('id', following_id)
        .single()

      // Default to public if profile not found (edge case guard)
      const is_pending = !(target?.is_public ?? true)

      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: user.id, following_id, is_pending })

      if (error) {
        if (error.code === '23505') return json({ error: 'Already following this user' }, 409)
        return json({ error: error.message }, 500)
      }
      return json({ ok: true, is_pending }, 201)
    }

    // ── Unfollow ─────────────────────────────────────────────────────────────
    case 'unfollow': {
      const { following_id } = body
      if (typeof following_id !== 'string') return json({ error: 'following_id is required' }, 400)

      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', following_id)

      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    // ── Accept follow request ─────────────────────────────────────────────────
    case 'accept': {
      // current user is the one being followed (following_id = user.id)
      const { follower_id } = body
      if (typeof follower_id !== 'string') return json({ error: 'follower_id is required' }, 400)

      const { error } = await supabase
        .from('follows')
        .update({ is_pending: false })
        .eq('follower_id', follower_id)
        .eq('following_id', user.id)
        .eq('is_pending', true)

      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    // ── Reject follow request ─────────────────────────────────────────────────
    case 'reject': {
      // current user removes a pending request aimed at them
      const { follower_id } = body
      if (typeof follower_id !== 'string') return json({ error: 'follower_id is required' }, 400)

      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', follower_id)
        .eq('following_id', user.id)
        .eq('is_pending', true)

      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    default:
      return json({ error: `Unknown action: ${action ?? 'missing'}` }, 400)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
