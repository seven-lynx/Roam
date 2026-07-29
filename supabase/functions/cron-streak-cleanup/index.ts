// Scheduled function: runs every 6 hours to reset stale streaks.
// Finds users whose last activity was >24 hours ago and resets their streak_days to 0.
// Triggered via Supabase cron (pg_cron) or an external scheduler hitting this endpoint.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

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

    const { data, error } = await adminClient.rpc('reset_stale_streaks')

    if (error) throw error

    const count = (data as number) ?? 0
    console.log(`Streak cleanup: reset ${count} stale streaks`)

    return new Response(JSON.stringify({ success: true, reset_count: count }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('streak cleanup failed', e)
    return new Response(JSON.stringify({ error: 'Cleanup failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})