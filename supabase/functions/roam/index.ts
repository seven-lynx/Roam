// POST /functions/v1/roam
// Discovery endpoint: returns a single URL the user hasn't seen yet.
// Uses the roam_v35 RPC which hoists domain checks into SQL for speed.
//
// Query params:
//   collection_id  — filter to a specific collection
//   exclude_domain — skip URLs from this domain
//   category_id    — focus mode: only this category
//   subcategory_id — focus mode: only this subcategory
//   count          — batch size (default 1, max 10)
//   prefetch       — if "true", skips seen_urls recording, XP, and streak

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!

// ── In-memory circuit breaker ──────────────────────────────────────────
// If the RPC throws ≥3 consecutive errors within 60 s we short-circuit
// subsequent calls for 30 s to avoid hammering the DB during an outage.
let consecutiveFails = 0
let lastFailTime = 0
const CIRCUIT_OPEN_SEC = 30
const CIRCUIT_TRIP_COUNT = 3
const CIRCUIT_WINDOW_MS = 60_000

function isCircuitOpen(): boolean {
  if (consecutiveFails < CIRCUIT_TRIP_COUNT) return false
  const elapsed = Date.now() - lastFailTime
  if (elapsed > CIRCUIT_WINDOW_MS) {
    consecutiveFails = 0
    return false
  }
  return (Date.now() - lastFailTime) < CIRCUIT_OPEN_SEC * 1000
}

function recordSuccess() { consecutiveFails = 0 }
function recordFailure() { consecutiveFails++; lastFailTime = Date.now() }

// ── Helpers ────────────────────────────────────────────────────────────

function json(data: unknown, status = 200, extraHeaders?: Record<string, string>) {
  const h: Record<string, string> = { ...corsHeaders, 'Content-Type': 'application/json' }
  if (extraHeaders) Object.assign(h, extraHeaders)
  return new Response(JSON.stringify(data), { status, headers: h })
}

// ── Main handler ───────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabase = createClient(
    SUPABASE_URL,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  // Parse query params
  const url = new URL(req.url)
  const collectionId = url.searchParams.get('collection_id') || undefined
  const excludeDomain = url.searchParams.get('exclude_domain') || undefined
  const categoryId = url.searchParams.get('category_id') || undefined
  const subcategoryId = url.searchParams.get('subcategory_id') || undefined
  const count = Math.min(parseInt(url.searchParams.get('count') || '1', 10) || 1, 10)
  const isPrefetch = url.searchParams.get('prefetch') === 'true'

  // Circuit breaker
  if (isCircuitOpen()) {
    return json({ error: 'Discovery temporarily unavailable. Please try again.' }, 503, { 'Retry-After': '30' })
  }

  try {
    // Call the roam_v35 RPC which handles all filtering in SQL
    const { data: results, error: rpcErr } = await supabase.rpc('roam_v35', {
      p_user_id: user.id,
      p_collection_id: collectionId ?? null,
      p_exclude_domain: excludeDomain ?? null,
      p_category_id: categoryId ?? null,
      p_subcategory_id: subcategoryId ?? null,
      p_count: count,
    })

    if (rpcErr) {
      recordFailure()
      console.error('roam RPC error:', rpcErr.message)
      return json({ error: 'Discovery failed. Please try again.' }, 503)
    }

    if (!results || results.length === 0) {
      recordSuccess()
      return json({ exhausted: true }, 404)
    }

    recordSuccess()

    const firstRow = results[0]

    // Record seen_urls + award XP + update streak (skip for prefetch)
    if (!isPrefetch && results.length > 0) {
      EdgeRuntime.waitUntil(
        (async () => {
          try {
            const svcClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
              auth: { persistSession: false },
            })

            // Record seen URLs
            const seenRows = results.map((r: any) => ({
              user_id: user.id,
              url_id: r.id,
              category_id: r.category_id,
              subcategory_id: r.subcategory_id,
            }))
            await svcClient.from('seen_urls').upsert(seenRows, { onConflict: 'user_id,url_id', ignoreDuplicates: true })

            // Award XP for discovery
            const xpKey = `roam:${user.id}:${new Date().toISOString().slice(0, 10)}`
            const { data: existingXp } = await svcClient
              .from('xp_log')
              .select('id')
              .eq('user_id', user.id)
              .eq('idempotency_key', xpKey)
              .limit(1)

            if (!existingXp || existingXp.length === 0) {
              await svcClient.from('xp_log').insert({
                user_id: user.id,
                action: 'roam',
                xp_awarded: 5,
                idempotency_key: xpKey,
                metadata: { url_id: firstRow.id },
              })

              // Recalculate XP + level
              const { data: xpRows } = await svcClient.from('xp_log').select('xp_awarded').eq('user_id', user.id)
              const newXp = (xpRows ?? []).reduce((s: number, r: any) => s + r.xp_awarded, 0)
              await svcClient.from('profiles').update({
                xp_total: newXp,
                level: Math.floor(Math.sqrt(newXp / 100)) + 1,
              }).eq('id', user.id)
            }

            // Update streak
            const today = new Date().toISOString().slice(0, 10)
            await svcClient.rpc('update_streak', { p_user_id: user.id, p_date: today })

            // Track roam action in user_actions (triggers challenge progress)
            await svcClient.from("user_actions").insert({
              user_id: user.id,
              action_type: "roam",
              metadata: { url_id: firstRow.id, category_id: firstRow.category_id, subcategory_id: firstRow.subcategory_id }
            })
          } catch (e) {
            console.error('post-roam processing failed', e)
          }
        })()
      )
    }

    // Return the first result (or all if count > 1)
    const response = count === 1 ? firstRow : results
    return json(response)
  } catch (e: any) {
    recordFailure()
    console.error('roam error:', e.message)
    return json({ error: 'Discovery failed. Please try again.' }, 500)
  }
})