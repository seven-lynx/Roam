// POST /functions/v1/roam
// Body (optional): { collection_id?, exclude_domain?, category_id?, subcategory_id? }
// Returns a single URL row, or 404 when pool is exhausted.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { initSentry } from '../_shared/sentry.ts'
import { incrementChallengeProgress } from '../_shared/challenge-progress.ts'

// EdgeRuntime.waitUntil is a Deno Deploy API that tells the runtime to not
// wait for a promise before shutting down the isolate. It's available at
// runtime on Supabase-hosted edge functions but not declared in the Deno
// type definitions used by deno check in CI.
declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void }

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const report = initSentry('roam')

// ── In-memory circuit breaker ────────────────────────────────────────────────
// If roam() fails repeatedly (e.g. a migration raises on every call), short-
// circuit requests to a fast 503 instead of letting each one burn a DB
// connection until statement_timeout. Per-isolate state; a fleet-wide outage
// opens circuits across isolates, so excess traffic drains away naturally.
const MAX_CONSECUTIVE_FAILURES = 5
const CIRCUIT_RESET_MS = 60_000
let consecutiveFailures = 0
let circuitOpenUntil = 0

function isCircuitOpen(): boolean {
  return Date.now() < circuitOpenUntil
}

function recordFailure(): void {
  consecutiveFailures++
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && circuitOpenUntil === 0) {
    circuitOpenUntil = Date.now() + CIRCUIT_RESET_MS
    console.error(`roam circuit breaker opened after ${consecutiveFailures} consecutive RPC failures`)
  }
}

function recordSuccess(): void {
  consecutiveFailures = 0
  circuitOpenUntil = 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }
  try {
    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)
    let body: Record<string, unknown> = {}
    try {
      const text = await req.text()
      if (text) body = JSON.parse(text)
    } catch {
      return json({ error: 'Invalid JSON' }, 400)
    }
    
    // ── Diagnostic ping: returns user + RPC test to isolate failure ──────────
    if (body.diag === true) {
      const testResult = await supabase.rpc('roam', { p_user_id: user.id })
      return json({ ok: true, user_id: user.id, user_email: user.email, rpc_data: testResult.data, rpc_error: testResult.error }, 200)
    }
    
    const collectionId   = typeof body.collection_id   === 'string' ? body.collection_id   : null
    const excludeDomain  = typeof body.exclude_domain  === 'string' ? body.exclude_domain  : null
    const excludeDomains = Array.isArray(body.exclude_domains) && body.exclude_domains.length > 0 ? (body.exclude_domains as string[]).filter((d: unknown): d is string => typeof d === 'string') : null
    const categoryId     = typeof body.category_id      === 'string' ? body.category_id     : null
    const subcategoryId  = typeof body.subcategory_id   === 'string' ? body.subcategory_id  : null
    const count          = typeof body.count === 'number' && body.count > 0 && body.count <= 10 ? body.count : 1
    const rpcParams: Record<string, unknown> = { p_user_id: user.id }
    if (collectionId)   rpcParams.p_collection_id   = collectionId
    // Prefer exclude_domains (array) over exclude_domain (single string) for multi-domain exclusion.
    // If both are provided, merge them so the single domain isn't lost.
    if (excludeDomains) {
      const merged = excludeDomain ? [...new Set([...excludeDomains, excludeDomain])] : excludeDomains
      rpcParams.p_exclude_domains = merged
    } else if (excludeDomain) {
      // Backward-compat: wrap single domain in array so the RPC gets consistent input
      rpcParams.p_exclude_domains = [excludeDomain]
    }
    if (categoryId)     rpcParams.p_category_id     = categoryId
    if (subcategoryId)  rpcParams.p_subcategory_id  = subcategoryId

    // ── Circuit breaker: fail fast instead of hammering a broken RPC ─────────
    if (isCircuitOpen()) {
      return json({ error: 'Discovery temporarily unavailable. Please try again.', retryable: true }, 503)
    }

    // ── Batch discovery (sequential) ──────────────────────────────────────────
    // Calls the roam RPC sequentially — parallelization is left to the caller
    // (Android prefetch loop) to avoid overwhelming DB connection pools.
    const isPrefetch = body.prefetch === true
    let timedOut = false
    const seenIds = new Set<string>()
    const results: Array<Record<string, unknown>> = []

    for (let i = 0; i < count; i++) {
      const { data, error } = await supabase.rpc('roam', rpcParams)
      if (error) {
        const errCode = (error as any)?.code ?? 'unknown'
        const errMsg = (error as any)?.message ?? ''
        const errDetails = (error as any)?.details ?? ''
        console.error('roam RPC error', JSON.stringify({ code: errCode, message: errMsg, details: errDetails, attempt: i + 1, rpcParams }))
        // Capture the underlying pg error to Sentry so a broken function pings.
        await report(new Error(`roam RPC error ${errCode}: ${errMsg}`), 'error', {
          pg_code: errCode,
          pg_details: errDetails,
          attempt: i + 1,
        })
        recordFailure()
        const isTimeout = errCode === '57014' || errCode === '57P01'
          || errMsg.toLowerCase().includes('timeout')
          || errMsg.toLowerCase().includes('canceling statement')
          || errMsg.toLowerCase().includes('query_canceled')
        if (isTimeout) {
          timedOut = true
          continue
        }
        if (count > 1) continue
        // A DB exception is never "exhausted". 503 tells the client to retry.
        return json({ error: 'Discovery failed. Please try again.', retryable: true }, 503)
      }
      recordSuccess()

      const row = Array.isArray(data) ? data[0] : null
      if (!row) continue // pool exhausted for this call

      if (seenIds.has(row.id)) continue
      seenIds.add(row.id)

      const entry = {
        id:             row.id,
        url:            row.url,
        title:          row.title,
        description:    row.description,
        og_image_url:   row.og_image_url,
        category_id:    row.category_id ?? null,
        subcategory_id: row.subcategory_id ?? null,
        wilson_score:   row.wilson_score,
      }
      results.push(entry)
    }

    if (results.length === 0 && timedOut) {
      return json({ error: 'Discovery timed out. Please try again.', retryable: true }, 503)
    }
    if (results.length === 0) {
      // Genuine exhaustion: the RPC succeeded but returned no rows. The explicit
      // `exhausted` marker lets clients distinguish this from any error path.
      return json({ error: 'No more URLs to discover', exhausted: true }, 404)
    }

    if (!isPrefetch && results.length > 0) {
      const firstRow = results[0]
      const idemKey = `roam:${firstRow.id}:${user.id}:${Math.floor(Date.now() / 60000)}`

      EdgeRuntime.waitUntil(
        (async () => {
          try {
            const result = await supabase.rpc('update_streak', { p_user_id: user.id })
            const r = result as { data?: { streak_days?: number; max_streak?: number; is_streak_broken?: boolean } }
            if (r?.data) {
              console.log(
                `streak updated: ${r.data.streak_days} days (best: ${r.data.max_streak}, broken: ${r.data.is_streak_broken ?? false})`
              )
            }
          } catch (e) {
            console.error('streak update failed', e)
          }
          try {
            await supabase.rpc('award_xp', {
              p_user_id: user.id,
              p_action: 'roam',
              p_metadata: { url_id: firstRow.id },
              p_idempotency_key: idemKey,
            })
          } catch (e) {
            console.error('xp award failed', e)
          }
        })()
      )

      // Track challenge progress for roam_count
      EdgeRuntime.waitUntil(
        (async () => {
          try {
            const svcClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
              auth: { persistSession: false },
            })
            await incrementChallengeProgress(svcClient, user.id, 'roam_count')
          } catch (e) {
            console.error('challenge progress failed', e)
          }
        })()
      )
    }

    return json(count === 1 ? results[0] : results, 200, { 'Cache-Control': 'private, max-age=5' })
  } catch (e) {
    console.error('roam handler uncaught error', e)
    await report(e, 'error', { handler: 'roam' })
    return json({ error: 'Discovery failed. Please try again.', retryable: true }, 503)
  }
})
function json(body: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  })
}