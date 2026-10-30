// POST /functions/v1/share-url
// Routes by `action`:
//   share:      { action: 'share', recipient_id: uuid, url_id?: uuid, url?: string }
//   recipients: { action: 'recipients', search?: string, limit?: number }
//   list:       { action: 'list', limit?: number, offset?: number }

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

  const action = (body.action as string | undefined) ?? 'share'

  // ── action: recipients — list users the current user can share with ──────────
  if (action === 'recipients') {
    const search = (body.search as string | undefined) || undefined
    const limit = (body.limit as number | undefined) || 50
    const { data, error } = await supabase.rpc('get_share_recipients', {
      p_search: search ?? null,
      p_limit: limit,
    })
    if (error) return json({ error: error.message }, 500)
    return json({ recipients: data ?? [] })
  }

  // ── action: list — URLs shared with the current user ─────────────────────────
  if (action === 'list') {
    const limit = (body.limit as number | undefined) || 50
    const offset = (body.offset as number | undefined) || 0
    const { data, error } = await supabase.rpc('get_shared_urls_for_user', {
      p_limit: limit,
      p_offset: offset,
    })
    if (error) return json({ error: error.message }, 500)
    return json({ shared: data ?? [] })
  }

  // ── action: share — send a URL to another Roam user ──────────────────────────
  const recipientId = body.recipient_id as string | undefined
  if (!recipientId) return json({ error: 'recipient_id required' }, 400)

  let urlId = (body.url_id as string | undefined) || undefined

  // Some clients (e.g. Android pages opened outside the discovery pool) only have
  // the full URL. Resolve it to a pool id before sharing.
  if (!urlId) {
    const url = body.url as string | undefined
    if (!url) return json({ error: 'url_id or url required' }, 400)
    const { data: byUrl } = await supabase.from('urls').select('id').eq('url', url).maybeSingle()
    if (byUrl?.id) {
      urlId = byUrl.id
    } else {
      const { data: byOriginal } = await supabase.from('urls').select('id').eq('original_url', url).maybeSingle()
      urlId = byOriginal?.id
    }
    if (!urlId) return json({ error: 'URL not found in the Roam network' }, 404)
  }

  // Delegate to the RPC, which enforces auth/self/recipient/URL checks, inserts
  // into shared_urls and creates the recipient's notification.
  const { data, error } = await supabase.rpc('share_url_with_user', {
    p_recipient_id: recipientId,
    p_url_id: urlId,
  })

  if (error) return json({ error: error.message }, 500)
  if (data && typeof data === 'object' && (data as Record<string, unknown>).error) {
    return json({ error: String((data as Record<string, unknown>).error) }, 400)
  }

  // Track the share for badges/challenges (share_events uses user_id, not sender_id).
  await supabase.from('share_events').insert({
    user_id: user.id,
    url_id: urlId,
    share_type: 'url',
  })
  await supabase.from('user_actions').insert({
    user_id: user.id,
    action_type: 'share',
    metadata: { url_id: urlId, recipient_id: recipientId },
  })

  return json({ success: true, ...(data as Record<string, unknown> ?? {}) })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}