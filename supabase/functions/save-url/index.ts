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

  let body: { action?: unknown; url?: unknown; title?: unknown; url_id?: unknown } = {}
  try {
    const text = await req.text()
    if (text) body = JSON.parse(text)
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const action = typeof body.action === 'string' ? body.action : null
  if (!action) return json({ error: 'action is required' }, 400)

  if (action === 'save') {
    const url   = typeof body.url   === 'string' ? body.url.trim()   : null
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const urlId = typeof body.url_id === 'string' ? body.url_id      : null
    if (!url) return json({ error: 'url is required' }, 400)

    // First, check if this URL is already saved so we only award XP on new saves
    const { data: existing } = await supabase
      .from('saved_urls')
      .select('url')
      .eq('user_id', user.id)
      .eq('url', url)
      .maybeSingle()

    const { error } = await supabase
      .from('saved_urls')
      .upsert(
        { user_id: user.id, url, title, url_id: urlId },
        { onConflict: 'user_id,url', ignoreDuplicates: false },
      )
    if (error) return json({ error: error.message }, 500)

    // Only award XP on first save, not re-saves of the same URL.
    // Use idempotency key to prevent double-awards from retried requests.
    if (!existing) {
      const idemKey = `save_url:${urlId ?? url}:${user.id}`
      supabase.rpc('award_xp', {
        p_user_id: user.id,
        p_action: 'save_url',
        p_metadata: { url, url_id: urlId },
        p_idempotency_key: idemKey,
      })
        .then(
          () => supabase.rpc('evaluate_badges', { p_user_id: user.id }),
          (e: unknown) => { console.error('xp award failed (save-url)', e) }
        )
        .then(
          () => {},
          (e: unknown) => { console.error('badge evaluation failed (save-url)', e) }
        )
    }

    return json({ ok: true })
  }

  if (action === 'unsave') {
    const url = typeof body.url === 'string' ? body.url.trim() : null
    if (!url) return json({ error: 'url is required' }, 400)

    const { error } = await supabase
      .from('saved_urls')
      .delete()
      .eq('user_id', user.id)
      .eq('url', url)
    if (error) return json({ error: error.message }, 500)
    return json({ ok: true })
  }

  if (action === 'list') {
    const { data, error } = await supabase
      .from('saved_urls')
      .select('url, title, saved_at')
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false })
      .limit(200)
    if (error) return json({ error: error.message }, 500)
    return json({ saved: data })
  }

  return json({ error: `Unknown action: ${action}` }, 400)
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
