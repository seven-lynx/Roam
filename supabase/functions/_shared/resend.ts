// Shared Resend email transport for Supabase Edge Functions.
// Sends a single transactional email via the Resend API.
//
// Usage:
//   import { sendEmail } from '../_shared/resend.ts'
//   const result = await sendEmail({ to, subject, html, text })
//   if (!result.ok) console.error(result.error)

const RESEND_API_URL = 'https://api.resend.com/emails'
const MAIL_FROM_DOMAIN = 'mail.roamtheweb.app'
const FROM_ADDRESS = `Roam <hello@${MAIL_FROM_DOMAIN}>`

export interface SendEmailInput {
  to: string
  subject: string
  html: string
  text: string
}

export interface SendEmailResult {
  ok: boolean
  status?: number
  error?: string
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY not configured' }
  }

  const { to, subject, html, text } = input
  if (!to || !subject || (!html && !text)) {
    return { ok: false, error: 'to, subject and html/text are required' }
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html, text }),
    })

    if (!response.ok) {
      let message = `Resend API error ${response.status}`
      try {
        const body = await response.json()
        if (body && typeof body === 'object' && typeof body.message === 'string') {
          message = body.message
        }
      } catch {
        // keep the default status-code message
      }
      return { ok: false, status: response.status, error: message }
    }

    return { ok: true, status: response.status }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
