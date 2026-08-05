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

// Sentry reporting — best-effort, won't block the response
const Sentry = initSentry()

Deno.serve(async (req) => {
  const headers = getCorsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, headers)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const rawUrl = body.url as string | undefined
  const title = (body.title as string) || ''
  const description = (body.description as string) || ''
  const subcategoryId = body.subcategory_id as string | undefined

  if (!rawUrl) return json({ error: 'url required' }, 400)

  const normalizedUrl = normalizeUrl(rawUrl)
  if (!normalizedUrl) return json({ error: 'Invalid URL' }, 400)

  // Rate limit: count submissions in the last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: recentCount, error: countErr } = await supabase
    .from('moderation_queue')
    .select('id', { count: 'exact', head: true })
    .eq('submitted_by', user.id)
    .gte('created_at', oneHourAgo)

  if (countErr) {
    console.error('rate limit check failed:', countErr.message)
    return json({ error: 'Failed to check rate limit' }, 500)
  }

  if (recentCount != null && recentCount >= RATE_LIMIT) {
    return json({ error: `Rate limit exceeded: ${RATE_LIMIT} submissions per hour` }, 429)
  }

  // Safe Browsing check
  try {
    const safeBrowsingKey = Deno.env.get('GOOGLE_SAFE_BROWSING_KEY')
    if (safeBrowsingKey) {
      const sbRes = await fetch(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${safeBrowsingKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client: { clientId: 'roam', clientVersion: '1.0.0' },
            threatInfo: {
              threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
              platformTypes: ['ANY_PLATFORM'],
              threatEntryTypes: ['URL'],
              threatEntries: [{ url: normalizedUrl }],
            },
          }),
        },
      )
      if (sbRes.ok) {
        const sbData = await sbRes.json()
        if (sbData.matches && sbData.matches.length > 0) {
          return json({ error: 'URL flagged by Safe Browsing' }, 422)
        }
      }
    }
  } catch (e) {
    console.error('Safe Browsing check failed:', e)
    // Don't block submission if Safe Browsing is down
  }

  // Check for duplicate
  const { data: existing } = await supabase
    .from('urls')
    .select('id')
    .eq('url', normalizedUrl)
    .maybeSingle()

  if (existing) {
    return json({ error: 'This URL has already been submitted', duplicate: true, url_id: existing.id }, 409)
  }

  // Insert into moderation queue
  const { data: queueEntry, error: insertError } = await supabase
    .from('moderation_queue')
    .insert({
      url: normalizedUrl,
      title: title || normalizedUrl,
      description,
      subcategory_id: subcategoryId || null,
      submitted_by: user.id,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertError || !queueEntry) {
    console.error('moderation queue insert failed:', insertError?.message)
    return json({ error: 'Failed to submit URL' }, 500)
  }

  // Track submit action in user_actions (triggers challenge progress)
  await supabase.from("user_actions").insert({
    user_id: user.id,
    action_type: "submit",
    metadata: { url: normalizedUrl }
  })

  // Gamification: award XP for submission
  EdgeRuntime.waitUntil(
    (async () => {
      try {
        const svcClient = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
          { auth: { persistSession: false } },
        )

        const xpKey = `submit:${user.id}:${normalizedUrl}`
        await svcClient.from('xp_log').upsert({
          user_id: user.id,
          action: 'submit_url',
          xp_awarded: 10,
          idempotency_key: xpKey,
        }, { onConflict: 'idempotency_key', ignoreDuplicates: true })

        // Recalculate XP + level
        const { data: xpRows } = await svcClient.from('xp_log').select('xp_awarded').eq('user_id', user.id)
        const newXp = (xpRows ?? []).reduce((s: number, r: any) => s + r.xp_awarded, 0)
        await svcClient.from('profiles').update({
          xp_total: newXp,
          level: Math.floor(Math.sqrt(newXp / 100)) + 1,
        }).eq('id', user.id)

        // Evaluate badges
        await supabase.functions.invoke('evaluate-badges', { body: { user_id: user.id } })
      } catch (e) {
        console.error('submit gamification failed:', e)
      }
    })()
  )

  return json({ success: true, id: queueEntry.id, message: 'URL submitted for review' }, 201)
})

function json(data: unknown, status = 200, extraHeaders?: Record<string, string>) {
  const h: Record<string, string> = { ...headers, 'Content-Type': 'application/json' }
  if (extraHeaders) Object.assign(h, extraHeaders)
  return new Response(JSON.stringify(data), { status, headers: h })
}