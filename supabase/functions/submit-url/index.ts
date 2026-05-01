// POST /functions/v1/submit-url
// Body: { url: string, title?: string, description?: string, subcategory_id?: string }
// Rate limit: 10 submissions per user per hour (429 if exceeded).
// Safe Browsing check: auto-rejects flagged URLs (422).
// Approved URLs move to the moderation queue for admin review.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { normalizeUrl } from '../_shared/normalise.ts'

const RATE_LIMIT = 10

// Fail fast at boot if the Safe Browsing key is missing — prevents a
// misconfigured deploy from silently accepting unscreened URL submissions.
const SAFE_BROWSING_API_KEY = Deno.env.get('SAFE_BROWSING_API_KEY')
if (!SAFE_BROWSING_API_KEY) {
  throw new Error(
    'SAFE_BROWSING_API_KEY environment variable is required for submit-url',
  )
}

async function checkSafeBrowsing(url: string, apiKey: string): Promise<boolean> {
  const res = await fetch(
    `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: { clientId: 'roam', clientVersion: '1.0' },
        threatInfo: {
          threatTypes: [
            'MALWARE',
            'SOCIAL_ENGINEERING',
            'UNWANTED_SOFTWARE',
            'POTENTIALLY_HARMFUL_APPLICATION',
          ],
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url }],
        },
      }),
    },
  )
  const data = await res.json()
  // Empty or absent matches array means the URL is clean
  return !data.matches || data.matches.length === 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  let body: { url?: unknown; title?: unknown; description?: unknown; subcategory_id?: unknown; language?: unknown }
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const { url: rawUrl, title, description, subcategory_id, language } = body
  if (typeof rawUrl !== 'string' || !rawUrl) {
    return json({ error: 'url is required' }, 400)
  }

  let normalized: string
  try {
    normalized = normalizeUrl(rawUrl)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Invalid URL' }, 400)
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count, error: countError } = await supabase
    .from('moderation_queue')
    .select('*', { count: 'exact', head: true })
    .eq('submitted_by', user.id)
    .gte('created_at', oneHourAgo)

  if (countError) return json({ error: 'Internal error' }, 500)
  if ((count ?? 0) >= RATE_LIMIT) {
    return json({ error: 'Rate limit exceeded — max 10 submissions per hour' }, 429)
  }

  // ── Safe Browsing check ───────────────────────────────────────────────────
  // The API key is verified at boot above; if the call itself fails (network,
  // quota, transient 5xx) we reject the submission rather than letting it
  // through unscreened. Better to surface a 503 than approve a malicious URL.
  let safeBrowsingPassed: boolean
  try {
    safeBrowsingPassed = await checkSafeBrowsing(normalized, SAFE_BROWSING_API_KEY)
  } catch {
    return json(
      { error: 'Safe Browsing check unavailable — please try again shortly' },
      503,
    )
  }

  if (!safeBrowsingPassed) {
    return json(
      { error: "This URL couldn't be submitted — it may be flagged for safety reasons" },
      422,
    )
  }

  // ── Insert into moderation queue ──────────────────────────────────────────
  const { error: insertError } = await supabase.from('moderation_queue').insert({
    url: normalized,
    title: typeof title === 'string' ? title : null,
    description: typeof description === 'string' ? description : null,
    subcategory_id: typeof subcategory_id === 'string' ? subcategory_id : null,
    language: typeof language === 'string' && language ? language : 'en',
    submitted_by: user.id,
    safe_browsing_passed: safeBrowsingPassed,
    status: 'pending',
  })

  if (insertError) return json({ error: insertError.message }, 500)
  return json({ ok: true, message: 'URL submitted for review' }, 201)
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
