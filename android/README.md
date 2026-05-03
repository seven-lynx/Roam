# Roam Android

Native Android app built with Kotlin 2.2.10 and Jetpack Compose. Users tap Roam to instantly load a random, interest-matched URL from the discovery pool. Ratings are queued offline and flushed when connectivity returns.

## Tech Stack

| Library | Purpose |
|---|---|
| Kotlin + Coroutines | Language + async |
| Jetpack Compose (Material 3) | Declarative UI |
| Jetpack Navigation | Fragment-less nav |
| Supabase Kotlin SDK `3.0.2` | Auth + DB + Storage + Edge Functions |
| Ktor OkHttp engine | HTTP client |
| AndroidX WebKit | WebView dark mode |
| Coil 3 | Async image loading |
| Sentry Android `7.22.1` | Crash + error reporting |
| WorkManager | Background token refresh |

## Architecture

Single-activity MVVM. One `MainViewModel` owns all discovery, profile, settings, and collection state. One `RoamRepository` handles all Supabase calls.

```
MainActivity
  └─ Compose NavHost
       ├─ DiscoverTab       ← RoamWebView + status bar
       ├─ SettingsScreen
       ├─ ProfileScreen
       └─ SavedScreen

MainViewModel  ←──────────────────  RoamRepository
  ├─ RoamState (Idle/Loading/Loaded/Exhausted/Error)
  ├─ prefetchQueue (ArrayDeque<RoamUrl>, target = 3)
  ├─ savedUrls (SharedPreferences)
  ├─ webDarkMode (SharedPreferences)
  ├─ skipPaywalled + preferredLanguages (Supabase user_settings)
  ├─ collections, categories, profile
  └─ pendingRatings (offline queue → flushed on reconnect)
```

## Directory Structure

```
app/src/main/java/app/roam/android/
├── MainActivity.kt                  # Single activity, auth routing
├── RoamApplication.kt               # Sentry init
├── data/
│   ├── SupabaseClient.kt            # Singleton client (URL/key from BuildConfig)
│   └── repository/
│       └── RoamRepository.kt        # All Supabase calls
├── model/
│   ├── RoamUrl.kt                   # Discovery result
│   ├── CategoryItem.kt
│   ├── Collection.kt
│   ├── UserProfile.kt
│   └── UserSettings.kt
├── ui/
│   ├── component/
│   │   ├── BottomBar.kt             # Skip / Roam / Settings / Like
│   │   ├── RoamWebView.kt           # WebView with lifecycle + dark mode
│   │   ├── ConfigBottomSheet.kt     # Per-page actions (save, share, report…)
│   │   ├── SubmitBottomSheet.kt
│   │   ├── DiscoverCard.kt
│   │   └── DiscoverCardSkeleton.kt
│   ├── screen/
│   │   ├── MainScreen.kt            # Nav host + DiscoverTab
│   │   ├── SettingsScreen.kt
│   │   ├── ProfileScreen.kt
│   │   ├── SavedScreen.kt
│   │   ├── OnboardingScreen.kt
│   │   ├── CategoryOnboardingScreen.kt
│   │   └── SplashScreen.kt
│   └── theme/
│       ├── Theme.kt                 # RoamTheme (dark by default)
│       ├── Color.kt
│       └── Type.kt
├── viewmodel/
│   ├── MainViewModel.kt             # All discovery + settings state
│   └── AuthViewModel.kt             # Auth state (Loading/Unauthenticated/Authenticated…)
├── util/
│   ├── ConnectivityFlow.kt          # Flow<Boolean> — online/offline
│   ├── Env.kt
│   ├── Logger.kt
│   └── SwipeDirection.kt
└── worker/
    └── TokenRefreshWorker.kt        # Periodic Supabase session refresh
```

## Setup

### Prerequisites

- Android Studio Hedgehog or newer
- JDK 17
- Android SDK 26+ (minSdk = 26, targetSdk = 35)

### local.properties

Copy `local.properties.example` → `local.properties` and fill in:

```
sdk.dir=/path/to/Android/sdk
SUPABASE_URL=https://yrhckctwtdjowulfuaqc.supabase.co
SUPABASE_ANON_KEY=sb_publishable_...
SENTRY_DSN=https://...@...ingest.us.sentry.io/...
```

These are injected at build time via `BuildConfig` and never committed.

### Build & Install

```bash
cd android

# Build + install debug APK on connected device
./gradlew installDebug

# Build release APK (requires signing config)
./gradlew assembleRelease

# Run unit tests
./gradlew test

# Clean build
./gradlew clean installDebug
```

## Key Features

### Prefetch Queue

`MainViewModel` maintains two queues so the app is always ahead of the user:

| Queue | Size | What it holds |
|---|---|---|
| **Hot** | 3 | HEAD-validated URLs — served instantly on tap |
| **Warm** | 5 | Fetched from the API but not yet validated — promoted to hot as slots open |

On each Roam tap, a URL pops off the hot queue instantly. `startPrefillQueue()` immediately refills hot by HEAD-checking entries from warm (5 s timeout) while simultaneously refilling warm with fresh API calls. This keeps up to 8 URLs buffered at all times.

If both queues are empty (first launch, filter change, offline recovery), the app falls back to a live fetch with up to 3 retries.

### Discovery Flow

1. User taps **Roam** → `MainViewModel.roam()` pops from prefetch queue or fetches live
2. URL loaded in `RoamWebView` (full-screen, lifecycle-aware, state-saved across backgrounding)
3. Status bar shows `Category · domain` once page loads
4. **Like** (thumbs up) → rates +1, navigates to next URL
5. **Skip** (thumbs down) → rates -1, navigates to next URL
6. Long-press config sheet → save for later, share, add to collection, report broken link, roam within category

### Offline Ratings

Ratings that fail due to no connectivity are pushed onto `pendingRatings`. `connectivityFlow` observes network state; when the device comes back online, all queued ratings are flushed to Supabase.

### WebView Dark Mode

`RoamWebView` creates the WebView with a `UI_MODE_NIGHT_YES` configuration context, then calls `WebSettingsCompat.setAlgorithmicDarkeningAllowed(true)` (API 33+) or `WebSettingsCompat.setForceDark(FORCE_DARK_ON)` (API 29–32). This forces dark rendering regardless of the system theme setting. Controlled by the `webDarkMode` ViewModel state (on by default, persisted to SharedPreferences); there is currently no settings UI toggle.

### WebView State Persistence

`rememberSaveable { Bundle() }` stores `WebView.saveState()` output across Compose recompositions and process death. `DisposableEffect` hooks `onPause`/`onResume` to `pauseTimers()`/`resumeTimers()`, preventing the blank-screen bug when the app is backgrounded or the screen is locked.

## Settings

| Setting | Default | Storage |
|---|---|---|
| Skip paywalled sites | Off | Supabase `user_settings` |
| Dark mode for web pages | On | SharedPreferences (no UI toggle — always on) |
| Preferred languages | `["en"]` | Supabase `user_settings` |
| Interest categories | (onboarding) | Supabase `user_categories` |

## Permissions

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.VIBRATE" />
```

- **INTERNET** — Supabase + WebView page loads
- **ACCESS_NETWORK_STATE** — Offline detection for rating queue
- **VIBRATE** — Haptic feedback on Like/Skip

## Error Handling

- **Network errors** → offline message in status bar; ratings queued for retry
- **Roam failures** → up to 3 retries with 500 ms backoff; `RoamState.Error` shown with retry button
- **Timeouts** → Ktor `requestTimeoutMillis = 60_000`, OkHttp `callTimeout = 30 s`
- **Unhandled exceptions** → Sentry captures with device info, app version, user ID

## Troubleshooting

**Build fails / Gradle sync error**
```bash
./gradlew clean
./gradlew --refresh-dependencies installDebug
```

**App crashes on startup**
- Check `local.properties` has all three keys (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SENTRY_DSN`)
- Check Logcat for `FATAL EXCEPTION`

**"Discovery failed" on roam**
- Verify the `roam` Supabase Edge Function is deployed:
  ```
  supabase functions deploy roam --project-ref yrhckctwtdjowulfuaqc --workdir /path/to/roam
  ```
- Check Sentry for `WORKER_ERROR` events

**WebView appears blank after returning from background**
- Ensure `RoamWebView` lifecycle observer is active (not removed)
- The `savedState` bundle survives recomposition via `rememberSaveable`
