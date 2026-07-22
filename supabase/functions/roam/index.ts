// POST /functions/v1/roam
// Body (optional): { collection_id?, exclude_domain?, category_id?, subcategory_id? }
// Returns a single URL row, or 404 when pool is exhausted.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
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
    const { data, error } = await supabase.rpc('roam', rpcParams)
    if (error) {
      console.error('roam RPC error', error.code, error.message)
      // PostgreSQL statement_timeout (57014) or query_canceled (57P01).
      // Also check message text as a fallback — supabase-js sometimes omits code
      // for connection-level timeouts coming through the PostgREST proxy.
      const isTimeout = error.code === '57014' || error.code === '57P01'
        || error.message?.toLowerCase().includes('timeout')
        || error.message?.toLowerCase().includes('canceling statement')
        || error.message?.toLowerCase().includes('query_canceled')
      if (isTimeout) {
        return json({ error: 'Discovery timed out. Please try again.' }, 503)
      }
      return json({ error: 'Discovery failed. Please try again.' }, 500)
    }
    const row = Array.isArray(data) ? data[0] : null
    if (!row) {
      return json({ error: 'No more URLs to discover' }, 404)
    }

    // ── Gamification: Fire-and-forget async calls ─────────────────────
    // Run streak update, XP award, and badge evaluation in parallel
    // but don't block the response. Ignore failures — gamification is
    // non-critical for the core roam experience.
    const roamResult = {
      id:             row.id,
      url:            row.url,
      title:          row.title,
      description:    row.description,
      og_image_url:   row.og_image_url,
      category_id:    row.category_id ?? null,
      subcategory_id: row.subcategory_id ?? null,
      wilson_score:   row.wilson_score,
    }

    // ── Gamification: Fire-and-forget async calls ──────────────────────────
    // Run streak update, XP award, and badge evaluation in parallel
    // but don't block the response. Ignore failures — gamification is
    // non-critical for the core roam experience.
    //
    // IMPORTANT: do NOT use setTimeout here. A pending setTimeout keeps the Deno
    // Deploy isolate alive for an extra 500 ms after the Response is returned,
    // during which Supabase's edge proxy can reset the HTTP/2 connection, causing
    // OkHttp on Android to throw "unexpected end of stream" even though the
    // response body was already fully sent. Chained .then() promises avoid this.
    //
    // Skip gamification when this is a prefetch call (prefetch=true in body) so
    // the Android prefill queue doesn't award infinite XP in the background.
    const isPrefetch = body.prefetch === true

    if (!isPrefetch) {
      // Idempotency key prevents double-awarding XP for the same URL+user within
      // the same minute — handles retries and race conditions.
      const idemKey = `roam:${row.id}:${user.id}:${Math.floor(Date.now() / 60000)}`

      // Record daily activity and update streak — fire-and-forget but log errors.
      // Uses update_streak directly (not record_daily_activity) because roam
      // should increment the daily roam_count counter on user_daily_activity.
      supabase.rpc('update_streak', { p_user_id: user.id }).then(
        (result: unknown) => {
          const r = result as { data?: { streak_days?: number; max_streak?: number; is_streak_broken?: boolean } }
          if (r?.data) {
            console.log(
              `streak updated: ${r.data.streak_days} days (best: ${r.data.max_streak}, broken: ${r.data.is_streak_broken ?? false})`
            )
          }
        },
        (e: unknown) => { console.error('streak update failed', e) }
      )
      // Award XP for the roam. Badge evaluation is no longer chained here —
      // it runs on-demand via the profile/badges pages instead, saving 15+
      // COUNT(*) queries per roam press. Errors are logged but never bubble up.
      supabase.rpc('award_xp', {
        p_user_id: user.id,
        p_action: 'roam',
        p_metadata: { url_id: row.id },
        p_idempotency_key: idemKey,
      })
        .then(
          () => {},
          (e: unknown) => { console.error('xp award failed', e) }
        )
    }

    return json(roamResult)
  } catch (e) {
    console.error('roam handler uncaught error', e)
    return json({ error: 'Discovery failed. Please try again.' }, 500)
  }
})
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}