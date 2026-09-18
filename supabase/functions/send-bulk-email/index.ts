// POST /functions/v1/send-bulk-email
// Sends a bulk email to all users with email_notifications enabled.
// Admin only — requires Authorization header with service role key.
//
// Body: { subject: string, bodyMarkdown: string }
//
// The Edge Function:
//   1. Queries user_settings WHERE email_notifications = true
//   2. Resolves user_id → email via auth.admin.listUsers()
//   3. Renders Markdown to HTML + plain-text fallback
//   4. Appends unsubscribe link to footer
//   5. Sends via Resend API in batches of 50
//   6. Logs to email_log table

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { initSentry } from '../_shared/sentry.ts'

// ═══════════════════════════════════════════════════════════════════════════
// CORS — admin-only endpoint, restrict to our web app
// ═══════════════════════════════════════════════════════════════════════════
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://roamtheweb.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Sentry reporting — silently disabled if SENTRY_DSN is not set
const report = initSentry('send-bulk-email')

// ═══════════════════════════════════════════════════════════════════════════
// Simple Markdown → HTML renderer
// Handles the most common formatting needed for admin emails:
//   **bold**, *italic*, # headings, - lists, paragraphs, links
// ═══════════════════════════════════════════════════════════════════════════
function markdownToHtml(md: string): string {
  let html = md
    // Escape HTML entities first
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:16px;margin:16px 0 8px">$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:18px;margin:20px 0 10px">$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:22px;margin:24px 0 12px">$1</h1>')

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // Inline links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#2563eb">$1</a>')

  // Unordered list items (lines starting with - or *)
  html = html.replace(/^[-*] (.+)$/gm, '<li style="margin:4px 0">$1</li>')

  // Wrap consecutive <li>s in <ul>
  html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul style="padding-left:20px;margin:8px 0">$&</ul>')

  // Paragraphs: double newlines → <p>
  html = html.replace(/\n\n/g, '</p><p style="margin:0 0 12px">')
  html = '<p style="margin:0 0 12px">' + html + '</p>'

  // Clean up empty paragraphs
  html = html.replace(/<p[^>]*>\s*<\/p>/g, '')

  // Single newlines → <br>
  html = html.replace(/\n/g, '<br>')

  return html
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

// ═══════════════════════════════════════════════════════════════════════════
// Create a signed unsubscribe token
// ═══════════════════════════════════════════════════════════════════════════
async function createUnsubscribeToken(
  userId: string,
  secret: string,
): Promise<string> {
  // Simple HMAC-like signing using the service role key
  // Format: base64(userId.timestamp.signature)
  const encoder = new TextEncoder()
  const timestamp = Date.now()
  const payload = `${userId}.${timestamp}`

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload),
  )

  const sigHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return btoa(`${payload}.${sigHex}`)
}

// ═══════════════════════════════════════════════════════════════════════════
// Main handler
// ═══════════════════════════════════════════════════════════════════════════
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendApiKey = Deno.env.get('RESEND_API_KEY')!

  if (!resendApiKey) {
    return json({ error: 'RESEND_API_KEY not configured' }, 500)
  }

  // Verify caller is admin (expects service role key in Authorization header)
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (token !== serviceRoleKey) {
    return json({ error: 'Unauthorized — service role key required' }, 401)
  }

  // Parse body
  let body: { subject?: unknown; bodyMarkdown?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { subject, bodyMarkdown } = body
  if (typeof subject !== 'string' || !subject.trim()) {
    return json({ error: 'subject is required' }, 400)
  }
  if (typeof bodyMarkdown !== 'string' || !bodyMarkdown.trim()) {
    return json({ error: 'bodyMarkdown is required' }, 400)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  // ── Step 1: Get all user_ids with notifications enabled ────────────────
  const { data: settings_rows, error: settingsError } = await adminClient
    .from('user_settings')
    .select('user_id')
    .eq('email_notifications', true)

  if (settingsError) {
    console.error('[send-bulk-email] Failed to query user_settings:', settingsError.message)
    report(settingsError.message, 'error', { operation: 'query-user-settings' })
    return json({ error: 'Failed to query recipients' }, 500)
  }

  if (!settings_rows || settings_rows.length === 0) {
    return json({ sent: 0, message: 'No recipients with notifications enabled' })
  }

  const userIds = settings_rows.map(r => r.user_id)

  // ── Step 2: Resolve emails via auth.admin.listUsers() ──────────────────
  // listUsers returns max 1000 per page; paginate if needed
  const emailMap = new Map<string, string>() // userId → email
  let page = 1
  const perPage = 1000

  while (true) {
    const { data: authUsers, error: authError } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    })

    if (authError) {
      console.error('[send-bulk-email] Failed to list users:', authError.message)
      report(authError.message, 'error', { operation: 'list-users', page })
      return json({ error: 'Failed to resolve user emails' }, 500)
    }

    for (const u of authUsers.users) {
      if (u.email && userIds.includes(u.id)) {
        emailMap.set(u.id, u.email)
      }
    }

    if (authUsers.users.length < perPage) break
    page++
  }

  // Build recipient list with emails and unsubscribe tokens
  const recipients: Array<{ userId: string; email: string; unsubscribeToken: string }> = []

  for (const uid of userIds) {
    const email = emailMap.get(uid)
    if (!email) continue
    const unsubscribeToken = await createUnsubscribeToken(uid, serviceRoleKey)
    recipients.push({ userId: uid, email, unsubscribeToken })
  }

  if (recipients.length === 0) {
    return json({ sent: 0, message: 'No email addresses resolved for recipients' })
  }

  // ── Step 3: Render email ─────────────────────────────────────────────────
  const mailFromDomain = 'mail.roamtheweb.app'
  const webDomain = 'roamtheweb.app'
  const htmlBody = markdownToHtml(bodyMarkdown)
  const textBody = stripHtml(htmlBody)

  // ── Step 4: Send via Resend in batches of 50 ──────────────────────────────
  const BATCH_SIZE = 50
  let successCount = 0
  let failCount = 0

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE)

    const promises = batch.map(async (recip) => {
      const unsubscribeLink = `https://${webDomain}/api/unsubscribe?token=${encodeURIComponent(recip.unsubscribeToken)}`
      const footer = `\n\n---\n\nYou received this email because you enabled notifications in your [Roam settings](https://${webDomain}/settings).\n\n[Unsubscribe](https://${webDomain}/api/unsubscribe?token=${encodeURIComponent(recip.unsubscribeToken)})`

      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `Roam <hello@${mailFromDomain}>`,
            to: recip.email,
            subject: subject,
            html: htmlBody + markdownToHtml(footer),
            text: textBody + stripHtml(markdownToHtml(footer)),
          }),
        })

        const result = await response.json()
        if (!response.ok) {
          console.error(`[send-bulk-email] Failed to send to ${recip.email}:`, result)
          report(`Resend API error for ${recip.email}: ${result?.message ?? 'Unknown error'}`, 'warning', {
            email: recip.email,
            resendStatus: response.status,
            operation: 'resend-send',
          })
          return { success: false, userId: recip.userId, email: recip.email, error: result?.message ?? 'Unknown error' }
        }
        return { success: true, userId: recip.userId, email: recip.email }
      } catch (err) {
        console.error(`[send-bulk-email] Error sending to ${recip.email}:`, err)
        report(err, 'warning', { email: recip.email, operation: 'resend-fetch' })
        return { success: false, userId: recip.userId, email: recip.email, error: String(err) }
      }
    })

    const results = await Promise.all(promises)
    for (const r of results) {
      if (r.success) successCount++
      else failCount++
    }
  }

  // ── Step 5: Log to email_log ──────────────────────────────────────────────
  const { error: logError } = await adminClient
    .from('email_log')
    .insert({
      subject,
      body_md: bodyMarkdown,
      recipient_count: recipients.length,
      success_count: successCount,
      fail_count: failCount,
      sent_by: '00000000-0000-0000-0000-000000000000', // placeholder—Edge Function has no auth user
      sender_type: 'manual',
    })

  if (logError) {
    console.error('[send-bulk-email] Failed to log send:', logError.message)
    report(logError.message, 'warning', { operation: 'email-log-insert' })
  }

  return json({
    sent: successCount,
    failed: failCount,
    total: recipients.length,
  })
})