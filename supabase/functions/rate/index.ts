// POST /functions/v1/rate
// Body: { url_id: string, value: 1 | -1 }
// Upserts a rating for the authenticated user. The Wilson score trigger on the
// ratings table recalculates and stores the new score on the urls row automatically.

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

  let body: { url_id?: unknown; value?: unknown }
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const { url_id, value } = body
  if (typeof url_id !== 'string' || (value !== 1 && value !== -1)) {
    return json({ error: 'url_id (string) and value (1 or -1) required' }, 400)
  }

  const { error: upsertErr } = await supabase
    .from('ratings')
    .upsert({ user_id: user.id, url_id, value }, { onConflict: 'user_id,url_id' })

  if (upsertErr) {
    console.error('rate upsert failed:', upsertErr.message)
    return json({ error: 'Failed to record rating' }, 500)
  }

  // Track rate action in user_actions (triggers challenge progress)
  await supabase.from("user_actions").insert({
    user_id: user.id,
    action_type: "rate",
    metadata: { url_id, value }
  })

  // Fire-and-forget: evaluate badges
  EdgeRuntime.waitUntil(
    (async () => {
      try {
        await supabase.functions.invoke('evaluate-badges', { body: { user_id: user.id } })
      } catch { /* best effort */ }
    })()
  )

  return json({ success: true })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}