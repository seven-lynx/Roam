# Add project specific ProGuard rules here.

# ── App classes ──────────────────────────────────────────────────────────────
-keep class app.roam.android.** { *; }

# ── Supabase Kotlin SDK ──────────────────────────────────────────────────────
-keep class io.github.jan.supabase.** { *; }
-dontwarn io.github.jan.supabase.**

# ── Sentry Android SDK ───────────────────────────────────────────────────────
# Sentry ships its own consumer ProGuard rules via the Gradle plugin, but keep
# these as an explicit safeguard in case the plugin rules don't apply.
-keep class io.sentry.** { *; }
-dontwarn io.sentry.**

# ── Ktor HTTP client (used by Supabase SDK) ──────────────────────────────────
-keep class io.ktor.** { *; }
-dontwarn io.ktor.**

# ── kotlinx.serialization ────────────────────────────────────────────────────
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keep class kotlinx.serialization.** { *; }
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
# Keep generated $$serializer classes for app data classes
-keep,includedescriptorclasses class app.roam.android.**$$serializer { *; }
-keepclassmembers class app.roam.android.** {
    *** Companion;
}
-keepclasseswithmembers class app.roam.android.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# ── Jetpack Compose runtime ──────────────────────────────────────────────────
# Compose libraries ship their own consumer rules; keep runtime as a safeguard.
-keep class androidx.compose.runtime.** { *; }
-dontwarn androidx.compose.**
