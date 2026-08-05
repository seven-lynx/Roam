# Sentry Audit Report — Roam Android App

**Date:** 2026-06-11  
**Auditor:** Automated codebase review  
**Scope:** All Sentry-related configuration, initialization, and usage in `android/`

---

## 1. Overview

| Item | Detail |
|---|---|
| **Sentry SDK (runtime)** | `io.sentry:sentry-android:8.4.0` |
| **Sentry Gradle Plugin** | `io.sentry.android.gradle:6.10.0` |
| **DSN source** | `local.properties` → `BuildConfig.SENTRY_DSN` |
| **Initialization** | `RoamApplication.onCreate()` — gated on non-empty DSN |
| **Environment tagging** | `"development"` (DEBUG) / `"production"` (release) |
| **Traces sample rate** | 1.0 (debug) / 0.1 (production) |
| **ProGuard mapping upload** | Configured via `sentry { }` block with env vars |
| **User interaction tracing** | **Disabled** (`isEnableUserInteractionTracing = false`) |

---

## 2. Files Using Sentry

| File | Usage |
|---|---|
| `RoamApplication.kt` | Init, `beforeSend` noise filter |
| `MainViewModel.kt` | `Sentry.captureException()`, `Sentry.captureMessage()` for data layer errors |
| `FCMService.kt` | `Sentry.addBreadcrumb()` for push notification lifecycle |
| `RoamWebView.kt` | `Sentry.addBreadcrumb()` for WebView navigation/errors |
| `MainActivity.kt` | `Sentry.captureException()` for deep-link auth failures |
| `Logger.kt` | Info/Warn/Error levels forwarded to Sentry |
| `Env.kt` | Validation errors captured to Sentry |

### 2.1 Key Code Locations

**Initialization** (`RoamApplication.kt` lines 28–65):
```kotlin
if (BuildConfig.SENTRY_DSN.isNotEmpty()) {
    try {
        SentryAndroid.init(this) { options ->
            options.dsn = BuildConfig.SENTRY_DSN
            options.environment = if (BuildConfig.DEBUG) "development" else "production"
            options.tracesSampleRate = if (BuildConfig.DEBUG) 1.0 else 0.1
            options.isEnableUserInteractionTracing = false
            // ... beforeSend noise filter ...
        }
    } catch (e: Exception) {
        android.util.Log.e("RoamApplication", "Failed to initialize Sentry", e)
    }
}
```

**DSN Injection** (`app/build.gradle.kts` lines 33–36):
```kotlin
buildConfigField(
    "String", "SENTRY_DSN",
    "\"${localProperties[\"SENTRY_DSN\"] ?: ""}\""
)
```

**ProGuard Mapping Upload** (`app/build.gradle.kts` lines 151–173):
```kotlin
sentry {
    val sentryAuthToken = localProperties.getProperty("SENTRY_AUTH_TOKEN")
        ?: System.getenv("SENTRY_AUTH_TOKEN")
    val sentryOrg = localProperties.getProperty("SENTRY_ORG")
        ?: System.getenv("SENTRY_ORG")
    val sentryProject = localProperties.getProperty("SENTRY_PROJECT")
        ?: System.getenv("SENTRY_PROJECT")
    val sentryUrl = localProperties.getProperty("SENTRY_URL")
        ?: System.getenv("SENTRY_URL")

    url.set(sentryUrl ?: "https://us.sentry.io/")

    val hasSentryInfo = sentryAuthToken != null
        && sentryOrg != null
        && sentryProject != null
    if (hasSentryInfo) {
        authToken.set(sentryAuthToken)
        org.set(sentryOrg)
        projectName.set(sentryProject)
    }

    autoUploadProguardMapping.set(hasSentryInfo)
    includeProguardMapping.set(true)
    uploadNativeSymbols.set(false)
}
```

---

## 3. Strengths

### 3.1 DSN is properly secured
- The DSN lives exclusively in `local.properties` (never committed to Git).
- Injected at compile time via `buildConfigField` → `BuildConfig.SENTRY_DSN`.
- The `.gitignore` correctly covers `local.properties`.
- CI (`compileDebugKotlin`) falls back to an empty string, making Sentry a safe no-op during automated builds.

### 3.2 Graceful degradation
- If `SENTRY_DSN` is empty or missing, `SentryAndroid.init()` is never called — **zero-cost when absent**.
- If init itself throws (e.g., missing WebView on exotic devices), the exception is caught and logged via `android.util.Log` — the app does not crash.
- This pattern is robust against edge cases and ensures Sentry is never a point of failure.

### 3.3 Robust beforeSend noise filter
The `beforeSend` callback drops two classes of noise that would otherwise pollute the Sentry dashboard:

1. **`SentryHttpClientException`** — HTTP 500s from Sentry's own ingestion endpoint (ROAM-ANDROID-7).
2. **`HttpRequestException` with DNS failure messages** — transient network conditions the app already handles gracefully (ROAM-ANDROID-Q/6/H):
   - `"Unable to resolve host"` (case-insensitive)
   - `"No address associated"` (case-insensitive)
   - `"UnknownHostException"` (case-insensitive)

Real app-thrown exceptions still reach Sentry via explicit `Sentry.captureException()` calls.

### 3.4 Centralized logging with PII protection
`Logger.kt` implements a whitelist/blacklist sanitization:
- **Safe keys** (logged): `statusCode`, `count`, `duration`, `retry`, `attempt`, `reason`, `category`, `type`, `action`
- **Unsafe keys** (redacted): `email`, `password`, `token`, `secret`, `userId`, `id`, `url`, `response`, `body`, `payload`, `session`

Context maps containing unsafe keys are silently stripped before reaching Logcat or Sentry. This prevents accidental leakage of user credentials, session tokens, URLs with query parameters, and raw API responses.

### 3.5 ProGuard/R8 rules are in place
- Explicit `-keep class io.sentry.** { *; }` and `-dontwarn io.sentry.**` in `proguard-rules.pro`.
- Sentry Gradle plugin also ships its own consumer ProGuard rules.
- `autoUploadProguardMapping` is enabled when auth credentials are present.
- ProGuard is only enabled for release builds (`isMinifyEnabled = true` only in `release` build type).

### 3.6 Breadcrumb coverage
Meaningful breadcrumbs are added for:
- **FCM token lifecycle**: token received (with prefix), registration success, registration failure
- **Push message received**: title stored as data
- **WebView navigation**: page start (URL truncated to 120 chars), page finish, load error (with error code), renderer process killed (with renderer priority at exit)

### 3.7 Environment differentiation
- Debug builds: `environment = "development"`, traces sample rate = 1.0
- Release builds: `environment = "production"`, traces sample rate = 0.1
- Clear separation prevents development noise from mixing with production data.

### 3.8 Privacy-conscious defaults
- User interaction tracing is explicitly disabled (`isEnableUserInteractionTracing = false`).
- No automatic screen tracking, click tracking, or gesture recording.
- Only explicit `Sentry.captureException()` and `Sentry.captureMessage()` calls reach Sentry.

---

## 4. Issues & Recommendations

### 4.1 [MEDIUM] No Android-specific Sentry CI/CD deployment job

**Finding:** The CI workflow (`ci.yml`) only runs `compileDebugKotlin` for Android — it does **not** produce a release build, therefore it never uploads ProGuard mappings to Sentry. The `deploy.yml` workflow has no Android job at all.

**Impact:** Release builds are presumably done locally or via a separate process (e.g., Android Studio → Google Play). If ProGuard mappings are not uploaded at release time, stack traces for obfuscated release builds will be unreadable in Sentry.

**Recommendation:** Either:
- Add a GitHub Actions workflow for Android release builds with the Sentry upload step, or
- Document in `android/README.md` that developers must ensure `local.properties` contains `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` before running `./gradlew assembleRelease`, so the Sentry Gradle plugin uploads mappings automatically.

### 4.2 [LOW] Sentry SDK version is behind latest

| Component | Current | Latest (as of 2026-06) |
|---|---|---|
| `sentry-android` | 8.4.0 | 8.8.x |
| `sentry-android-gradle-plugin` | 6.10.0 | 6.12.x |

**Impact:** Missing bug fixes and performance improvements.

**Recommendation:** Bump both to latest stable versions. Test that the `beforeSend` filter still works (API surface for `SentryOptions.BeforeSendCallback` has been historically stable).

### 4.3 [LOW] Logger.info() and Logger.warn() always send to Sentry

**Finding:** `Logger.info()` and `Logger.warn()` unconditionally call `Sentry.captureMessage()` whenever the current level permits. In production, `currentLevel` is `Level.ERROR`, so info/warn are effectively suppressed — but if the level is ever lowered (e.g., for debugging a production build), every info/warn call would generate a Sentry event.

**Impact:** Could cause Sentry quota exhaustion if level is changed in a release build.

**Recommendation:** Consider adding a separate `sentryLevel` threshold or a sampling mechanism for info/warn events. Alternatively, document that `setLevel()` must never be called with `INFO` or `DEBUG` in production.

### 4.4 [LOW] Missing Sentry release/version tagging

**Finding:** The Sentry init options do not set a `release` or `dist` property.

**Impact:** In the Sentry dashboard, events are not tagged with the app version (`1.0.13`, versionCode `16`), making it harder to correlate issues with specific releases and track regressions.

**Recommendation:** Add to the `options` block in `RoamApplication.kt`:
```kotlin
options.release = "${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})"
```
This ties every event to the exact app version visible in the Sentry UI.

### 4.5 [LOW] Breadcrumbs silently succeed without Sentry initialized

**Finding:** `FCMService.kt` and `RoamWebView.kt` call `Sentry.addBreadcrumb()` unconditionally, even when Sentry was never initialized (empty DSN). The Sentry SDK handles this gracefully (breadcrumbs become no-ops), but the calls still consume CPU cycles constructing `Breadcrumb` objects.

**Impact:** Minor performance waste in DSN-less builds. Negligible in practice.

**Recommendation:** Guard breadcrumb calls with a `BuildConfig.SENTRY_DSN.isNotEmpty()` check, or centralize breadcrumb logic in `Logger.kt`.

### 4.6 [INFO] OkHttp integration auto-captures network errors

**Finding:** The Sentry Android SDK bundles an OkHttp integration that automatically captures HTTP request/response data, including errors like connection timeouts. The `beforeSend` filter suppresses the noisiest classes, but other OkHttp-level exceptions could still appear.

**Impact:** Potential for unexpected error volume from network conditions.

**Recommendation:** Monitor Sentry for OkHttp-generated events and extend the `beforeSend` filter if new noise patterns emerge.

---

## 5. Summary Assessment

| Category | Rating | Notes |
|---|---|---|
| **Security (DSN)** | ✅ Excellent | Never committed; compile-time injection from local.properties |
| **PII/Data Leakage** | ✅ Excellent | Centralized Logger with whitelist/blacklist sanitization |
| **Crash Resilience** | ✅ Excellent | Init failure caught; empty DSN is a safe no-op |
| **Noise Filtering** | ✅ Excellent | beforeSend filter addresses known noise sources |
| **Breadcrumbs** | ✅ Good | Comprehensive for FCM & WebView; could be added for other user flows |
| **ProGuard** | ✅ Good | Keep rules present; mapping upload configured |
| **CI/CD Integration** | ⚠️ Partial | No release build in CI; mapping upload relies on local developer setup |
| **Versioning** | ⚠️ Missing | No `release`/`dist` tags set — hard to track regressions in Sentry |
| **SDK Freshness** | ⚠️ Slightly stale | ~4 minor versions behind on both SDK and plugin |

### Final Verdict

**The Sentry integration is well-architected with strong security and data-protection practices.** The DSN is never exposed in source control, PII is actively filtered from logs before reaching Sentry, and the initialization is resilient to failure. The `beforeSend` noise filter demonstrates proactive maintenance against known issue patterns (ROAM-ANDROID-7, ROAM-ANDROID-Q/6/H).

**The main gaps are:**
1. Release version tagging is missing — important for production monitoring
2. CI/CD pipeline doesn't handle Android release builds or ProGuard mapping uploads
3. SDK versions are slightly behind latest

**No critical issues found.** The three actionable recommendations (version tagging, CI/CD, SDK bump) are all straightforward improvements that would bring the integration to production-grade completeness.

---

## 6. Action Items (Priority-Ordered)

| Priority | Action | Effort |
|---|---|---|
| **High** | Add `options.release` tagging in `RoamApplication.kt` | 5 min |
| **Medium** | Create Android release build + Sentry upload in CI/CD or document manual process | 1-2 hrs |
| **Low** | Bump `sentry-android` to 8.8.x and Gradle plugin to 6.12.x | 30 min (incl. testing) |
| **Low** | Add Sentry sampling threshold for info/warn Logger calls | 15 min |
| **Low** | Guard breadcrumb calls with DSN presence check | 10 min |