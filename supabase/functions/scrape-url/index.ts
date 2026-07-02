// POST /functions/v1/scrape-url
// Moderator-only. Fetches OG metadata for a URL and inserts it directly into
// the urls table with approved=true, bypassing the moderation queue.
//
// Body: { url: string, subcategory_id?: string, category_id?: string }
// Returns: { url, title, description, og_image_url, language, id }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { normalizeUrl } from '../_shared/normalise.ts'
import { validateRequired } from '../_shared/env.ts'
import { initSentry } from '../_shared/sentry.ts'

const report = initSentry('scrape-url')

validateRequired(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY'])

const SAFE_BROWSING_API_KEY = Deno.env.get('SAFE_BROWSING_API_KEY') || null
const OG_TIMEOUT_MS = 10_000

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

  let body: { url?: unknown; category_id?: unknown; subcategory_id?: unknown }
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const { url: rawUrl, category_id, subcategory_id } = body
  if (typeof rawUrl !== 'string' || !rawUrl) return json({ error: 'url is required' }, 400)

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

  // Insert into urls table
  const { data: inserted, error: insertError } = await admin.from('urls').insert({
    url: finalUrl,
    original_url: normalized,
    title: meta.title,
    description: meta.description,
    og_image_url: meta.image,
    language: meta.language,
    category_id: typeof category_id === 'string' && category_id ? category_id : null,
    subcategory_id: typeof subcategory_id === 'string' && subcategory_id ? subcategory_id : null,
    approved: true,
    source: 'moderator_scrape',
    submitted_by: user.id,
  }).select('id, url, title, description, og_image_url, language').single()

  if (insertError) {
    report(insertError.message, 'error', { url: normalized, operation: 'scrape-url-insert' })
    return json({ error: insertError.message }, 500)
  }

  return json({ success: true, data: inserted })
})
