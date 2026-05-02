// POST /functions/v1/report-url
// Reports a URL as broken/dead. Authenticated users only.
//
// Body: { url_id: string }
//   url_id — required, UUID of the URL to report
//
// On success:
//   - Sets urls.inactive = TRUE for the given url_id
//   - Inserts a row into url_reports (user_id, url_id)
//   - Returns 200 { ok: true }
//
// The caller should immediately trigger a new roam() to skip to the next URL.
// Rate limited: 20 reports per 10 minutes per user to prevent abuse.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { clientIp, rateLimit } from '../_shared/rate-limit.ts'

const RATE_LIMIT = 20
const WINDOW_MS = 10 * 60_000 // 10 minutes

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // Require authentication
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!

  // Verify the user's JWT
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  // Rate limit per user
  const limit = rateLimit(`report-url:${user.id}`, RATE_LIMIT, WINDOW_MS)
  if (!limit.allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many reports — please wait before reporting more' }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': String(limit.retryAfterSec),
        },
      },
    )
  }

  // Parse and validate body
  let body: { url_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { url_id } = body
  if (typeof url_id !== 'string' || !UUID_RE.test(url_id)) {
    return json({ error: 'url_id must be a valid UUID' }, 400)
  }

  // Use service role client for writes
  const admin = createClient(supabaseUrl, serviceKey)

  // Mark the URL as inactive
  const { error: updateError } = await admin
    .from('urls')
    .update({ inactive: true })
    .eq('id', url_id)
    .eq('approved', true)  // Only flag approved URLs (safety guard)

  if (updateError) {
    console.error('[report-url] update error:', updateError.message)
    return json({ error: 'Failed to report URL' }, 500)
  }

  // Log the report
  const { error: insertError } = await admin
    .from('url_reports')
    .insert({ user_id: user.id, url_id })

  if (insertError) {
    // Non-fatal — the URL is already marked inactive
    console.error('[report-url] insert error:', insertError.message)
  }

  return json({ ok: true })
})
