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
    return json({ error: 'url_id (string) and value (1 or -1) are required' }, 400)
  }

  const { error } = await supabase
    .from('ratings')
    .upsert({ user_id: user.id, url_id, value }, { onConflict: 'user_id,url_id' })

  if (error) return json({ error: error.message }, 500)
  return json({ ok: true })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
