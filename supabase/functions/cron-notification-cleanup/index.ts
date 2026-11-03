// Scheduled function: keeps the notifications table bounded.
//
//   * Deletes notifications older than 90 days (they are only read from the
//     in-app bell and the Android/extension lists, so a 90-day window is ample).
//   * Deletes push_tokens older than 180 days as a hygiene net; the push-notify
//     function already removes tokens that fail with a definitive 404/410.
//
// Triggered via Supabase cron (pg_cron) or an external scheduler hitting this
// endpoint. Mirrors the CRON_SECRET guard in cron-streak-cleanup.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const NOTIFICATION_RETENTION_DAYS = 90
const TOKEN_RETENTION_DAYS = 180
const DAY_MS = 24 * 60 * 60 * 1000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Only allow POST from authorized services (cron)
  const authHeader = req.headers.get('Authorization')
  const expectedSecret = Deno.env.get('CRON_SECRET')
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const notificationCutoff = new Date(Date.now() - NOTIFICATION_RETENTION_DAYS * DAY_MS).toISOString()
    const tokenCutoff = new Date(Date.now() - TOKEN_RETENTION_DAYS * DAY_MS).toISOString()

    const { error: notifError } = await adminClient
      .from('notifications')
      .delete({ count: 'exact' })
      .lt('created_at', notificationCutoff)
    if (notifError) throw notifError

    const { error: tokenError } = await adminClient
      .from('push_tokens')
      .delete({ count: 'exact' })
      .lt('created_at', tokenCutoff)
    if (tokenError) throw tokenError

    console.log(`Notification cleanup complete. cutoffs: ${notificationCutoff} / ${tokenCutoff}`)

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('notification cleanup failed', e)
    return new Response(JSON.stringify({ error: 'Cleanup failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
