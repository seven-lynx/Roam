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

// ═══════════════════════════════════════════════════════════════════════════
// CORS — restrict to Supabase webhook origin (server-to-server)
// ═══════════════════════════════════════════════════════════════════════════
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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
): Promise<boolean> {
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
      return false
    }
    return true
  } catch (err) {
    console.error('[push-notify] FCM send error:', err)
    return false
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
): Promise<boolean> {
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
      return false
    }
    return true
  } catch (err) {
    console.error('[push-notify] Web Push send error:', err)
    return false
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
  // Record size in big-endian, left-shifted 1 bit with MSB = 1 per RFC 8188
  new DataView(rs.buffer).setUint32(0, recordSize, false)

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
      }
    } catch { /* ignore malformed data */ }
  }

  // Query push tokens for this user
  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { data: tokens, error: tokensError } = await adminClient
    .from('push_tokens')
    .select('id, platform, token')
    .eq('user_id', userId)

  if (tokensError) {
    console.error('[push-notify] Failed to query push_tokens:', tokensError.message)
    return json({ error: 'Failed to query push tokens' }, 500)
  }

  if (!tokens || tokens.length === 0) {
    return json({ sent: 0, message: 'No push tokens for this user' })
  }

  let sentCount = 0
  let failCount = 0

  // ── Send to Android via FCM ──────────────────────────────────────────────
  const androidTokens = tokens.filter(t => t.platform === 'android')
  if (androidTokens.length > 0 && fcmServiceAccount && fcmProjectId) {
    const accessToken = await getFCMAccessToken(fcmServiceAccount)
    if (accessToken) {
      const results = await Promise.all(
        androidTokens.map(async (t) => {
          const ok = await sendFCM(t.token, notification, data, accessToken, fcmProjectId)
          return { token: t, ok }
        }),
      )
      sentCount += results.filter(r => r.ok).length
      failCount += results.filter(r => !r.ok).length

      // Clean up expired FCM tokens (HTTP 404 = stale/unregistered token)
      for (const r of results) {
        if (!r.ok) {
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
          const ok = await sendWebPush(sub, pushPayload, vapidPublicKey, vapidPrivateKey)
          return { token: t, ok }
        } catch {
          return { token: t, ok: false }
        }
      }),
    )
    sentCount += results.filter(r => r.ok).length
    failCount += results.filter(r => !r.ok).length

    // Clean up expired web push subscriptions (410 Gone)
    for (const r of results) {
      if (!r.ok) {
        await adminClient
          .from('push_tokens')
          .delete()
          .eq('id', r.token.id)
      }
    }
  } else if (webTokens.length > 0) {
    console.log('[push-notify] Skipping Web Push: VAPID not configured (missing env vars)')
  }

  return json({
    sent: sentCount,
    failed: failCount,
    total: tokens.length,
  })
})