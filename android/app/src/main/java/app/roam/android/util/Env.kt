package app.roam.android.util

import android.util.Log
import io.sentry.Sentry

/**
 * Environment variable validation for the Android app.
 * Fails fast with clear error messages if required vars are missing.
 *
 * Required BuildConfig values (set in build.gradle.kts):
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_ANON_KEY: Supabase anonymous key
 * - SENTRY_DSN: Sentry project DSN (optional)
 *
 * Validation runs at app startup (in the Application class).
 * If validation fails, errors are logged and sent to Sentry.
 */
object Env {
  private const val TAG = "Env"

  /**
   * Validate all required environment variables at app startup.
   * Should be called from Application.onCreate() before any other initialization.
   *
   * @throws IllegalStateException if any required variable is missing or invalid
   */
  fun validateAtStartup() {
    val missingVars = mutableListOf<String>()
    val errors = mutableListOf<String>()

    // Check SUPABASE_URL (from BuildConfig)
    val supabaseUrl = getStringFromBuildConfig("SUPABASE_URL")
    when {
      supabaseUrl.isEmpty() -> {
        missingVars.add("SUPABASE_URL (BuildConfig)")
      }
      !supabaseUrl.startsWith("https://") -> {
        errors.add("SUPABASE_URL must be HTTPS (received: $supabaseUrl)")
      }
    }

    // Check SUPABASE_ANON_KEY
    val supabaseKey = getStringFromBuildConfig("SUPABASE_ANON_KEY")
    when {
      supabaseKey.isEmpty() -> {
        missingVars.add("SUPABASE_ANON_KEY (BuildConfig)")
      }
      // Accept both modern publishable keys (sb_...) and legacy JWT-like anon keys.
      // Length is not a reliable validity signal and caused false startup crashes.
      !(supabaseKey.startsWith("sb_") || supabaseKey.startsWith("eyJ")) -> {
        Log.w(TAG, "SUPABASE_ANON_KEY has an unexpected format; continuing startup")
      }
    }

    // Check SENTRY_DSN (optional — app works without it, Sentry just becomes a no-op)
    val sentryDsn = getStringFromBuildConfig("SENTRY_DSN")
    if (sentryDsn.isNotEmpty() && !sentryDsn.startsWith("https://")) {
      errors.add("SENTRY_DSN must be HTTPS (received: $sentryDsn)")
    }

    // Report errors
    if (missingVars.isNotEmpty() || errors.isNotEmpty()) {
      val message = buildString {
        appendLine("[roam-android] Environment validation failed:")
        appendLine()
        if (missingVars.isNotEmpty()) {
          appendLine("Missing required variables:")
          missingVars.forEach { appendLine("  - $it") }
        }
        if (errors.isNotEmpty()) {
          appendLine("Invalid variable values:")
          errors.forEach { appendLine("  - $it") }
        }
        appendLine()
        appendLine("The app will not function without these values.")
        appendLine("See android/README.md or docs/DEPLOYMENT_CHECKLIST.md for setup.")
      }

      Log.e(TAG, message)

      // Send error to Sentry if possible
      try {
        if (sentryDsn.isNotEmpty()) {
          Sentry.captureException(IllegalStateException(message))
        }
      } catch (e: Exception) {
        Log.e(TAG, "Failed to report env error to Sentry", e)
      }

      throw IllegalStateException(message)
    }

    Log.i(TAG, "Environment validation passed")
  }

  /**
   * Safely retrieve a BuildConfig string value.
   * BuildConfig is generated at build time from build.gradle.kts buildConfigField directives.
   * Returns empty string if the field doesn't exist or is null.
   */
  private fun getStringFromBuildConfig(fieldName: String): String {
    return try {
      val field = app.roam.android.BuildConfig::class.java.getField(fieldName)
      field.get(null) as? String ?: ""
    } catch (e: NoSuchFieldException) {
      Log.w(TAG, "BuildConfig field not found: $fieldName", e)
      ""
    } catch (e: Exception) {
      Log.w(TAG, "Failed to read BuildConfig.$fieldName", e)
      ""
    }
  }
}
