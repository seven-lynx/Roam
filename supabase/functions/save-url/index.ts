// POST /functions/v1/save-url   { action: "save", url, title, url_id? }
// POST /functions/v1/save-url   { action: "unsave", url }
// POST /functions/v1/save-url   { action: "list" }
// Manages the server-side saved-for-later list for authenticated users.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json('ok', 200)
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

  const action = body.action as string | undefined
  if (!action) return json({ error: 'action required' }, 400)

  // ── LIST ──────────────────────────────────────────────────────────────
  if (action === 'list') {
    const { data, error } = await supabase
      .from('saved_urls')
      .select('url, title, saved_at')
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false })
      .limit(200)

    if (error) return json({ error: error.message }, 500)
    return json(data)
  }

  // ── UNSAVE ────────────────────────────────────────────────────────────
  if (action === 'unsave') {
    const url = body.url as string | undefined
    if (!url) return json({ error: 'url required' }, 400)

    const { error } = await supabase
      .from('saved_urls')
      .delete()
      .eq('user_id', user.id)
      .eq('url', url)

    if (error) return json({ error: error.message }, 500)
    return json({ success: true })
  }

  // ── SAVE ──────────────────────────────────────────────────────────────
  if (action === 'save') {
    const url = body.url as string | undefined
    const title = (body.title as string) || url || ''
    const urlId = body.url_id as string | undefined

    if (!url) return json({ error: 'url required' }, 400)

    const { error: upsertErr } = await supabase
      .from('saved_urls')
      .upsert({ user_id: user.id, url, title, url_id: urlId || null }, { onConflict: 'user_id,url' })

    if (upsertErr) return json({ error: upsertErr.message }, 500)

    // Track save action in user_actions (triggers challenge progress for every save)
    await supabase.from("user_actions").insert({
      user_id: user.id,
      action_type: "save",
      metadata: { url_id: urlId || null, url }
    })

    return json({ success: true })
  }

  return json({ error: 'Unknown action' }, 400)
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}