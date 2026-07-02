// POST /functions/v1/share-url
// Handles sharing URLs directly with other users.
//
// Actions:
//   share    — { action, recipient_id, url_id }
//   list     — { action } (get shared URLs sent to current user)
//   recipients — { action, search? } (get list of eligible recipients)

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
  try {
    const text = await req.text()
    body = text ? JSON.parse(text) : {}
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const action = typeof body.action === 'string' ? body.action : null
  if (!action) return json({ error: 'action is required' }, 400)

  // ── Share URL with recipient ────────────────────────────────────────────
  if (action === 'share') {
    const recipientId = typeof body.recipient_id === 'string' ? body.recipient_id : null
    const urlId = typeof body.url_id === 'string' ? body.url_id : null

    if (!recipientId) return json({ error: 'recipient_id is required' }, 400)
    if (!urlId) return json({ error: 'url_id is required' }, 400)

    // Call the RPC function
    const { data, error } = await supabase.rpc('share_url_with_user', {
      p_recipient_id: recipientId,
      p_url_id: urlId,
    })

    if (error) {
      console.error('RPC error:', error)
      return json({ error: error.message }, 500)
    }

    // Check for error in returned JSON
    if (data?.error) {
      return json({ error: data.error }, 400)
    }

    return json({ ok: true, share_id: data.share_id, message: data.message }, 201)
  }

  // ── List shared URLs sent to current user ───────────────────────────────
  if (action === 'list') {
    const limit = typeof body.limit === 'number' ? body.limit : 50
    const offset = typeof body.offset === 'number' ? body.offset : 0

    const { data, error } = await supabase.rpc('get_shared_urls_for_user', {
      p_limit: limit,
      p_offset: offset,
    })

    if (error) {
      console.error('RPC error:', error)
      return json({ error: error.message }, 500)
    }

    return json({ shared: data || [] })
  }

  // ── Get eligible share recipients ──────────────────────────────────────
  if (action === 'recipients') {
    const search = typeof body.search === 'string' ? body.search.trim() : null
    const limit = typeof body.limit === 'number' ? body.limit : 50

    const { data, error } = await supabase.rpc('get_share_recipients', {
      p_search: search,
      p_limit: limit,
    })

    if (error) {
      console.error('RPC error:', error)
      return json({ error: error.message }, 500)
    }

    return json({ recipients: data || [] })
  }

  return json({ error: `Unknown action: ${action}` }, 400)
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
