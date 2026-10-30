// POST /functions/v1/report-url
// Body: { url_id: string }
// Reports a broken/dead link. Marks the URL as inactive and logs the report.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'))

  function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

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

  const urlId = body.url_id as string | undefined
  if (!urlId) return json({ error: 'url_id required' }, 400)
  const isAuto = body.auto === true

  // Service-role client for the privileged writes (urls.inactive + url_reports).
  // url_reports is RLS-enabled with no public policies, and users can't update
  // urls directly, so these must bypass RLS.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Verify the URL exists
  const { data: urlData } = await admin
    .from('urls')
    .select('id')
    .eq('id', urlId)
    .maybeSingle()

  if (!urlData) return json({ error: 'URL not found' }, 404)

  // Mark URL as inactive
  const { error: updateErr } = await admin
    .from('urls')
    .update({ inactive: true })
    .eq('id', urlId)

  if (updateErr) return json({ error: updateErr.message }, 500)

  // Log the report
  const { error: reportErr } = await admin
    .from('url_reports')
    .insert({
      url_id: urlId,
      user_id: user.id,
    })

  if (reportErr) {
    console.error('report-url insert failed:', reportErr.message)
    return json({ error: 'Failed to record report' }, 500)
  }

  // Track report action in user_actions (triggers challenge progress).
  // Skip for automated (prefetch cull) reports so they don't grant credit.
  if (!isAuto) {
    await supabase.from("user_actions").insert({
      user_id: user.id,
      action_type: "report",
      metadata: { url_id: urlId }
    })
  }

  return json({ success: true })
})

