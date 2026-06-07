// POST /functions/v1/beta-signup
// Accepts email signups for the closed beta.
//
// Body: { email: string }
//   email — required, must be a valid email address
//
// Public endpoint (no auth required). Rate limited: 5 submissions per 10
// minutes per IP. Duplicate emails return a friendly "already on the list"
// message rather than an error.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { clientIp, rateLimit } from '../_shared/rate-limit.ts'

const RATE_LIMIT = 5
const WINDOW_MS = 10 * 60_000 // 10 minutes

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Public endpoint — allow any origin (unlike the shared cors.ts which restricts to roamtheweb.app)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

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
  const limit = rateLimit(`beta-signup:${ip}`, RATE_LIMIT, WINDOW_MS)
  if (!limit.allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests — please wait before trying again' }),
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

  let body: { email?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { email } = body

  // Validate email
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return json({ error: 'Please provide a valid email address' }, 400)
  }

  const normalizedEmail = email.trim().toLowerCase()

  // Insert using service role to bypass RLS (INSERT policy allows all, but
  // service role avoids any future policy tightening causing silent failures)
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { error } = await adminClient
    .from('beta_signups')
    .insert({ email: normalizedEmail })

  if (error) {
    // Unique violation — user is already on the list
    if (error.code === '23505') {
      return json({ ok: true, message: "You're already on the list!" })
    }
    console.error('[beta-signup] Insert error:', error.message)
    return json({ error: 'Something went wrong — please try again' }, 500)
  }

  return json({ ok: true, message: "You're on the list!" })
})