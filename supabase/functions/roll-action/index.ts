// POST /functions/v1/roll-action
// Body: { action_type: 'wallpaper' | 'roll_rate', metadata?: object }
// Records a Cyberdeck Roll gallery action for the authenticated user and fires
// off badge evaluation (fire-and-forget), mirroring supabase/functions/rate.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  let body: { action_type?: unknown; metadata?: unknown }
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const { action_type, metadata } = body
  if (action_type !== 'wallpaper' && action_type !== 'roll_rate') {
    return json({ error: 'action_type must be "wallpaper" or "roll_rate"' }, 400)
  }

  const { error: insertErr } = await supabase.from('user_actions').insert({
    user_id: user.id,
    action_type,
    metadata: (metadata && typeof metadata === 'object' ? metadata : {}) as Record<string, unknown>,
  })

  if (insertErr) {
    console.error('roll-action insert failed:', insertErr.message)
    return json({ error: 'Failed to record action' }, 500)
  }

  // Fire-and-forget: evaluate badges
  EdgeRuntime.waitUntil(
    (async () => {
      try {
        await supabase.functions.invoke('evaluate-badges', { body: { user_id: user.id } })
      } catch { /* best effort */ }
    })(),
  )

  return json({ success: true })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
