// POST /functions/v1/submit-url
// Body: { url: string, title?: string, description?: string, subcategory_id?: string }
// Rate limit: 10 submissions per user per hour (429 if exceeded).
// Safe Browsing check: auto-rejects flagged URLs (422).
// Approved URLs move to the moderation queue for admin review.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { normalizeUrl } from '../_shared/normalise.ts'
import { validateRequired } from '../_shared/env.ts'
import { initSentry } from '../_shared/sentry.ts'

const RATE_LIMIT = 10

// Sentry reporting — silently disabled if SENTRY_DSN is not set
const report = initSentry('submit-url')

// Validate required environment variables at startup.
// SAFE_BROWSING_API_KEY is optional — if missing, Safe Browsing checks are skipped.
const env = validateRequired([
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
])
const SAFE_BROWSING_API_KEY = Deno.env.get('SAFE_BROWSING_API_KEY') || null
if (!SAFE_BROWSING_API_KEY) {
  console.warn('[submit-url] SAFE_BROWSING_API_KEY not configured — Safe Browsing checks will be skipped')
}

async function checkSafeBrowsing(url: string, apiKey: string): Promise<{ safe: boolean; error?: string }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8_000) // 8s timeout to stay under Supabase's ~10s limit

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
        signal: controller.signal,
      },
    )
    clearTimeout(timeoutId)

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
    clearTimeout(timeoutId)
    const errorMsg = err instanceof Error ? err.message : String(err)
    // DOMException with name 'AbortError' means our timeout fired — the API didn't
    // respond in time. Gracefully degrade: log a warning and allow submission through
    // rather than blocking with a 503 that propagates as a 504 to the client.
    const isTimeout = err instanceof DOMException && err.name === 'AbortError'
    const logLevel = isTimeout ? 'warn' : 'error'
    console[logLevel](`Safe Browsing API fetch failed: ${errorMsg}`, { url, timeout: isTimeout })
    if (!isTimeout) {
      report(err, 'error', { url, api: 'safe-browsing' })
    }
    return {
      safe: false,
      error: isTimeout
        ? undefined  // timeout → graceful degradation, allow submission
        : `Network error contacting Safe Browsing API: ${errorMsg}`,
    }
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(origin) })
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

  if (countError) {
    report(countError.message, 'error', { operation: 'rate-limit-check' })
    return json({ error: 'Internal error' }, 500)
  }
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
    report(existingUrlErr.message, 'error', { url: normalized, operation: 'duplicate-url-lookup' })
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
    report(existingQueueErr.message, 'error', { url: normalized, operation: 'duplicate-queue-lookup' })
    return json({ error: 'Internal error' }, 500)
  }
  if (existingQueue) {
    return json(
      { duplicate: true, message: "This URL is already pending review." },
      409,
    )
  }

  // ── Safe Browsing check ───────────────────────────────────────────────────
  // Skip if the API key is not configured.
  if (SAFE_BROWSING_API_KEY) {
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
  }

  // ── Ensure profile row exists ─────────────────────────────────────────────
  // moderation_queue.submitted_by references profiles(id) via FK. If the user
  // doesn't have a profiles row yet (new sign-up who hasn't visited Profile
  // screen), the insert below would fail with FK violation: "insert or update
  // on table \"moderation_queue\" violates foreign key constraint
  // \"moderation_queue_submitted_by_fkey\"" (ROAM-ANDROID-5).
  //
  // IMPORTANT: Only INSERT a minimal row if one doesn't already exist. Never
  // overwrite an existing profile — the user may have set a custom username
  // or display_name through the Profile screen. Using upsert with onConflict
  // would silently clobber those values on every submission.
  const { data: existingProfile, error: profileLookupErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileLookupErr) {
    console.error('Failed to lookup profile row for FK', { userId: user.id, error: profileLookupErr })
    report(profileLookupErr.message, 'error', { userId: user.id, operation: 'profile-lookup' })
    return json({ error: 'Internal error' }, 500)
  }

  if (!existingProfile) {
    // No profile row yet — insert a minimal one to satisfy the FK.
    // Username generation may fail if another user already has this prefix;
    // try an alternative to avoid a unique violation 500.
    const baseUsername = user.email?.split('@')[0] ?? `user_${user.id.slice(0, 8)}`
    const { error: insertProfileErr } = await supabase.from('profiles').insert({
      id: user.id,
      username: baseUsername,
      display_name: user.user_metadata?.full_name ?? null,
    })
    // If the base username is taken, the insert will fail with a unique
    // constraint violation. This is rare (another user with the same email
    // prefix), but we handle it gracefully by using a UUID-based fallback
    // so the submission can proceed.
    if (insertProfileErr) {
      if (insertProfileErr.message.includes('profiles_username_key') || insertProfileErr.message.includes('unique')) {
        const { error: retryErr } = await supabase.from('profiles').insert({
          id: user.id,
          username: `user_${user.id.slice(0, 8)}`,
          display_name: user.user_metadata?.full_name ?? null,
        })
        if (retryErr) {
          console.error('Failed to insert profile row with fallback username', { userId: user.id, error: retryErr })
          report(retryErr.message, 'error', { userId: user.id, operation: 'profile-insert-fallback' })
          return json({ error: 'Internal error' }, 500)
        }
      } else {
        console.error('Failed to insert profile row for FK', { userId: user.id, error: insertProfileErr })
        report(insertProfileErr.message, 'error', { userId: user.id, operation: 'profile-insert' })
        return json({ error: 'Internal error' }, 500)
      }
    }
  }

  // ── Insert into moderation queue ──────────────────────────────────────────
  // category_id is a top-level category UUID hint from the submitter.
  // moderation_queue has no category_id column, so we store it as reviewer_note
  // so admins can see the submitter's suggested category.
  const categoryHint = typeof category_id === 'string' && category_id
    ? `category_hint:${category_id}`
    : null

  const validSubcategoryId = typeof subcategory_id === 'string' && subcategory_id ? subcategory_id : null

  // Moderators and admins get their submissions auto-approved
  const isTrusted = (user.app_metadata?.role === 'admin' || user.app_metadata?.role === 'moderator')
  const submissionStatus = isTrusted ? 'approved' : 'pending'

  const { error: insertError } = await supabase.from('moderation_queue').insert({
    url: normalized,
    title: typeof title === 'string' ? title : null,
    description: typeof description === 'string' ? description : null,
    subcategory_id: validSubcategoryId,
    submitted_by: user.id,
    safe_browsing_passed: true,
    status: submissionStatus,
    reviewed_by: isTrusted ? user.id : null,
    ...(categoryHint ? { reviewer_note: categoryHint } : {}),
  })

  // For trusted users, immediately upsert into the live catalog
  if (!insertError && isTrusted) {
    const adminClient2 = adminUrl && serviceKey ? createClient(adminUrl, serviceKey) : supabase
    await adminClient2.from('urls').upsert(
      {
        url: normalized,
        original_url: normalized,
        approved: true,
        title: typeof title === 'string' ? title : null,
        description: typeof description === 'string' ? description : null,
        subcategory_id: validSubcategoryId,
      },
      { onConflict: 'url' },
    )

    // Fire-and-forget: notify the submitter that their URL is live since it
    // was auto-approved. The submit-url trigger only fires on UPDATE from
    // pending→approved, but trusted users insert directly as 'approved'.
    const shortTitle = (typeof title === 'string' && title)
      ? title.length > 60 ? title.slice(0, 57) + '...' : title
      : normalized.length > 60 ? normalized.slice(0, 57) + '...' : normalized
    adminClient2
      .from('notifications')
      .insert({
        user_id: user.id,
        type: 'url_approved',
        title: '✅ Your submission was approved!',
        body: `"${shortTitle}" is now live on Roam.`,
        data: { url: normalized },
      })
      .then(
        () => { console.log('[submit-url] Notification sent to trusted submitter:', user.id) },
        (e: unknown) => { console.error('[submit-url] Failed to notify trusted submitter:', e) }
      )
  }

  if (insertError) {
    report(insertError.message, 'error', { url: normalized, operation: 'moderation-insert' })
    return json({ error: insertError.message }, 500)
  }

  // ── Gamification: Fire-and-forget XP + badge evaluation ──────────────────
  // Chain award_xp → evaluate_badges as plain Promise chains so Deno does NOT
  // keep the HTTP/2 connection open after the response is sent.
  // (setTimeout kept the isolate alive 500ms post-response, causing Supabase's
  // proxy to reset the HTTP/2 connection → OkHttp "unexpected end of stream".)

  // Record today's activity so the user's streak is maintained
  supabase.rpc('record_daily_activity', { p_user_id: user.id }).then(
    () => {},
    (e: unknown) => { console.error('record_daily_activity failed (submit-url)', e) }
  )

  supabase.rpc('award_xp', { p_user_id: user.id, p_action: 'submit_url', p_metadata: { url: normalized } })
    .then(
      () => supabase.rpc('evaluate_badges', { p_user_id: user.id }),
      (e: unknown) => { console.error('xp award failed (submit-url)', e) }
    )
    .then(
      () => {},
      (e: unknown) => { console.error('badge evaluation failed (submit-url)', e) }
    )

  return json({ ok: true, message: 'URL submitted for review' }, 201)
})

function json(body: unknown, status = 200, responseHeaders?: Record<string, string>) {
  const h = responseHeaders ?? getCorsHeaders(null);
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...h, 'Content-Type': 'application/json' },
  })
}
