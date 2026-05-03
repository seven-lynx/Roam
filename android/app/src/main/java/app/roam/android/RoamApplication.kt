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
            SentryAndroid.init(this) { options ->
                options.dsn = BuildConfig.SENTRY_DSN
                options.environment = if (BuildConfig.DEBUG) "development" else "production"
                options.tracesSampleRate = if (BuildConfig.DEBUG) 1.0 else 0.1
                options.isEnableUserInteractionTracing = false
            }
        }

        // Schedule silent token refresh every 12 h (idempotent — KEEP policy)
        TokenRefreshWorker.schedule(this)
    }
}
