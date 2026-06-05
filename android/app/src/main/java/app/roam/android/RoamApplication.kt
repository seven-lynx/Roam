package app.roam.android

import android.app.Application
import app.roam.android.BuildConfig
import app.roam.android.data.supabase
import app.roam.android.util.Env
import app.roam.android.worker.TokenRefreshWorker
import io.sentry.android.core.SentryAndroid

class RoamApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        // Validate environment variables first, before any other initialization
        Env.validateAtStartup()

        // Initialise the Supabase singleton eagerly so the client is ready
        // before any Activity or ViewModel touches it.
        supabase

        // Initialise Sentry error tracking.
        // DSN is injected from local.properties at build time via BuildConfig.
        // If SENTRY_DSN is empty (e.g. local dev without a key), Sentry is a no-op.
        if (BuildConfig.SENTRY_DSN.isNotEmpty()) {
            try {
                SentryAndroid.init(this) { options ->
                    options.dsn = BuildConfig.SENTRY_DSN
                    options.environment = if (BuildConfig.DEBUG) "development" else "production"
                    options.tracesSampleRate = if (BuildConfig.DEBUG) 1.0 else 0.1
                    options.isEnableUserInteractionTracing = false
                    // Drop HTTP 500s auto-captured by the OkHttp integration (ROAM-ANDROID-7).
                    // These are server-side crashes in the edge function — noise on the client.
                    // Real app-thrown exceptions still reach Sentry via Sentry.captureException().
                    options.beforeSend = io.sentry.SentryOptions.BeforeSendCallback { event, _ ->
                        val isOkHttpCapture = event.exceptions
                            ?.firstOrNull()
                            ?.type == "SentryHttpClientException"
                        if (isOkHttpCapture) null else event
                    }
                }
            } catch (e: Exception) {
                // If Sentry init fails (e.g. WebView missing on some devices/emulators),
                // log it and continue. Don't let it crash the whole app.
                android.util.Log.e("RoamApplication", "Failed to initialize Sentry", e)
            }
        }

        // Schedule silent token refresh every 12 h (idempotent — KEEP policy)
        TokenRefreshWorker.schedule(this)
    }
}
