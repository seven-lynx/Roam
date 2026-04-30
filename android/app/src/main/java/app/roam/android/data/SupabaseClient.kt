package app.roam.android.data

import app.roam.android.BuildConfig
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.functions.Functions
import io.github.jan.supabase.postgrest.Postgrest
import io.ktor.client.engine.android.Android

/**
 * Singleton Supabase client. URL and anon key are injected from local.properties
 * at build time via BuildConfig — they are never hard-coded or committed.
 */
val supabase = createSupabaseClient(
    supabaseUrl = BuildConfig.SUPABASE_URL,
    supabaseKey = BuildConfig.SUPABASE_ANON_KEY,
) {
    install(Auth)
    install(Functions)
    install(Postgrest)
    httpEngine = Android.create()
}
