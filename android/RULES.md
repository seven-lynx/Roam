# RULES.md ΓÇö Android

Read `../RULES.md` first. This file adds Android-platform rules.

## Stack
- Kotlin
- Jetpack Compose
- Material 3
- Supabase Kotlin SDK
- FCM (Firebase Cloud Messaging) for push notifications
- Gradle (Kotlin DSL)

## Hard rules (android-specific)

### A.1 Secrets are loaded from `local.properties`, not env vars
Android does not have a `.env` equivalent. All build-time secrets come from `local.properties` (gitignored) and are exposed via `BuildConfig`:
```kotlin
// Env.kt
val SUPABASE_URL = BuildConfig.SUPABASE_URL
val SUPABASE_ANON_KEY = BuildConfig.SUPABASE_ANON_KEY
```

Do not commit `local.properties`. Do not paste secrets in `build.gradle.kts` defaults.

### A.2 FCM service account is stored as a JSON blob in a Vercel env var, not in the repo
The push-notify edge function needs FCM access. The Firebase service account JSON lives in `FCM_SERVICE_ACCOUNT` on Vercel. The file `*-firebase-adminsdk-*.json` is gitignored and excluded from the public mirror ΓÇö **do not commit or reference it.**

### A.3 URL normalization must match the canonical implementations
The Kotlin `normalizeUrl()` function must stay in sync with:
- `supabase/functions/_shared/normalise.ts`
- `extension/src/background/background.ts`
- `scripts/lib/seed.js`

When you add a tracking param, update all four.

### A.4 Keystore is `roam-release.jks`, gitignored
The release keystore lives at `android/roam-release.jks` and is `.gitignore`d. Do not commit, do not paste contents in any tracked file.

## Code patterns

- **State management:** Compose `ViewModel` + `StateFlow`. No LiveData in new code.
- **Navigation:** Compose Navigation. Single graph in `MainNavGraph.kt`.
- **Theming:** Material 3 with custom `RoamTheme`.
- **Logging:** Timber + Sentry. No raw `Log.d`/`Log.e` in `src/main/`.
- **Coroutines:** structured concurrency. No `GlobalScope.launch` outside tests.

## Forbidden patterns (android-specific)

- `GlobalScope.launch` in production code
- Hardcoded URLs (use `BuildConfig.SUPABASE_URL`)
- `Log.d`/`Log.e` in `src/main/` (use Timber + Sentry)
- Committing `local.properties`, `roam-release.jks`, or any `*-firebase-adminsdk-*.json`
- `runBlocking` outside tests
- `!!` not-null assertions on nullable types from network calls
- Adding new LiveData (use StateFlow)

## Permissions table

| Permission | Used by | Justification |
|---|---|---|
| `INTERNET` | All network | Required for Supabase calls |
| `POST_NOTIFICATIONS` | `NotificationHelper` | Android 13+ push notifications |
| `RECEIVE_BOOT_COMPLETED` | `BootReceiver` | Re-schedule alarms after reboot |
| `VIBRATE` | `HapticFeedback` | Tap feedback |

No permission is granted that isn't in this table.