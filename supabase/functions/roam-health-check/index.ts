// POST /functions/v1/roam-health-check
// Cron-triggered health check for the roam() discovery RPC.
//
// Verifies:
//   1. The pool is non-empty (count of approved URLs).
//   2. roam() returns a row for a dedicated test user.
//   3. roam() completes within the authenticated statement_timeout budget.
//
// If roam() returns empty while the pool is in the millions, that's the
// "impossible" condition from ROAM_EXHAUSTED_INCIDENT.md — it should page.
// Reports to Sentry so an alert rule can fire.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { initSentry } from '../_shared/sentry.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const report = initSentry('roam-health-check')

// Dedicated test account — must exist in auth.users. Each probe consumes a URL
// for this user (same side effect as a real roam), so it should be a throwaway.
const TEST_USER_ID = Deno.env.get('ROAM_TEST_USER_ID')

// The authenticated role carries statement_timeout=8s. Anything slower than
// this cannot succeed for a real logged-in user.
const BUDGET_MS = 8000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const started = Date.now()
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    // ── 1. Pool count ────────────────────────────────────────────────────────
    const { count: poolCount, error: countError } = await supabase
      .from('urls')
      .select('id', { count: 'exact', head: true })
      .eq('approved', true)

    if (countError) {
      await report(new Error(`roam-health-check: pool count failed: ${countError.message}`), 'error', {
        pg_code: countError.code,
      })
      return json({ ok: false, error: 'pool_count_failed' }, 503)
    }

    // ── 2. Probe roam() as the test user ────────────────────────────────────
    if (!TEST_USER_ID) {
      await report(new Error('roam-health-check: ROAM_TEST_USER_ID not configured'), 'error')
      return json({ ok: false, error: 'test_user_not_configured' }, 500)
    }

    const probeStarted = Date.now()
    const { data, error: rpcError } = await supabase.rpc('roam', { p_user_id: TEST_USER_ID })
    const probeMs = Date.now() - probeStarted

    if (rpcError) {
      await report(new Error(`roam-health-check: roam() raised: ${rpcError.message}`), 'error', {
        pg_code: rpcError.code,
        pool_count: poolCount,
      })
      return json({ ok: false, error: 'roam_rpc_failed', pool_count: poolCount }, 503)
    }

    const row = Array.isArray(data) ? data[0] : null

    // ── 3. The "impossible" condition: empty result while pool is huge ──────
    if (!row && (poolCount ?? 0) > 1_000_000) {
      await report(
        new Error(`roam-health-check: roam() returned empty while pool has ${poolCount} approved URLs`),
        'error',
        { pool_count: poolCount, probe_ms: probeMs },
      )
      return json({ ok: false, error: 'impossible_empty', pool_count: poolCount }, 503)
    }

    // ── 4. Latency budget ───────────────────────────────────────────────────
    if (probeMs > BUDGET_MS) {
      await report(
        new Error(`roam-health-check: roam() took ${probeMs}ms > ${BUDGET_MS}ms budget`),
        'warning',
        { pool_count: poolCount, probe_ms: probeMs },
      )
      return json({ ok: false, error: 'latency_budget_exceeded', probe_ms: probeMs }, 503)
    }

    const totalMs = Date.now() - started
    console.log(`roam-health-check PASS: pool=${poolCount}, probe=${probeMs}ms, total=${totalMs}ms`)
    return json({ ok: true, pool_count: poolCount, probe_ms: probeMs, total_ms: totalMs }, 200)
  } catch (e) {
    console.error('roam-health-check uncaught error', e)
    await report(e, 'error', { handler: 'roam-health-check' })
    return json({ ok: false, error: 'uncaught' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}