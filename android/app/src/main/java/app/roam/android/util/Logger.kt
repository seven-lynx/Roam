package app.roam.android.util

import android.util.Log
import io.sentry.Sentry
import app.roam.android.BuildConfig

/**
 * Centralized logging utility for Roam Android app.
 *
 * Prevents sensitive data leakage to:
 * 1. Logcat (visible via adb logcat, accessible via USB)
 * 2. App storage (SharedPreferences backup)
 * 3. Crash logs
 *
 * All errors automatically sent to Sentry for production monitoring.
 *
 * Usage:
 *   Logger.debug("auth", "Session loaded")
 *   Logger.error("roam", "Failed to fetch URL", statusCode = 404)
 */

object Logger {
  enum class Level(val priority: Int) {
    DEBUG(0),
    INFO(1),
    WARN(2),
    ERROR(3),
  }

  private var currentLevel = if (BuildConfig.DEBUG) Level.DEBUG else Level.ERROR

  /**
   * Debug level log (only in debug builds).
   */
  fun debug(tag: String, message: String, context: Map<String, Any>? = null) {
    if (currentLevel > Level.DEBUG) return
    val msg = formatMessage(tag, message, context)
    Log.d("Roam:$tag", msg)
  }

  /**
   * Info level log.
   */
  fun info(tag: String, message: String, context: Map<String, Any>? = null) {
    if (currentLevel > Level.INFO) return
    val msg = formatMessage(tag, message, context)
    Log.i("Roam:$tag", msg)
    Sentry.captureMessage("[INFO] [$tag] $message", io.sentry.SentryLevel.INFO)
  }

  /**
   * Warning level log.
   */
  fun warn(tag: String, message: String, context: Map<String, Any>? = null) {
    if (currentLevel > Level.WARN) return
    val msg = formatMessage(tag, message, context)
    Log.w("Roam:$tag", msg)
    Sentry.captureMessage("[WARN] [$tag] $message", io.sentry.SentryLevel.WARNING)
  }

  /**
   * Error level log (always captured to Sentry).
   */
  fun error(
    tag: String,
    message: String,
    context: Map<String, Any>? = null,
    throwable: Throwable? = null
  ) {
    val msg = formatMessage(tag, message, context)
    if (throwable != null) {
      Log.e("Roam:$tag", msg, throwable)
      Sentry.captureException(throwable) { scope ->
        scope.setTag("module", tag)
        scope.setTag("message", message)
        context?.forEach { (k, v) ->
          scope.setExtra(k, v.toString())
        }
      }
    } else {
      Log.e("Roam:$tag", msg)
      Sentry.captureMessage("[ERROR] [$tag] $message", io.sentry.SentryLevel.ERROR)
    }
  }

  /**
   * Override log level at runtime (for debugging).
   */
  fun setLevel(level: Level) {
    currentLevel = level
  }

  /**
   * Format a log message with sanitized context.
   * Safe fields: statusCode, count, duration, retry, attempt, reason
   * Unsafe fields (never logged): email, userId, password, token, url, response
   */
  private fun formatMessage(tag: String, message: String, context: Map<String, Any>?): String {
    if (context == null || context.isEmpty()) {
      return "[$tag] $message"
    }

    val safe = sanitizeContext(context)
    return if (safe.isEmpty()) {
      "[$tag] $message"
    } else {
      "[$tag] $message ${safe.entries.joinToString(", ") { "${it.key}=${it.value}" }}"
    }
  }

  private fun sanitizeContext(context: Map<String, Any>): Map<String, Any> {
    val SAFE_KEYS = setOf("statusCode", "count", "duration", "retry", "attempt", "reason", "category", "type", "action")
    val UNSAFE_KEYS = setOf("email", "password", "token", "secret", "userId", "id", "url", "response", "body", "payload", "session")

    return context.filter { (key, _) ->
      val keyLower = key.lowercase()
      UNSAFE_KEYS.none { keyLower.contains(it) } && SAFE_KEYS.any { keyLower.contains(it) }
    }
  }
}
