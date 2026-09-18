// POST /functions/v1/scrape-url
// Moderator-only. Fetches OG metadata for a URL and inserts it directly into
// the urls table with approved=true, bypassing the moderation queue.
//
// Body:
//   url: string              — required
//   category_ids?: string[]  — up to 2 pillar UUIDs (first is primary for roam() compat)
//   subcategory_id?: string  — primary subcategory UUID (kept for roam() compat)
//   tags?: string[]          — freeform semantic tags, normalized to slug form
//
// Returns: { id, url, title, description, og_image_url, language, tags, category_ids }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { normalizeUrl } from '../_shared/normalise.ts'
import { validateRequired } from '../_shared/env.ts'
import { initSentry } from '../_shared/sentry.ts'

const report = initSentry('scrape-url')

validateRequired(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY'])

const SAFE_BROWSING_API_KEY = Deno.env.get('SAFE_BROWSING_API_KEY') || null
const OG_TIMEOUT_MS = 10_000

/** Normalize a raw tag to a lowercase hyphenated slug */
function normalizeTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function fetchOgMeta(url: string) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), OG_TIMEOUT_MS)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Roam-Seeder/1.0 (+https://roamtheweb.app)' },
      redirect: 'follow',
    })

    clearTimeout(timer)
    if (!res.ok) return { title: null, description: null, image: null, language: null, canonical: null }

    const html = await res.text()

    const ogTitle  = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim()
                  ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()
                  ?? null
    const ogImg    = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim()
                  ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1]?.trim()
                  ?? html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim()
                  ?? null
    const ogDesc   = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim()
                  ?? html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim()
                  ?? null
    const langMatch = html.match(/<html[^>]+lang=["']([^"']+)["']/i)
    const language  = langMatch?.[1]?.trim().toLowerCase().split(/[-_]/)[0] ?? null
    const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]?.trim() ?? null

    return {
      title: ogTitle,
      description: ogDesc ? ogDesc.slice(0, 500) : null,
      image: ogImg,
      language,
      canonical,
    }
  } catch {
    return { title: null, description: null, image: null, language: null, canonical: null }
  }
}

async function checkSafeBrowsing(url: string, apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: { clientId: 'roam', clientVersion: '1.0' },
          threatInfo: {
            threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: [{ url }],
          },
        }),
      },
    )
    if (!res.ok) return true // if API fails, allow through
    const data = await res.json()
    return !data.matches || data.matches.length === 0
  } catch {
    return true // network error → allow through
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // Auth — verify the caller is a signed-in moderator or admin
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  const role = (user.app_metadata as Record<string, unknown>)?.role
  if (role !== 'admin' && role !== 'moderator') return json({ error: 'Forbidden' }, 403)

  let body: { url?: unknown; category_ids?: unknown; subcategory_id?: unknown; tags?: unknown }
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const { url: rawUrl, category_ids, subcategory_id, tags: rawTags } = body
  if (typeof rawUrl !== 'string' || !rawUrl) return json({ error: 'url is required' }, 400)

  // Validate category_ids — array of up to 2 UUIDs; first is the primary
  const categoryIds: string[] = Array.isArray(category_ids)
    ? (category_ids as unknown[]).filter((id): id is string => typeof id === 'string' && id.length > 0).slice(0, 2)
    : []
  const primaryCategoryId = categoryIds[0] ?? null
  const primarySubcategoryId = typeof subcategory_id === 'string' && subcategory_id ? subcategory_id : null

  // Normalize tags — dedupe and filter empty
  const tags: string[] = Array.isArray(rawTags)
    ? [...new Set((rawTags as unknown[]).filter((t): t is string => typeof t === 'string').map(normalizeTag).filter((t) => t.length > 0))]
    : []

  let normalized: string
  try { normalized = normalizeUrl(rawUrl) } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Invalid URL' }, 400)
  }

  // Safe Browsing check
  if (SAFE_BROWSING_API_KEY) {
    const safe = await checkSafeBrowsing(normalized, SAFE_BROWSING_API_KEY)
    if (!safe) return json({ error: "URL flagged by Safe Browsing — cannot add" }, 422)
  }

  // Service-role client for DB writes
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Duplicate check
  const { data: existing } = await admin.from('urls').select('id, approved').eq('url', normalized).maybeSingle()
  if (existing) {
    return json({ error: existing.approved ? 'URL already in the pool' : 'URL exists but is not approved' }, 409)
  }

  // Fetch OG metadata
  const meta = await fetchOgMeta(normalized)

  // Determine canonical URL to store
  const finalUrl = meta.canonical && meta.canonical.startsWith('http') ? meta.canonical : normalized

  // Insert URL row
  const { data: inserted, error: insertError } = await admin.from('urls').insert({
    url: finalUrl,
    original_url: normalized,
    title: meta.title,
    description: meta.description,
    og_image_url: meta.image,
    language: meta.language,
    category_id: primaryCategoryId,
    subcategory_id: primarySubcategoryId,
    approved: true,
    source: 'moderator_scrape',
    submitted_by: user.id,
  }).select('id, url, title, description, og_image_url, language').single()

  if (insertError) {
    report(insertError.message, 'error', { url: normalized, operation: 'scrape-url-insert' })
    return json({ error: insertError.message }, 500)
  }

  const urlId = inserted.id

  // Insert url_categories (all pillars, fire-and-forget — non-fatal on error)
  if (categoryIds.length > 0) {
    await admin.from('url_categories').insert(categoryIds.map((cid) => ({ url_id: urlId, category_id: cid })))
  }

  // Insert url_tags (fire-and-forget)
  if (tags.length > 0) {
    await admin.from('url_tags').insert(tags.map((tag) => ({ url_id: urlId, tag, tagged_by: user.id })))
  }

  return json({ success: true, data: { ...inserted, tags, category_ids: categoryIds } })
})
