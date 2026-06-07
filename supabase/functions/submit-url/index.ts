// POST /functions/v1/submit-url
// Body: { url: string, title?: string, description?: string, subcategory_id?: string }
// Rate limit: 10 submissions per user per hour (429 if exceeded).
// Safe Browsing check: auto-rejects flagged URLs (422).
// Approved URLs move to the moderation queue for admin review.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { normalizeUrl } from '../_shared/normalise.ts'
import { validateRequired } from '../_shared/env.ts'

const RATE_LIMIT = 10

// Validate required environment variables at startup
const env = validateRequired([
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SAFE_BROWSING_API_KEY',
])
const SAFE_BROWSING_API_KEY = env.SAFE_BROWSING_API_KEY

async function checkSafeBrowsing(url: string, apiKey: string): Promise<{ safe: boolean; error?: string }> {
  try {
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

    // Check for HTTP-level errors from the Safe Browsing API
    if (!res.ok) {
      const errorBody = await res.text()
      console.error(`Safe Browsing API error: ${res.status} ${res.statusText}`, { url, status: res.status, body: errorBody.slice(0, 200) })
      return {
        safe: false,
        error: `Safe Browsing API returned ${res.status}; service may be temporarily unavailable`,
      }
    }

    const data = await res.json()
    // Empty or absent matches array means the URL is clean
    const isSafe = !data.matches || data.matches.length === 0
    return { safe: isSafe }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('Safe Browsing API network error', { url, error: errorMsg })
    return {
      safe: false,
      error: `Network error contacting Safe Browsing API: ${errorMsg}`,
    }
  }
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

  let body: { url?: unknown; title?: unknown; description?: unknown; category_id?: unknown; subcategory_id?: unknown }
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const { url: rawUrl, title, description, category_id, subcategory_id } = body
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

  // ── Duplicate check ───────────────────────────────────────────────────────
  // Bail out early if the URL is already in the catalog (approved, pending,
  // or retired) or already waiting in the moderation queue. The user sees a
  // clear "already in our database" notice instead of a vague success.
  // Service-role client is needed because regular users can't read other
  // submitters' moderation_queue rows or unapproved urls.
  const adminUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const adminClient = adminUrl && serviceKey ? createClient(adminUrl, serviceKey) : supabase

  const { data: existingUrl, error: existingUrlErr } = await adminClient
    .from('urls')
    .select('id, approved, inactive')
    .eq('url', normalized)
    .maybeSingle()
  if (existingUrlErr) {
    console.error('duplicate url lookup failed', existingUrlErr)
    return json({ error: 'Internal error' }, 500)
  }
  if (existingUrl) {
    return json(
      {
        duplicate: true,
        message: existingUrl.approved && !existingUrl.inactive
          ? "This URL is already in our database."
          : "This URL has already been submitted.",
      },
      409,
    )
  }

  const { data: existingQueue, error: existingQueueErr } = await adminClient
    .from('moderation_queue')
    .select('id, status')
    .eq('url', normalized)
    .in('status', ['pending', 'approved'])
    .maybeSingle()
  if (existingQueueErr) {
    console.error('duplicate queue lookup failed', existingQueueErr)
    return json({ error: 'Internal error' }, 500)
  }
  if (existingQueue) {
    return json(
      { duplicate: true, message: "This URL is already pending review." },
      409,
    )
  }

  // ── Safe Browsing check ───────────────────────────────────────────────────
  // The API key is verified at boot above. Safe Browsing failures (network,
  // quota, API errors) return 503. Detections (malicious URL) return 422.
  const sbResult = await checkSafeBrowsing(normalized, SAFE_BROWSING_API_KEY)
  
  if (sbResult.error) {
    console.warn('Safe Browsing API unavailable', { url: normalized, error: sbResult.error })
    return json(
      { error: 'Safe Browsing check temporarily unavailable — please try again shortly' },
      503,
    )
  }

  if (!sbResult.safe) {
    return json(
      { error: "This URL couldn't be submitted — it may be flagged for safety reasons" },
      422,
    )
  }

  // ── Ensure profile row exists ─────────────────────────────────────────────
  // moderation_queue.submitted_by references profiles(id) via FK. If the user
  // doesn't have a profiles row yet (new sign-up who hasn't visited Profile
  // screen), the insert below would fail with FK violation: "insert or update
  // on table \"moderation_queue\" violates foreign key constraint
  // \"moderation_queue_submitted_by_fkey\"" (ROAM-ANDROID-5).
  // Upsert a minimal profile row first to satisfy the FK.
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: user.id,
    // Use email prefix or a generated username as fallback
    username: user.email?.split('@')[0] ?? `user_${user.id.slice(0, 8)}`,
    display_name: user.user_metadata?.full_name ?? null,
  }, { onConflict: 'id' })

  if (profileError) {
    console.error('Failed to upsert profile row for FK', { userId: user.id, error: profileError })
    return json({ error: 'Internal error' }, 500)
  }

  // ── Insert into moderation queue ──────────────────────────────────────────
  // category_id is a top-level category UUID hint from the submitter.
  // moderation_queue has no category_id column, so we store it as reviewer_note
  // so admins can see the submitter's suggested category.
  const categoryHint = typeof category_id === 'string' && category_id
    ? `category_hint:${category_id}`
    : null

  const validSubcategoryId = typeof subcategory_id === 'string' && subcategory_id ? subcategory_id : null

  const { error: insertError } = await supabase.from('moderation_queue').insert({
    url: normalized,
    title: typeof title === 'string' ? title : null,
    description: typeof description === 'string' ? description : null,
    subcategory_id: validSubcategoryId,
    submitted_by: user.id,
    safe_browsing_passed: true,
    status: 'pending',
    ...(categoryHint ? { reviewer_note: categoryHint } : {}),
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