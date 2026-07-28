// POST /functions/v1/roam
// Body (optional): { collection_id?, exclude_domain?, category_id?, subcategory_id? }
// Returns a single URL row, or 404 when pool is exhausted.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// EdgeRuntime.waitUntil is a Deno Deploy API that tells the runtime to not
// wait for a promise before shutting down the isolate. It's available at
// runtime on Supabase-hosted edge functions but not declared in the Deno
// type definitions used by deno check in CI.
declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void }

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
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
    // ── Batch discovery ────────────────────────────────────────────────────────
    // When count > 1, call the RPC multiple times and return an array.
    // This amortizes the auth + cold-start overhead for prefetch consumers.
    const results: Array<Record<string, unknown>> = []
    const seenIds = new Set<string>()
    const isPrefetch = body.prefetch === true
    let timedOut = false

    for (let i = 0; i < count; i++) {
      const { data, error } = await supabase.rpc('roam', rpcParams)
      if (error) {
        console.error('roam RPC error', error.code, error.message)
        const isTimeout = error.code === '57014' || error.code === '57P01'
          || error.message?.toLowerCase().includes('timeout')
          || error.message?.toLowerCase().includes('canceling statement')
          || error.message?.toLowerCase().includes('query_canceled')
        if (isTimeout) {
          timedOut = true
          break
        }
        // Non-timeout errors on batch calls are terminal for this loop
        if (count > 1) break
        return json({ error: 'Discovery failed. Please try again.' }, 500)
      }
      const row = Array.isArray(data) ? data[0] : null
      if (!row) break // pool exhausted

      // Deduplicate within the batch (RPC can occasionally return the same URL)
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
      return json({ error: 'Discovery timed out. Please try again.' }, 503)
    }
    if (results.length === 0) {
      return json({ error: 'No more URLs to discover' }, 404)
    }

    // ── Gamification: Fire-and-forget (only for non-prefetch, first result only) ─
    // Gamification is awarded once per user-initiated roam, not per batch entry.
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
    }

    // Return single object for count=1 (backward compat), array for count>1
    return json(count === 1 ? results[0] : results, 200, { 'Cache-Control': 'private, max-age=5' })
  } catch (e) {
    console.error('roam handler uncaught error', e)
    return json({ error: 'Discovery failed. Please try again.' }, 500)
  }
})
function json(body: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  })
}
