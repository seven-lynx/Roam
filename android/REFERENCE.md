# Android App — Developer Reference

Accurate as of Stage 14 (May 2026). If a file listed here doesn't exist or a file exists that isn't listed, update this document.

---

## Stack

| Layer | Library | Version |
|---|---|---|
| Language | Kotlin | 2.2.10 |
| UI | Jetpack Compose + Material3 | BOM `2024.12.01` → M3 `1.3.1` |
| Navigation | `navigation-compose` | `2.8.4` |
| Async | Kotlin Coroutines + Flow | bundled |
| Backend | Supabase Kotlin SDK | BOM `3.0.2` |
| HTTP | Ktor Android engine | `3.0.3` |
| Image loading | Coil 3 | `3.1.0` |
| Background jobs | WorkManager | `2.9.1` |
| Error tracking | Sentry Android | `7.22.1` |
| Baseline profiles | profileinstaller | `1.3.1` |
| `minSdk` | 26 (Android 8.0) | |
| `targetSdk` / `compileSdk` | 35 | |

---

## Directory Map

```
android/
├── app/
│   ├── proguard-rules.pro          # R8 keep rules (Supabase, Sentry, Ktor, serialization)
│   ├── src/
│   │   ├── main/
│   │   │   ├── baseline-prof.txt   # AOT hints for profileinstaller
│   │   │   ├── AndroidManifest.xml
│   │   │   └── java/app/roam/android/
│   │   │       ├── RoamApplication.kt          # Env check → Supabase → Sentry → WorkManager
│   │   │       ├── MainActivity.kt             # Single activity; auth state router
│   │   │       ├── data/
│   │   │       │   ├── SupabaseClient.kt        # Global `supabase` singleton (val)
│   │   │       │   └── repository/
│   │   │       │       └── RoamRepository.kt    # All network calls (Edge Functions + PostgREST)
│   │   │       ├── model/
│   │   │       │   ├── CategoryItem.kt          # Category + FALLBACK list
│   │   │       │   ├── Collection.kt
│   │   │       │   ├── RoamUrl.kt               # Shape returned by /functions/v1/roam
│   │   │       │   ├── UserProfile.kt
│   │   │       │   └── UserSettings.kt
│   │   │       ├── ui/
│   │   │       │   ├── component/
│   │   │       │   │   ├── BottomBar.kt          # 4-tab NavigationBar
│   │   │       │   │   ├── ConfigBottomSheet.kt  # Long-press context menu
│   │   │       │   │   ├── DiscoverCard.kt       # Full-bleed card with OG image
│   │   │       │   │   ├── DiscoverCardSkeleton.kt  # Shimmer placeholder (loading)
│   │   │       │   │   ├── RoamWebView.kt        # AndroidView WebView wrapper
│   │   │       │   │   └── SubmitBottomSheet.kt  # Submit-a-URL sheet
│   │   │       │   ├── screen/
│   │   │       │   │   ├── MainScreen.kt         # NavHost + DiscoverTab
│   │   │       │   │   ├── SavedScreen.kt        # Saved URLs + Collections tabs
│   │   │       │   │   ├── ProfileScreen.kt      # Avatar, bio, category chips, stats
│   │   │       │   │   ├── SettingsScreen.kt     # Toggles, language, sign-out
│   │   │       │   │   ├── CategoryOnboardingScreen.kt  # Post-signup interest picker
│   │   │       │   │   ├── OnboardingScreen.kt   # Sign-in/sign-up
│   │   │       │   │   └── SplashScreen.kt
│   │   │       │   └── theme/
│   │   │       ├── util/
│   │   │       │   ├── ConnectivityFlow.kt       # Flow<Boolean> via NetworkCallback
│   │   │       │   ├── Env.kt                    # Startup validation of BuildConfig fields
│   │   │       │   ├── Logger.kt
│   │   │       │   └── SwipeDirection.kt         # resolveSwipeAction(dx, dy) → "roam"|"like"|"skip"|null
│   │   │       ├── viewmodel/
│   │   │       │   ├── AuthViewModel.kt          # Loading/Unauthenticated/NeedsOnboarding/Authenticated
│   │   │       │   └── MainViewModel.kt          # All discovery + profile + offline-queue state
│   │   │       └── worker/
│   │   │           └── TokenRefreshWorker.kt     # CoroutineWorker; 12-hour periodic token refresh
│   │   └── test/
│   │       └── java/app/roam/android/
│   │           ├── data/repository/
│   │           │   └── RoamRepositoryTest.kt     # JSON deserialization + input validation
│   │           ├── util/
│   │           │   └── SwipeDirectionTest.kt     # 21 boundary/axis/threshold tests
│   │           └── viewmodel/
│   │               └── MainViewModelTest.kt      # 22 tests — state transitions, ratings, prefetch
├── build.gradle.kts                # Plugin versions
├── gradle.properties               # R8 full mode, JVM args
├── local.properties                # NEVER COMMIT — SUPABASE_URL, SUPABASE_ANON_KEY, SENTRY_DSN
├── local.properties.example        # Template (committed, no secrets)
├── REFERENCE.md                    # This file
├── README.md                       # Quick-start
└── TESTING.md                      # How to run tests
```

---

## Architecture

### Single-activity, single-ViewModel pattern

```
MainActivity
  └── setContent { RoamTheme }
        └── AuthViewModel.authState (StateFlow)
              ├── Loading        → SplashScreen
              ├── Unauthenticated → OnboardingScreen
              ├── NeedsOnboarding → CategoryOnboardingScreen(mainVm)
              └── Authenticated  → MainScreen(mainVm)
                    └── NavHost (4 routes)
                          ├── Discover → DiscoverTab(mainVm)
                          ├── Saved   → SavedScreen(mainVm)
                          ├── Profile → ProfileScreen(mainVm)
                          └── Settings → SettingsScreen(mainVm)
```

### RoamState

```kotlin
sealed interface RoamState {
    Idle         // app just started, nothing fetched yet
    Loading      // waiting for Edge Function response (shows shimmer skeleton)
    Loaded(roamUrl: RoamUrl)  // card displayed
    Exhausted    // 404 — user has seen everything in the pool
    Error(message: String)    // network/server failure (shows banner + Retry)
}
```

### Prefetch pipeline

On every `roam()` that completes successfully, `launchPrefetch()` fires in the background and stores the result in `_prefetchedUrl`. The **next** `roam()` call consumes it instantly (no Loading state shown), then fires `launchPrefetch()` again. This keeps the app feeling instant.

### Offline queue

`thumbsUp` / `thumbsDown` catch `IOException` and push a `PendingRating` onto an in-memory `ArrayDeque`. `connectivityFlow` in `init` watches network state; when back online, `flushPendingRatings()` drains and retries each one. Ratings that fail for non-IO reasons are reported to Sentry and dropped.

---

## Key Patterns

### Supabase calls all go through `RoamRepository`

The `supabase` singleton is an `internal val` in `data/SupabaseClient.kt`. Repository methods wrap every call in `runCatching` — callers never throw. ViewModels call repository methods inside `viewModelScope.launch { runCatching { ... } }`.

### No `isNull` in PostgREST filter DSL

The Supabase Kotlin SDK (BOM 3.x) does not expose an `isNull` filter DSL extension. Work around by fetching all rows and filtering in-memory:
```kotlin
.decodeList<Row>().filter { it.subcategoryId == null }
```

### Coil 3 image loading

No `.crossfade()` on `ImageRequest.Builder`. Use `SubcomposeAsyncImage` with explicit `loading`, `error`, and `success` slots. Do not use `AsyncImage` for content that needs placeholder control.

### Spring physics everywhere

All animations use `spring()` — swipe return, NavHost enter/exit transitions, shimmer is the only `tween`. No `AnimatedVisibility` with default spec.

### `BuildConfig` fields

| Field | Source | Purpose |
|---|---|---|
| `SUPABASE_URL` | `local.properties` | Supabase project URL |
| `SUPABASE_ANON_KEY` | `local.properties` | Supabase anon key |
| `SENTRY_DSN` | `local.properties` | Sentry DSN (optional — app works without it) |

`Env.validateAtStartup()` in `RoamApplication.onCreate()` checks `SUPABASE_URL` and `SUPABASE_ANON_KEY` are present and HTTPS. `SENTRY_DSN` is optional — missing means Sentry is silently skipped.

---

## Build

```powershell
# Set JAVA_HOME to Android Studio's JBR
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
cd android

# Compile only
.\gradlew.bat compileDebugKotlin

# Run unit tests
.\gradlew.bat testDebugUnitTest

# Build debug APK
.\gradlew.bat assembleDebug

# Build release APK (needs signing config)
.\gradlew.bat assembleRelease
```

---

## AuthState Flow

```
app start
  └─ AuthViewModel.init
        └─ supabase.auth.sessionStatus.collect
              ├─ Authenticated → checkOnboarding()
              │     ├─ getUserCategoryIds().isEmpty() → NeedsOnboarding
              │     └─ has categories             → Authenticated
              ├─ NotAuthenticated → Unauthenticated
              └─ (loading)       → Loading (shows SplashScreen)
```

`markOnboardingComplete()` on `AuthViewModel` sets state directly to `Authenticated` — no re-check needed.

---

## Test coverage

| File | Tests | What's covered |
|---|---|---|
| `MainViewModelTest` | 22 | Initial state, sheet toggles, collection filter, language prefs, paywall pref, roam transitions (Loaded/Exhausted/Error/offline), prefetch cache, thumbsUp/thumbsDown rating + submit-sheet fallback, saveForLater/removeSavedUrl |
| `RoamRepositoryTest` | 9 | `rate()` input validation, `UserSettings` defaults, `RoamUrl` full/minimal/unknown-keys JSON deserialization |
| `SwipeDirectionTest` | 21 | Threshold boundary (at/above/below), dominant-axis, 45° diagonal, upward swipe, zero drag, custom threshold |

Run with:
```powershell
.\gradlew.bat testDebugUnitTest
```
HTML report: `app/build/reports/tests/testDebugUnitTest/index.html`
