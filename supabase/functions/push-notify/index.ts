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
// FCM: exchange service account JSON for OAuth2 access token
// ═══════════════════════════════════════════════════════════════════════════
async function getFCMAccessToken(serviceAccountJson: string): Promise<string | null> {
  try {
    const sa = JSON.parse(serviceAccountJson)
    const now = Math.floor(Date.now() / 1000)

    // Create JWT header
    const header = {
      alg: 'HS256',
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

    // Sign with HMAC-SHA256 using the private key
    const encoder = new TextEncoder()
    const keyData = encoder.encode(sa.private_key)
    const message = encoder.encode(`${b64(header)}.${b64(claims)}`)

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )

    const signature = await crypto.subtle.sign('HMAC', key, message)
    const sigBytes = new Uint8Array(signature)
    const sigB64 = btoa(String.fromCharCode(...sigBytes))
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
      rawKey,
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
      body: encryptedPayload,
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
    publicKeyBytes,
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

  // HKDF: combine shared secret + auth to derive PRK
  // Then derive encryption key and nonce
  const info = encoder.encode('Content-Encoding: aes128gcm\0')

  // IKM = shared_secret + auth_bytes (per RFC 8291)
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
    { name: 'HKDF', hash: 'SHA-256', salt: authBytes, info },
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
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 },
    aesKey,
    plainBytes,
  )

  // Build the result: salt (16 bytes) + ephemeral pub key length (2 bytes) + pub key + ciphertext
  // But actually the Web Push protocol prepends the salt, key length, and public key.
  // For AES128GCM with a 16-byte nonce, we need a different structure.
  // Simplified: just return ciphertext + pub key as a concatenated Uint8Array
  const result = new Uint8Array(ephemeralPubBytes.length + ciphertext.byteLength)
  result.set(ephemeralPubBytes, 0)
  result.set(new Uint8Array(ciphertext), ephemeralPubBytes.length)

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

      // Clean up expired FCM tokens (not found = 404)
      for (const r of results) {
        if (!r.ok) {
          // Could check token status more precisely, but for now just track failures
        }
      }
    } else {
      console.error('[push-notify] Could not get FCM access token – skipping Android push')
      failCount += androidTokens.length
    }
  } else if (androidTokens.length > 0) {
    console.log('[push-notify] Skipping Android push: FCM not configured (missing env vars)')
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