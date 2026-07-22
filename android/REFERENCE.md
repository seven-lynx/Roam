# Android App — Developer Reference

Accurate as of Stage 14 (May 2026). If a file listed here doesn't exist or a file exists that isn't listed, update this document.

---

## Sentry — Fetching Unresolved Issues

Auth token is stored in `local.properties` as `SENTRY_AUTH_TOKEN`. Org slug: `7-lynx`. Project slug: `roam-android`.

```powershell
# 1. Pull unresolved issues (one-liner)
$t = (Get-Content .\local.properties | Select-String 'SENTRY_AUTH_TOKEN=(.+)').Matches.Groups[1].Value
$h = @{Authorization="Bearer $t"}
Invoke-RestMethod "https://us.sentry.io/api/0/projects/7-lynx/roam-android/issues/?query=is:unresolved&limit=25" -Headers $h |
  ForEach-Object { "$($_.shortId) [$($_.level)] x$($_.count) — $($_.title)" }

# 2. Get latest event for a specific issue (use numeric id from above)
$r = Invoke-WebRequest "https://us.sentry.io/api/0/issues/<NUMERIC_ID>/events/latest/" -Headers $h -UseBasicParsing
$r.Content | Out-File "$env:TEMP\sentry_event.json" -Encoding utf8

# 3. Parse with regex (PowerShell 5.1 ConvertFrom-Json chokes on deep JSON)
$raw = Get-Content "$env:TEMP\sentry_event.json" -Raw
[regex]::Matches($raw, '"type"\s*:\s*"([^"]+)"')   | Select-Object -First 3 | ForEach-Object { $_.Groups[1].Value }
[regex]::Matches($raw, '"value"\s*:\s*"([^"]{1,300})"') | Select-Object -First 3 | ForEach-Object { $_.Groups[1].Value }
[regex]::Matches($raw, '"url"\s*:\s*"([^"]+supabase[^"]+)"') | Select-Object -First 3 | ForEach-Object { $_.Groups[1].Value }
[regex]::Matches($raw, '"status_code"\s*:\s*(\d+)') | Select-Object -First 5 | ForEach-Object { $_.Groups[1].Value }
# App-level frames:
[regex]::Matches($raw, '"function"\s*:\s*"([^"]+)"') | Select-Object -Last 10 | ForEach-Object { $_.Groups[1].Value }

# 4. Resolve an issue
Invoke-RestMethod "https://us.sentry.io/api/0/issues/<NUMERIC_ID>/" -Method Put -Headers $h -Body '{"status":"resolved"}' -ContentType "application/json"
```

> Note: `ConvertFrom-Json` fails on large Sentry payloads in PowerShell 5.1 — always use regex on the raw string or save to file and use Python if available.

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
│   │   │       │   │   ├── RoamWebView.kt        # AndroidView WebView wrapper
│   │   │       │   │   └── SubmitBottomSheet.kt  # Submit-a-URL sheet
│   │   │       │   ├── screen/
│   │   │       │   │   ├── MainScreen.kt         # NavHost + DiscoverTab
│   │   │       │   │   ├── SavedScreen.kt        # Saved URLs + Collections tabs
│   │   │       │   │   ├── ProfileScreen.kt      # Avatar, bio, category chips, stats
│   │   │       │   │   ├── SettingsScreen.kt     # Toggles, language, sign-out
│   │   │       │   │   ├── CategoryOnboardingScreen.kt  # Post-signup interest picker
│   │   │       │   │   ├── OnboardingScreen.kt   # Google or email/password sign-in
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

`MainViewModel` maintains two in-memory queues protected by a `Mutex`:

| Queue | Target size | Contents |
|---|---|---|
| **Hot** (`hotQueue`) | 3 | HEAD-validated URLs — served instantly on tap, no Loading state shown |
| **Warm** (`warmQueue`) | 5 | Fetched from the Edge Function but not yet HEAD-checked |

`startPrefillQueue()` runs a loop that concurrently: (1) keeps warm topped up with cheap API calls, and (2) promotes warm entries to hot by HEAD-checking each URL. On every `roam()` that succeeds (from queue or live fetch), `startPrefillQueue()` is re-triggered to refill. If both queues are empty (first launch, filter change, offline recovery), `roam()` falls back to a live fetch with up to 3 retries.

### Offline queue

`thumbsUp` / `thumbsDown` catch `IOException` and push a `PendingRating` onto an in-memory `ArrayDeque`. `connectivityFlow` in `init` watches network state; when back online, `flushPendingRatings()` drains and retries each one. Ratings that fail for non-IO reasons are reported to Sentry and dropped.

---

## Key Patterns

### Supabase calls all go through `RoamRepository`

The `supabase` singleton is an `internal val` in `data/SupabaseClient.kt`. Repository methods wrap every call in `runCatching` — callers never throw. ViewModels call repository methods inside `viewModelScope.launch { runCatching { ... } }`.

### No `Columns.NONE` / server-side COUNT in supabase-kt BOM 3.0.2

The Supabase Kotlin SDK (BOM 3.x) does not expose `Columns.NONE` or a `count` named
parameter on `select()`. Work around by fetching only the `id` column and counting
client-side:
```kotlin
.select(Columns.list("id")) { filter { eq("user_id", userId) } }
.decodeList<IdRow>().size
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
| `MainViewModelTest` | 26 | Initial state, sheet toggles, collection filter, language prefs, paywall pref, roam transitions (Loaded/Exhausted/Error/offline), prefetch cache, thumbsUp/thumbsDown rating + submit-sheet fallback, saveForLater/removeSavedUrl |
| `RoamRepositoryTest` | 11 | `rate()` input validation, `UserSettings` defaults, `RoamUrl` full/minimal/unknown-keys JSON deserialization |
| `SwipeDirectionTest` | 15 | Threshold boundary (at/above/below), dominant-axis, 45° diagonal, upward swipe, zero drag, custom threshold |

Run with:
```powershell
.\gradlew.bat testDebugUnitTest
```
HTML report: `app/build/reports/tests/testDebugUnitTest/index.html`
