// POST /functions/v1/push-notify
// Called by Supabase Database Webhook when a row is inserted into the
// notifications table. Sends push messages via FCM (Android) and Web Push.
//
// Body (from webhook): {
//   type: "INSERT",
//   table: "notifications",
//   record: { id, user_id, type, title, body, data }
// }
//
// The function:
//   1. Parses the webhook payload
//   2. Queries push_tokens for the notification's user_id
//   3. Sends to Firebase Cloud Messaging for Android tokens
//   4. Sends via Web Push API for web subscriptions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/resend.ts'

// ═══════════════════════════════════════════════════════════════════════════
// CORS — restrict to Supabase webhook origin (server-to-server)
// ═══════════════════════════════════════════════════════════════════════════
// Server-to-server webhook receiver. CORS only matters for browser clients, so
// restrict the allowed origin to the Supabase project itself rather than '*'.
const SUPABASE_ORIGIN = Deno.env.get('SUPABASE_URL') || 'https://supabase.co'
const corsHeaders = {
  'Access-Control-Allow-Origin': SUPABASE_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// Sentry reporting — lightweight fetch to Sentry's envelope API
// ═══════════════════════════════════════════════════════════════════════════
const SENTRY_DSN = Deno.env.get('SENTRY_DSN')
const SENTRY_RELEASE = Deno.env.get('SENTRY_RELEASE') || 'push-notify'

function parseSentryDsn(dsn: string) {
  const match = dsn.match(
    /^https?:\/\/([a-f0-9]+)@([^/]+)\/(\d+)$/,
  )
  if (!match) return null
  return { key: match[1], host: match[2], projectId: match[3] }
}

async function reportToSentry(
  error: Error | string,
  level: 'error' | 'warning' = 'error',
  extra?: Record<string, unknown>,
) {
  if (!SENTRY_DSN) return
  const parsed = parseSentryDsn(SENTRY_DSN)
  if (!parsed) return

  const eventId = crypto.randomUUID()
  const envelopeBody = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    level,
    platform: 'javascript',
    release: SENTRY_RELEASE,
    environment: Deno.env.get('SUPABASE_ENV') ?? 'production',
    exception: {
      values: [
        {
          type: typeof error === 'string' ? 'Error' : error.name,
          value: typeof error === 'string' ? error : error.message,
        },
      ],
    },
    extra,
  }

  const envelope = `${JSON.stringify({ event_id: eventId })}\n${JSON.stringify({ type: 'event' })}\n${JSON.stringify(envelopeBody)}\n`

  try {
    await fetch(
      `https://${parsed.host}/api/${parsed.projectId}/envelope/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-sentry-envelope' },
        body: envelope,
      },
    )
  } catch {
    // Sentry delivery failure must not cascade into the function failing
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FCM: exchange service account JSON for OAuth2 access token
// ═══════════════════════════════════════════════════════════════════════════
async function getFCMAccessToken(serviceAccountJson: string): Promise<string | null> {
  try {
    const sa = JSON.parse(serviceAccountJson)
    const now = Math.floor(Date.now() / 1000)

    // Create JWT header
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    }

    // Create JWT claims
    const claims = {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: sa.token_uri,
      exp: now + 3600,
      iat: now,
    }

    // Base64url encode
    const b64 = (obj: Record<string, unknown>) =>
      btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    // Import RSA private key from PKCS#8 PEM
    const pemHeader = '-----BEGIN PRIVATE KEY-----\n'
    const pemFooter = '\n-----END PRIVATE KEY-----\n'
    const pemContents = sa.private_key
      .replace(pemHeader, '')
      .replace(pemFooter, '')
      .replace(/\s/g, '')

    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))

    const key = await crypto.subtle.importKey(
      'pkcs8',
      binaryDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    )

    const encoder = new TextEncoder()
    const message = encoder.encode(`${b64(header)}.${b64(claims)}`)

    const signature = await crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      key,
      message,
    )
    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    const jwt = `${b64(header)}.${b64(claims)}.${sigB64}`

    // Exchange JWT for access token
    const response = await fetch(sa.token_uri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[push-notify] FCM auth failed:', response.status, err.slice(0, 200))
      return null
    }

    const data = await response.json()
    return data.access_token ?? null
  } catch (err) {
    console.error('[push-notify] FCM auth error:', err)
    return null
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FCM: send push to a single Android device
// ═══════════════════════════════════════════════════════════════════════════
async function sendFCM(
  token: string,
  notification: { title: string; body: string },
  data: Record<string, string>,
  accessToken: string,
  projectId: string,
): Promise<{ ok: boolean; status: number }> {
  try {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token,
            notification: {
              title: notification.title,
              body: notification.body,
            },
            android: {
              priority: 'high',
              notification: {
                channelId: 'roam_notifications',
                sound: 'default',
              },
            },
            data,
          },
        }),
      },
    )

    if (!response.ok) {
      const err = await response.text()
      // 404 means stale token — skip logging as error
      if (response.status === 404) {
        console.log('[push-notify] FCM token not found (expired):', token.slice(0, 20))
      } else {
        console.error('[push-notify] FCM send failed:', response.status, err.slice(0, 200))
      }
      return { ok: false, status: response.status }
    }
    return { ok: true, status: response.status }
  } catch (err) {
    console.error('[push-notify] FCM send error:', err)
    return { ok: false, status: 0 }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Web Push: send push to a single browser subscription
// ═══════════════════════════════════════════════════════════════════════════
async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
): Promise<{ ok: boolean; status: number }> {
  try {
    // Encode VAPID JWT
    const encoder = new TextEncoder()
    const header = { alg: 'ES256', typ: 'JWT' }
    const claims = {
      sub: 'mailto:hello@roamtheweb.app',
      aud: subscription.endpoint,
      exp: Math.floor(Date.now() / 1000) + 86400,
    }

    const b64 = (obj: Record<string, unknown>) =>
      btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    // Import VAPID private key for signing
    // VAPID private key is in base64url DER format
    const rawKey = base64UrlToBytes(vapidPrivateKey)
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      rawKey.buffer as ArrayBuffer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    )

    const message = encoder.encode(`${b64(header)}.${b64(claims)}`)
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      cryptoKey,
      message,
    )

    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    const vapidJwt = `${b64(header)}.${b64(claims)}.${sigB64}`

    // Encrypt payload for the subscription
    const encryptedPayload = await encryptPayload(payload, subscription.keys)

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
        'Authorization': `WebPush ${vapidJwt}`,
        'Crypto-Key': `p256ecdsa=${vapidPublicKey}`,
      },
      body: encryptedPayload as BodyInit,
    })

    if (!response.ok) {
      const status = response.status
      if (status === 410) {
        // Subscription expired/unsubscribed — caller should clean up
        console.log('[push-notify] Web Push subscription gone:', subscription.endpoint.slice(0, 40))
      } else {
        const err = await response.text()
        console.error('[push-notify] Web Push send failed:', status, err.slice(0, 200))
      }
      return { ok: false, status }
    }
    return { ok: true, status: response.status }
  } catch (err) {
    console.error('[push-notify] Web Push send error:', err)
    return { ok: false, status: 0 }
  }
}

function base64UrlToBytes(base64url: string): Uint8Array {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padLen = (4 - (b64.length % 4)) % 4
  const padded = b64 + '='.repeat(padLen)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// ═══════════════════════════════════════════════════════════════════════════
// Web Push encryption (AES-128-GCM)
// ═══════════════════════════════════════════════════════════════════════════
async function encryptPayload(
  plaintext: string,
  keys: { p256dh: string; auth: string },
): Promise<Uint8Array> {
  const encoder = new TextEncoder()

  // Import subscription public key
  const publicKeyBytes = base64UrlToBytes(keys.p256dh)
  const publicKey = await crypto.subtle.importKey(
    'raw',
    publicKeyBytes.buffer as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )

  // Import auth secret
  const authBytes = base64UrlToBytes(keys.auth)

  // Generate ephemeral ECDH key pair
  const ephemeralKey = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )

  // Export ephemeral public key
  const ephemeralPubRaw = await crypto.subtle.exportKey('raw', ephemeralKey.publicKey)
  const ephemeralPubBytes = new Uint8Array(ephemeralPubRaw)

  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    ephemeralKey.privateKey,
    256,
  )

  // Import shared secret for HKDF
  const sharedKey = await crypto.subtle.importKey(
    'raw',
    sharedSecret,
    { name: 'HKDF' },
    false,
    ['deriveBits'],
  )

  // Generate a random 16-byte salt for key derivation (per RFC 8291)
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // HKDF: combine shared secret + auth to derive PRK
  // Then derive encryption key and nonce
  const info = encoder.encode('Content-Encoding: aes128gcm\0')

  // IKM = shared_secret || auth_secret (per RFC 8291)
  const ikm = new Uint8Array(sharedSecret.byteLength + authBytes.length)
  ikm.set(new Uint8Array(sharedSecret), 0)
  ikm.set(authBytes, sharedSecret.byteLength)

  const ikmKey = await crypto.subtle.importKey(
    'raw',
    ikm,
    { name: 'HKDF' },
    false,
    ['deriveBits'],
  )

  // Derive 32 bytes: first 16 = content encryption key, next 16 = nonce
  const prk = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt.buffer as ArrayBuffer, info },
    ikmKey,
    256,
  )

  const prkBytes = new Uint8Array(prk)
  const cek = prkBytes.slice(0, 16)
  const nonce = prkBytes.slice(16, 32)

  // Encrypt payload with AES-128-GCM
  const aesKey = await crypto.subtle.importKey(
    'raw',
    cek,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  )

  const plainBytes = encoder.encode(plaintext)

  // Prepend 0x00 + 0x00 as padding delimiter (RFC 8188 section 2)
  const paddedPlain = new Uint8Array(plainBytes.length + 2)
  paddedPlain.set(plainBytes, 0)
  paddedPlain[plainBytes.length] = 0x00
  paddedPlain[plainBytes.length + 1] = 0x00

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 },
    aesKey,
    paddedPlain,
  )

  // Build the Web Push payload per RFC 8188/8291:
  // salt (16 bytes) | recordsize (4 bytes, big-endian) | keyid length (1 byte) | keyid (varies) | ciphertext
  const recordSize = 4096
  const rs = new Uint8Array(4)
  // Record size in big-endian with MSB set to 1 per RFC 8188 §2
  // The MSB (bit 31) MUST be 1; the remaining 31 bits encode the actual size
  new DataView(rs.buffer).setUint32(0, recordSize | 0x80000000, false)

  const keyidLen = new Uint8Array([0]) // empty keyid = 0x00

  const result = new Uint8Array(
    salt.length + rs.length + keyidLen.length + 0 + ciphertext.byteLength
  )
  let offset = 0
  result.set(salt, offset); offset += salt.length
  result.set(rs, offset); offset += rs.length
  result.set(keyidLen, offset); offset += keyidLen.length
  // keyid is empty, so nothing to copy
  result.set(new Uint8Array(ciphertext), offset)

  return result
}

// ═══════════════════════════════════════════════════════════════════════════
const WEB_DOMAIN = 'roamtheweb.app'

// Moderation-decision notifications are the only types that currently send a
// transactional email. Everything else (badge_unlocked, level_up, new_follower,
// url_shared, ...) stays push-only to avoid email fatigue.
const EMAIL_NOTIFICATION_TYPES = new Set(['url_approved', 'url_rejected'])

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface TransactionalEmail {
  subject: string
  html: string
  text: string
}

function buildTransactionalEmail(
  type: string,
  data: Record<string, string>,
): TransactionalEmail {
  const approved = type === 'url_approved'
  const url = data.url ?? ''
  const linkTitle = data.title || url || 'your submission'
  const accent = approved ? '#39ff14' : '#ff2e88'
  const documentPath = approved ? '~/inbox/submission-approved.txt' : '~/inbox/submission-not-approved.txt'
  const statusBar = approved ? 'STATUS: LIVE' : 'STATUS: DECLINED'
  const hero = approved ? 'SUBMISSION APPROVED.' : 'SUBMISSION NOT APPROVED.'
  const subject = approved ? 'ROAM-OS // submission approved' : 'ROAM-OS // submission not approved'
  const preheader = approved
    ? 'Your link is now live in the Roam database.'
    : 'Your link did not make it through moderation.'
  const ctaLabel = approved ? 'VIEW IN ROAM' : 'REVIEW SUBMISSION'
  const bodyParagraph = approved
    ? `Your link, <strong style="color:#e0b45f;">&ldquo;${escapeHtml(linkTitle)}&rdquo;</strong>, cleared moderation and is now in the Roam database &mdash; discoverable by everyone wandering the network.`
    : `Your link, <strong style="color:#e0b45f;">&ldquo;${escapeHtml(linkTitle)}&rdquo;</strong>, was not approved and won&rsquo;t be added to the Roam database this time.`

  const urlBlock = url
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px dashed #28444a;background-color:#0f1f24;"><tr><td style="padding:16px 18px;font-family:'IBM Plex Mono','Courier New',monospace;"><span style="font-size:10px;letter-spacing:2px;color:${accent};">&#9679; LIVE ENTRY</span><span style="display:block;font-size:14px;line-height:1.6;color:#e6dcc3;margin-top:6px;word-break:break-all;">${escapeHtml(url)}</span></td></tr></table>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${escapeHtml(subject)}</title>
  <!--[if mso]><style>table,tr,td,div,p,a{font-family:'Courier New',monospace;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#040a0a;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;line-height:1px;font-size:1px;color:#040a0a;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#040a0a" style="background-color:#040a0a;">
    <tr>
      <td align="center" style="padding:28px 12px 40px 12px;">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;border:1px solid #28444a;background-color:#0a1214;">
          <tr>
            <td style="padding:0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0f1f24;border-bottom:1px solid #28444a;">
                <tr>
                  <td style="padding:12px 20px;font-family:'IBM Plex Mono','Courier New',monospace;font-size:12px;letter-spacing:0.5px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td width="12" valign="middle"><span style="display:inline-block;width:9px;height:9px;background-color:${accent};border-radius:50%;"></span></td>
                        <td valign="middle" style="padding-left:8px;font-weight:bold;letter-spacing:3px;color:#e6dcc3;">ROAM-OS</td>
                        <td valign="middle" style="padding-left:14px;color:#3f7f7d;">|</td>
                        <td valign="middle" style="padding-left:14px;color:#8fa3a0;">${escapeHtml(documentPath)}</td>
                        <td align="right" valign="middle" style="color:#59b3ae;white-space:nowrap;">${statusBar}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="padding:40px 24px 8px 24px;font-family:'IBM Plex Mono','Courier New',monospace;font-size:26px;line-height:1.1;font-weight:bold;letter-spacing:2px;color:${accent};">${hero}</td></tr>
                <tr><td style="padding:12px 24px 20px 24px;font-family:'IBM Plex Mono','Courier New',monospace;font-size:14px;line-height:1.7;color:#e6dcc3;">${bodyParagraph}</td></tr>
              </table>
              ${url ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 24px;">${urlBlock}</td></tr></table>` : ''}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td align="center" style="padding:28px 24px 8px 24px;"><a href="https://${WEB_DOMAIN}" style="display:inline-block;padding:12px 28px;font-family:'IBM Plex Mono','Courier New',monospace;font-size:13px;letter-spacing:2px;color:#040a0a;background-color:${accent};text-decoration:none;border-radius:2px;">${ctaLabel}</a></td></tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="padding:28px 24px 0 24px;font-family:'IBM Plex Mono','Courier New',monospace;font-size:14px;line-height:1.7;color:#e6dcc3;">Thank you for adding another signal to the map.</td></tr>
                <tr><td style="padding:12px 24px 44px 24px;font-family:'IBM Plex Mono','Courier New',monospace;font-size:16px;color:#e0b45f;letter-spacing:1px;">Keep wandering.</td></tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #223741;background-color:#0a1518;">
                <tr><td style="padding:20px 24px;font-family:'IBM Plex Mono','Courier New',monospace;font-size:11px;line-height:1.8;color:#8fa3a0;">ROAM-OS // sent from the wasteland.<br>You are getting this because you submitted a link and this notification is enabled in your <a href="https://${WEB_DOMAIN}/settings" style="color:#8fa3a0;text-decoration:underline;">Roam settings</a>.</td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = approved
    ? `ROAM-OS // SUBMISSION APPROVED.

Your link, "${linkTitle}", cleared moderation and is now live in the Roam database.

LIVE ENTRY:
${url || '(no url)'}

View it: https://${WEB_DOMAIN}

Keep wandering.

You are getting this because you submitted a link and this notification is enabled in your Roam settings: https://${WEB_DOMAIN}/settings`
    : `ROAM-OS // SUBMISSION NOT APPROVED.

Your link, "${linkTitle}", was not approved and won't be added to the Roam database this time.

Keep wandering.

You are getting this because you submitted a link and this notification is enabled in your Roam settings: https://${WEB_DOMAIN}/settings`

  return { subject, html, text }
}

// Main handler
// ═══════════════════════════════════════════════════════════════════════════
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // FCM config
  const fcmServiceAccount = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON')
  const fcmProjectId = Deno.env.get('FCM_PROJECT_ID')

  // Web Push VAPID keys
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')

  // Parse webhook body
  let payload: { type?: string; table?: string; record?: Record<string, unknown> }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  if (payload.type !== 'INSERT' || payload.table !== 'notifications') {
    return json({ skipped: true, reason: 'Not an INSERT on notifications' })
  }

  const record = payload.record
  if (!record?.user_id || !record?.title || !record?.body) {
    return json({ error: 'Missing required fields: user_id, title, body' }, 400)
  }

  const userId = record.user_id as string
  const notification = {
    title: record.title as string,
    body: record.body as string,
  }
  const data: Record<string, string> = {}
  if (record.type) data.type = record.type as string
  if (record.data) {
    try {
      const parsed = typeof record.data === 'string' ? JSON.parse(record.data as string) : record.data
      if (parsed && typeof parsed === 'object') {
        if (parsed.url) data.url = String(parsed.url)
        if (parsed.title) data.title = String(parsed.title)
      }
    } catch { /* ignore malformed data */ }
  }

  // Query the recipient's notification settings, then decide which channels
  // (push and/or email) should fire for this notification.
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  // Honour per-type notification preferences (opt-out). A missing type or a
  // missing channel flag means enabled; only an explicit `push: false` /
  // `email: false` skips that channel. Email is additionally restricted to a
  // small allowlist of transactional types (moderation decisions) so we don't
  // generate email fatigue from badge/level/follow notifications.
  const notificationType = record.type as string | undefined
  const { data: settings } = await adminClient
    .from('user_settings')
    .select('email_notifications, notification_preferences')
    .eq('user_id', userId)
    .maybeSingle()

  const prefs = (settings?.notification_preferences ?? {}) as Record<
    string,
    { push?: boolean; email?: boolean } | undefined
  >
  const pushEnabled = prefs[notificationType ?? '']?.push !== false
  const emailEnabled =
    notificationType !== undefined &&
    EMAIL_NOTIFICATION_TYPES.has(notificationType) &&
    settings?.email_notifications !== false &&
    prefs[notificationType]?.email !== false

  let sentCount = 0
  let failCount = 0
  let emailSent = false
  let emailError: string | undefined

  // Resolve push tokens (only when push is enabled) so the email channel can
  // still fire for email-only users.
  let tokens: { id: string; platform: string; token: string }[] = []
  if (pushEnabled) {
    const { data, error } = await adminClient
      .from('push_tokens')
      .select('id, platform, token')
      .eq('user_id', userId)

    if (error) {
      console.error('[push-notify] Failed to query push_tokens:', error.message)
      reportToSentry(error.message, 'error', { userId, type: notificationType })
    } else if (data) {
      tokens = data
    }
  }

  // ── Send to Android via FCM ──────────────────────────────────────────────
  const androidTokens = tokens.filter(t => t.platform === 'android')
  if (androidTokens.length > 0 && fcmServiceAccount && fcmProjectId) {
    const accessToken = await getFCMAccessToken(fcmServiceAccount)
    if (accessToken) {
      const results = await Promise.all(
        androidTokens.map(async (t) => {
          const result = await sendFCM(t.token, notification, data, accessToken, fcmProjectId)
          return { token: t, ...result }
        }),
      )
      sentCount += results.filter(r => r.ok).length
      failCount += results.filter(r => !r.ok).length

      // Clean up expired FCM tokens — only delete on HTTP 404 (stale/unregistered token).
      // Transient errors (500, 503, network timeouts) should NOT trigger deletion.
      for (const r of results) {
        if (!r.ok && r.status === 404) {
          adminClient
            .from('push_tokens')
            .delete()
            .eq('id', r.token.id)
            .then(
              () => console.log('[push-notify] Removed stale FCM token:', r.token.token.slice(0, 20)),
              (delErr) => console.error('[push-notify] Failed to remove stale FCM token:', delErr),
            )
        }
      }
    } else {
      const authMsg = '[push-notify] Could not get FCM access token – skipping Android push'
      console.error(authMsg)
      reportToSentry(authMsg, 'error', { tokenCount: androidTokens.length })
      failCount += androidTokens.length
    }
    } else if (androidTokens.length > 0) {
    const msg = '[push-notify] Skipping Android push: FCM not configured (missing env vars)'
    console.error(msg)
    reportToSentry(msg, 'error', {
      hasServiceAccount: !!fcmServiceAccount,
      hasProjectId: !!fcmProjectId,
      tokenCount: androidTokens.length,
    })
  }

  // ── Send to Web via Web Push ─────────────────────────────────────────────
  const webTokens = tokens.filter(t => t.platform === 'web')
  if (webTokens.length > 0 && vapidPublicKey && vapidPrivateKey) {
    const pushPayload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: '/icon-512.png',
      badge: '/icon-512.png',
      data,
    })

    const results = await Promise.all(
      webTokens.map(async (t) => {
        try {
          const sub = JSON.parse(t.token) as { endpoint: string; keys: { p256dh: string; auth: string } }
          const result = await sendWebPush(sub, pushPayload, vapidPublicKey, vapidPrivateKey)
          return { token: t, ...result }
        } catch {
          return { token: t, ok: false, status: 0 }
        }
      }),
    )
    sentCount += results.filter(r => r.ok).length
    failCount += results.filter(r => !r.ok).length

    // Clean up expired web push subscriptions — only delete on HTTP 410 Gone.
    // Transient errors (500, 503, network timeouts) should NOT trigger deletion.
    for (const r of results) {
      if (!r.ok && r.status === 410) {
        await adminClient
          .from('push_tokens')
          .delete()
          .eq('id', r.token.id)
      }
    }
  } else if (webTokens.length > 0) {
    console.log('[push-notify] Skipping Web Push: VAPID not configured (missing env vars)')
  }

  // ── Transactional email (moderation decisions only) ─────────────────────
  if (emailEnabled) {
    const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(userId)
    const email = userData?.user?.email

    if (userError || !email) {
      const msg = `[push-notify] No email for ${userId} - skipping transactional email`
      console.error(msg)
      reportToSentry(userError ? userError.message : msg, 'warning', { userId, type: notificationType })
      emailError = 'no_recipient_email'
    } else {
      const txn = buildTransactionalEmail(notificationType as string, data)
      const result = await sendEmail({ to: email, subject: txn.subject, html: txn.html, text: txn.text })
      emailSent = result.ok
      if (!result.ok) emailError = result.error

      // Best-effort audit log.
      const { error: logError } = await adminClient
        .from('email_log')
        .insert({
          subject: txn.subject,
          body_md: txn.text,
          recipient_count: 1,
          success_count: result.ok ? 1 : 0,
          fail_count: result.ok ? 0 : 1,
          sent_by: '00000000-0000-0000-0000-000000000000',
          sender_type: 'transactional',
        })

      if (logError) {
        console.error('[push-notify] Failed to log transactional email:', logError.message)
        reportToSentry(logError.message, 'warning', { operation: 'email-log-insert' })
      }
    }
  }

  return json({
    sent: sentCount,
    failed: failCount,
    total: tokens.length,
    emailSent,
    emailError,
  })
})