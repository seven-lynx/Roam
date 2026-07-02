// POST /functions/v1/follow
// Handles the asymmetric follow graph for the authenticated user.
//
// Actions:
//   follow   — { action, following_id }
//              Follows are always immediate; no approval required.
//   unfollow — { action, following_id }

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
      if (following_id === user.id) return json({ error: 'Cannot follow yourself' }, 400)

      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: user.id, following_id, is_pending: false })

      if (error) {
        if (error.code === '23505') return json({ error: 'Already following this user' }, 409)
        return json({ error: error.message }, 500)
      }
      return json({ ok: true }, 201)
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
