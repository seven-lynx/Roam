// POST /functions/v1/report-engagement
// Reports dwell time and skip status for a URL the user was served.
// The seen_urls row must already exist (created by the roam() RPC).
// Idempotent — multiple calls for the same (user, url) are safe, last write wins.
//
// Body: { url_id: string, dwell_ms: number, skipped: boolean }
//
// Typically called before requesting the next Roam — the client calculates
// dwell = now - pageLoadTimestamp and skipped = dwell < 3000ms.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const headers = getCorsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers })
  }

  const url_id = body.url_id as string | undefined
  const dwell_ms = body.dwell_ms as number | undefined
  const skipped = body.skipped as boolean | undefined

  if (!url_id) {
    return new Response(JSON.stringify({ error: 'url_id is required' }), { status: 400, headers })
  }
  if (typeof dwell_ms !== 'number' || dwell_ms < 0) {
    return new Response(JSON.stringify({ error: 'dwell_ms must be a non-negative number' }), { status: 400, headers })
  }
  if (typeof skipped !== 'boolean') {
    return new Response(JSON.stringify({ error: 'skipped must be a boolean' }), { status: 400, headers })
  }

  const { error } = await supabase
    .from('seen_urls')
    .update({ dwell_ms, skipped })
    .eq('user_id', user.id)
    .eq('url_id', url_id)

  if (error) {
    console.error('[report-engagement] db error:', error)
    return new Response(JSON.stringify({ error: 'Failed to report engagement' }), { status: 500, headers })
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
})