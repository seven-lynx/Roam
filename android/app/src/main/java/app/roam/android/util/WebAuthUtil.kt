package app.roam.android.util

import android.util.Base64
import android.webkit.CookieManager
import app.roam.android.BuildConfig
import app.roam.android.data.supabase
import io.github.jan.supabase.auth.auth

/**
 * Injects the current Supabase session cookie into the CookieManager so that
 * if the user visits roamtheweb.app inside the app's WebView, they are
 * automatically signed in without needing to log in again.
 *
 * Ported from the admin cookie injection logic in MainScreen.kt.
 */
object WebAuthUtil {

    /**
     * Sets the Supabase auth cookie for the given domain.
     * Call this before navigating the WebView to any roamtheweb.app URL.
     *
     * @param domain The cookie domain (e.g. "roamtheweb.app")
     * @return true if a session was available and injected, false otherwise
     */
    /**
     * Injects the Supabase session cookie with retry and explicit expiry.
     * Retries up to 3 times with 200ms delays if currentSessionOrNull returns null,
     * to handle the token-not-yet-propagated race on app launch.
     *
     * Sets an explicit Max-Age based on the JWT expiry so the cookie survives
     * CookieManager eviction cycles (which can drop session-only cookies).
     */
    fun injectSession(domain: String = "roamtheweb.app"): Boolean {
        return try {
            // Retry up to 3 times if the session isn't available yet (token propagation race)
            var session = supabase.auth.currentSessionOrNull()
            var attempts = 0
            while (session == null && attempts < 3) {
                Thread.sleep(200)
                session = supabase.auth.currentSessionOrNull()
                attempts++
            }
            if (session == null) {
                android.util.Log.w("WebAuthUtil", "No Supabase session available after $attempts retries")
                return false
            }

            val supabaseHost = android.net.Uri.parse(BuildConfig.SUPABASE_URL).host
                ?: return false
            val projectRef = supabaseHost.substringBefore(".supabase.co")

            // Calculate cookie expiry from JWT expiration (epoch seconds)
            val nowEpoch = System.currentTimeMillis() / 1000
            val maxAge = maxOf((session.expiresAt.epochSeconds - nowEpoch).toInt(), 3600)

            val sessionPayload = Base64.encodeToString(
                """{"access_token":"${session.accessToken}","refresh_token":"${session.refreshToken}","expires_at":${session.expiresAt.epochSeconds},"token_type":"bearer","user":{"id":"${session.user?.id ?: ""}"}}""".toByteArray(),
                Base64.NO_WRAP,
            )

            val cookieManager = CookieManager.getInstance()
            cookieManager.setAcceptCookie(true)
            cookieManager.setCookie(
                domain,
                "sb-$projectRef-auth-token=$sessionPayload; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=$maxAge",
            )
            cookieManager.flush()
            android.util.Log.d("WebAuthUtil", "Session cookie injected for $domain")
            true
        } catch (e: Exception) {
            android.util.Log.w("WebAuthUtil", "Failed to inject session cookie: ${e.message}")
            false
        }
    }

    /**
     * Injects the session and returns after a 300ms delay to let the CookieManager
     * flush propagate before the WebView starts loading. Use this for navigations
     * that immediately follow cookie injection (avoids the "loads before auth" race).
     */
    fun injectSessionAndWait(domain: String = "roamtheweb.app"): Boolean {
        val ok = injectSession(domain)
        if (ok) {
            // Give the CookieManager time to flush to disk/network stack
            Thread.sleep(300)
        }
        return ok
    }
}