// POST /functions/v1/feedback
// Accepts user-submitted feedback from any Roam platform.
//
// Body: { message: string, platform: string, email?: string }
//   message  — required, 1–2000 characters
//   platform — one of: 'web' | 'extension-chrome' | 'extension-firefox' | 'android'
//   email    — optional, for follow-up if the user is not authenticated
//
// Authenticated requests will have their user_id recorded automatically.
// Anonymous submissions are accepted (email optional in that case).
//
// Rate limited: 5 submissions per 10 minutes per IP.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { clientIp, rateLimit } from '../_shared/rate-limit.ts'

const ALLOWED_PLATFORMS = new Set([
  'web',
  'extension-chrome',
  'extension-firefox',
  'android',
])

const RATE_LIMIT = 5
const WINDOW_MS = 10 * 60_000 // 10 minutes

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // Rate limit before parsing body
  const ip = clientIp(req)
  const limit = rateLimit(`feedback:${ip}`, RATE_LIMIT, WINDOW_MS)
  if (!limit.allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests — please wait before sending more feedback' }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': String(limit.retryAfterSec),
        },
      },
    )
  }

  let body: { message?: unknown; platform?: unknown; email?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { message, platform, email } = body

  // Validate message
  if (typeof message !== 'string' || message.trim().length === 0) {
    return json({ error: 'message is required' }, 400)
  }
  if (message.trim().length > 2000) {
    return json({ error: 'message must be 2000 characters or fewer' }, 400)
  }

  // Validate platform
  if (typeof platform !== 'string' || !ALLOWED_PLATFORMS.has(platform)) {
    return json({ error: `platform must be one of: ${[...ALLOWED_PLATFORMS].join(', ')}` }, 400)
  }

  // Validate optional email
  if (email !== undefined && email !== null && email !== '') {
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'email is not a valid address' }, 400)
    }
  }

  // Extract user_id from Authorization header if present (best-effort)
  let userId: string | null = null
  const authHeader = req.headers.get('Authorization')
  if (authHeader) {
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user } } = await userClient.auth.getUser()
    userId = user?.id ?? null
  }

  // Insert using service role to bypass RLS (INSERT policy allows all, but
  // service role avoids any future policy tightening causing silent failures)
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { error } = await adminClient
    .from('feedback')
    .insert({
      user_id: userId,
      platform,
      message: message.trim(),
      email: (email && typeof email === 'string' && email.trim()) ? email.trim() : null,
    })

  if (error) {
    console.error('[feedback] Insert error:', error.message)
    return json({ error: 'Failed to save feedback — please try again' }, 500)
  }

  return json({ ok: true })
})
