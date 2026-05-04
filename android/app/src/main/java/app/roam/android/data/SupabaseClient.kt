package app.roam.android.data

import app.roam.android.BuildConfig
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.FlowType
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.functions.Functions
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.storage.Storage
import io.github.jan.supabase.annotations.SupabaseInternal
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.HttpTimeout
import java.util.concurrent.TimeUnit

/**
 * Singleton Supabase client. URL and anon key are injected from local.properties
 * at build time via BuildConfig — they are never hard-coded or committed.
 */
val supabase = createSupabaseClient(
    supabaseUrl = BuildConfig.SUPABASE_URL,
    supabaseKey = BuildConfig.SUPABASE_ANON_KEY,
) {
    install(Auth) {
        flowType = FlowType.PKCE
        scheme = "app.roam.android"
        host = "callback"
    }
    install(Functions)
    install(Postgrest)
    install(Storage)
    @OptIn(SupabaseInternal::class)
    httpConfig {
        install(HttpTimeout) {
            requestTimeoutMillis = 60_000
            connectTimeoutMillis = 15_000
            socketTimeoutMillis = 60_000
        }
    }
    httpEngine = OkHttp.create {
        config {
            // callTimeout is intentionally omitted — it conflicts with Ktor's
            // requestTimeoutMillis plugin. Setting both causes OkHttp to fire
            // at 30 s while Ktor expects 60 s, producing duplicate timeout
            // exceptions (ROAM-ANDROID-6 vs ROAM-ANDROID-4). Ktor's plugin
            // is the single source of truth for request-level timeouts.
            connectTimeout(15, TimeUnit.SECONDS)
            readTimeout(60, TimeUnit.SECONDS)
            writeTimeout(30, TimeUnit.SECONDS)
        }
    }
}
