// POST /functions/v1/roam
// Body (optional): { collection_id?, exclude_domain?, category_id?, subcategory_id? }
// Returns a single URL row, or 404 when pool is exhausted.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { initSentry } from '../_shared/sentry.ts'
// `EdgeRuntime` is a non-standard global that Supabase exposes on edge
// function hosts (see supabase/functions/_shared/deno-globals.d.ts for the
// ambient declaration that makes it visible to `deno check`).
// Usage: EdgeRuntime.waitUntil(backgroundTask())

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
  // Extension callers arrive from their own origin; echo it back (see _shared/cors.ts).
  const corsHeaders = getCorsHeaders(req.headers.get('origin'))
  const json = (body: unknown, status = 200, extraHeaders?: Record<string, string>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
    })

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

    const isPrefetch = body.prefetch === true
    let timedOut = false
    const seenIds = new Set<string>()
    const results: Array<Record<string, unknown>> = []

    /** Shape a roam()/roam_prefetch() row for the client. */
    const toEntry = (row: Record<string, unknown>) => ({
      id:             row.id,
      url:            row.url,
      title:          row.title,
      description:    row.description,
      og_image_url:   row.og_image_url,
      category_id:    row.category_id ?? null,
      subcategory_id: row.subcategory_id ?? null,
      wilson_score:   row.wilson_score,
    })

    // ── Prefetch: one round trip, and no discovery state written (issue #122) ─
    // roam_prefetch sets a transaction-local flag, so its nested roam() calls
    // return rows without touching seen_urls or a domain cooldown, and it loops
    // server-side so a batch costs one call instead of `count`. The clients call
    // mark_url_seen when a buffered URL actually reaches the screen — that is the
    // only place that state should be created for a prefetched URL.
    if (isPrefetch) {
      const { data, error } = await supabase.rpc('roam_prefetch', {
        p_user_id: user.id,
        p_count: count,
        p_exclude_domains: (rpcParams.p_exclude_domains as string[] | undefined) ?? null,
        p_category_id: categoryId,
        p_subcategory_id: subcategoryId,
      })
      if (error) {
        const pgError = error as { code?: string; message?: string; details?: string }
        const errCode = pgError.code ?? 'unknown'
        console.error('roam_prefetch RPC error', JSON.stringify({
          code: errCode,
          message: pgError.message ?? '',
          details: pgError.details ?? '',
        }))
        await report(new Error(`roam_prefetch RPC error ${errCode}: ${pgError.message ?? ''}`), 'error', {
          pg_code: errCode,
          pg_details: pgError.details ?? '',
        })
        recordFailure()
        // Same contract the sequential loop produced when every call failed: the
        // client stops filling this tick and retries on the next one.
        return json({ error: 'No more URLs to discover', exhausted: true }, 404)
      }
      recordSuccess()
      for (const row of Array.isArray(data) ? data : []) {
        const entry = row as Record<string, unknown>
        const id = entry.id
        if (typeof id !== 'string' || seenIds.has(id)) continue
        seenIds.add(id)
        results.push(toEntry(entry))
      }
    } else {
      // ── Serve path: sequential, so a slow user cannot fill the pool ─────────
      for (let i = 0; i < count; i++) {
        const { data, error } = await supabase.rpc('roam', rpcParams)
        if (error) {
          const pgError = error as { code?: string; message?: string; details?: string }
          const errCode = pgError.code ?? 'unknown'
          const errMsg = pgError.message ?? ''
          const errDetails = pgError.details ?? ''
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

        results.push(toEntry(row as Record<string, unknown>))
      }
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
            // update_streak is RETURNS TABLE, so the client hands back an array of
            // rows. Reading the fields off the array logged "undefined days" for a
            // streak that had in fact been updated.
            const { data, error } = result as {
              data?: Array<{ streak_days?: number; max_streak?: number; is_streak_broken?: boolean }>
              error?: { message?: string } | null
            }
            if (error) console.error('streak update failed:', error.message)
            const row = data?.[0]
            if (row) {
              console.log(
                `streak updated: ${row.streak_days} days (best: ${row.max_streak}, broken: ${row.is_streak_broken ?? false})`
              )
            }
          } catch (e) {
            console.error('streak update failed', e)
          }
          try {
            // supabase-js reports an RPC failure in `error` rather than throwing, so
            // an unchecked call fails silently and no log line is the only symptom.
            const { error } = await supabase.rpc('award_xp', {
              p_user_id: user.id,
              p_action: 'roam',
              p_metadata: { url_id: firstRow.id },
              p_idempotency_key: idemKey,
            })
            if (error) console.error('xp award failed:', error.message)
          } catch (e) {
            console.error('xp award failed', e)
          }
        })()
      )

      // Track roam action in user_actions (triggers challenge progress)
      EdgeRuntime.waitUntil(
        (async () => {
          try {
            const svcClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
              auth: { persistSession: false },
            })
            await svcClient.from("user_actions").insert({
              user_id: user.id,
              action_type: "roam",
              metadata: { url_id: firstRow.id }
            })
          } catch (e) {
            console.error('user_actions insert failed', e)
          }
        })()
      )
    }

    // Fold the current user's ratings into the response so the Android deck can
    // render the thumbs keys already "pressed in" when the user revisits a URL
    // they previously rated. One query covers both the single-URL and batch
    // (prefetch) paths.
    let responseBody: unknown = results
    try {
      const ids = results.map((r) => (r as Record<string, unknown>).id as string)
      const ratingMap = new Map<string, number>()
      if (ids.length > 0) {
        const { data: ratingRows } = await supabase
          .from('ratings')
          .select('url_id, value')
          .eq('user_id', user.id)
          .in('url_id', ids)
        if (Array.isArray(ratingRows)) {
          for (const row of ratingRows) {
            const r = row as { url_id?: string; value?: number }
            if (r && typeof r.url_id === 'string' && typeof r.value === 'number') {
              ratingMap.set(r.url_id, r.value)
            }
          }
        }
      }
      const withRatings = results.map((entry) => ({
        ...entry,
        user_rating: ratingMap.get((entry as Record<string, unknown>).id as string) ?? 0,
      }))
      responseBody = count === 1 && withRatings.length === 1 ? withRatings[0] : withRatings
    } catch (e) {
      console.error('user rating lookup failed', e)
      responseBody = count === 1 && results.length === 1 ? results[0] : results
    }

    return json(responseBody, 200, { 'Cache-Control': 'private, max-age=5' })
  } catch (e) {
    console.error('roam handler uncaught error', e)
    await report(e, 'error', { handler: 'roam' })
    return json({ error: 'Discovery failed. Please try again.', retryable: true }, 503)
  }
})
