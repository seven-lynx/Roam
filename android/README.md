# Roam Android

Native Android app built with Kotlin and Jetpack Compose. Users tap Roam to instantly load a random, interest-matched URL from the discovery pool. Ratings are queued offline and flushed when connectivity returns.

## Tech Stack

| Library | Purpose |
|---|---|
| Kotlin | 2.2.20 |
| Coroutines | Async |
| Jetpack Compose (Material 3) | Declarative UI with full Material Design 3 polish |
| Jetpack Navigation | Fragment-less nav |
| Supabase Kotlin SDK `3.0.2` | Auth + DB + Storage + Edge Functions |
| Ktor OkHttp engine | HTTP client |
| AndroidX WebKit `1.12.1` | WebView dark mode |
| Coil 3 | Async image loading |
| Sentry Android `7.22.1` | Crash + error reporting |
| WorkManager | Background token refresh |

## Architecture

Single-activity MVVM. One `MainViewModel` owns all discovery, profile, settings, and collection state. One `RoamRepository` handles all Supabase calls.

```
MainActivity
  ΓööΓöÇ Compose NavHost
       Γö£ΓöÇ DiscoverTab       ΓåÉ RoamWebView + status bar
       Γö£ΓöÇ ActivityFeedScreen
       Γö£ΓöÇ BadgesScreen
       Γö£ΓöÇ LeaderboardScreen
       Γö£ΓöÇ NotificationsScreen
       Γö£ΓöÇ SettingsScreen
       Γö£ΓöÇ ProfileScreen
       Γö£ΓöÇ PublicProfileScreen
       Γö£ΓöÇ YouScreen         ΓåÉ hub; Admin/Mod panel entry when role unlocked
       Γö£ΓöÇ AdminScreen       ΓåÉ moderation queue, reports, beta (admin/mod)
       ΓööΓöÇ SavedScreen

MainViewModel  ΓåÉΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ  RoamRepository
  Γö£ΓöÇ RoamState (Idle/Loading/Loaded/Exhausted/Error)
  Γö£ΓöÇ hotQueue (ArrayDeque<RoamUrl>, target = 12, HEAD-validated)
  Γö£ΓöÇ warmQueue (ArrayDeque<RoamUrl>, target = 15, API-fetched)
  Γö£ΓöÇ adminModeEnabled / moderatorModeEnabled (JWT role, ephemeral)
  Γö£ΓöÇ savedUrls (SharedPreferences)
  Γö£ΓöÇ webDarkMode (SharedPreferences)
  Γö£ΓöÇ skipPaywalled + preferredLanguages (Supabase user_settings)
  Γö£ΓöÇ collections, categories, profile
  ΓööΓöÇ pendingRatings (offline queue ΓåÆ flushed on reconnect)
```


## Directory Structure

```
app/src/main/java/app/roam/android/
Γö£ΓöÇΓöÇ MainActivity.kt                  # Single activity, auth routing
Γö£ΓöÇΓöÇ RoamApplication.kt               # Sentry init
Γö£ΓöÇΓöÇ data/
Γöé   Γö£ΓöÇΓöÇ SupabaseClient.kt            # Singleton client (URL/key from BuildConfig)
Γöé   ΓööΓöÇΓöÇ repository/
Γöé       ΓööΓöÇΓöÇ RoamRepository.kt        # All Supabase calls
Γö£ΓöÇΓöÇ model/
Γöé   Γö£ΓöÇΓöÇ RoamUrl.kt                   # Discovery result
Γöé   Γö£ΓöÇΓöÇ CategoryItem.kt
Γöé   Γö£ΓöÇΓöÇ Collection.kt
Γöé   Γö£ΓöÇΓöÇ UserProfile.kt
Γöé   Γö£ΓöÇΓöÇ UserSettings.kt
Γöé   Γö£ΓöÇΓöÇ UrlHistoryEntry.kt
Γöé   Γö£ΓöÇΓöÇ Badge.kt                     # Badge definitions
Γöé   Γö£ΓöÇΓöÇ AppNotification.kt           # Push notification model
Γöé   Γö£ΓöÇΓöÇ FollowUser.kt                # Follow relationship
Γöé   Γö£ΓöÇΓöÇ PublicProfile.kt             # Public profile data
Γöé   ΓööΓöÇΓöÇ ActivityFeedItem.kt          # Activity feed entry
Γö£ΓöÇΓöÇ ui/
Γöé   Γö£ΓöÇΓöÇ component/
Γöé   Γöé   Γö£ΓöÇΓöÇ BottomBar.kt             # Skip / Roam / You / Like
Γöé   Γöé   Γö£ΓöÇΓöÇ RoamWebView.kt           # WebView + scroll memory + lifecycle
Γöé   Γöé   Γö£ΓöÇΓöÇ ConfigBottomSheet.kt     # Per-page actions (save, share, reportΓÇª)
Γöé   Γöé   Γö£ΓöÇΓöÇ SubmitBottomSheet.kt
Γöé   Γöé   Γö£ΓöÇΓöÇ LoadingMessages.kt
Γöé   Γöé   Γö£ΓöÇΓöÇ BadgeDetailDialog.kt     # Badge details popup
Γöé   Γöé   Γö£ΓöÇΓöÇ LevelProgressBar.kt      # XP and level display
Γöé   Γöé   Γö£ΓöÇΓöÇ ShareUrlBottomSheet.kt   # URL sharing UI
Γöé   Γöé   ΓööΓöÇΓöÇ UserSearchSheet.kt       # User search for sharing
Γöé   Γö£ΓöÇΓöÇ screen/
Γöé   Γöé   Γö£ΓöÇΓöÇ MainScreen.kt            # Nav host + DiscoverTab
Γöé   Γöé   Γö£ΓöÇΓöÇ SettingsScreen.kt
Γöé   Γöé   Γö£ΓöÇΓöÇ ProfileScreen.kt
Γöé   Γöé   Γö£ΓöÇΓöÇ SavedScreen.kt
Γöé   Γöé   Γö£ΓöÇΓöÇ HistoryScreen.kt
Γöé   Γöé   Γö£ΓöÇΓöÇ OnboardingScreen.kt
Γöé   Γöé   Γö£ΓöÇΓöÇ CategoryOnboardingScreen.kt
Γöé   Γöé   Γö£ΓöÇΓöÇ SplashScreen.kt
Γöé   Γöé   Γö£ΓöÇΓöÇ ActivityFeedScreen.kt
Γöé   Γöé   Γö£ΓöÇΓöÇ AdminScreen.kt           # Admin/moderator moderation panel
Γöé   Γöé   Γö£ΓöÇΓöÇ BadgesScreen.kt
Γöé   Γöé   Γö£ΓöÇΓöÇ LeaderboardScreen.kt
Γöé   Γöé   Γö£ΓöÇΓöÇ NotificationsScreen.kt
Γöé   Γöé   Γö£ΓöÇΓöÇ PublicProfileScreen.kt
Γöé   Γöé   ΓööΓöÇΓöÇ YouScreen.kt             # Account hub + admin/mod entry
Γöé   ΓööΓöÇΓöÇ theme/
Γöé       Γö£ΓöÇΓöÇ Theme.kt                 # RoamTheme + system bar lock
Γöé       Γö£ΓöÇΓöÇ Color.kt
Γöé       ΓööΓöÇΓöÇ Type.kt

Γö£ΓöÇΓöÇ viewmodel/
Γöé   Γö£ΓöÇΓöÇ MainViewModel.kt             # All discovery + settings state
Γöé   ΓööΓöÇΓöÇ AuthViewModel.kt             # Auth state (Loading/Unauthenticated/AuthenticatedΓÇª)
Γö£ΓöÇΓöÇ util/
Γöé   Γö£ΓöÇΓöÇ ConnectivityFlow.kt          # Flow<Boolean> ΓÇö online/offline
Γöé   Γö£ΓöÇΓöÇ Env.kt
Γöé   Γö£ΓöÇΓöÇ Logger.kt
Γöé   ΓööΓöÇΓöÇ SwipeDirection.kt
ΓööΓöÇΓöÇ worker/
    ΓööΓöÇΓöÇ TokenRefreshWorker.kt        # Periodic Supabase session refresh
```

## Setup

### Prerequisites

- Android Studio Ladybug or newer
- JDK 17
- Android SDK 26+ (minSdk = 26, targetSdk = 35, compileSdk = 35)

### local.properties

Copy `local.properties.example` ΓåÆ `local.properties` and fill in:

```
sdk.dir=/path/to/Android/sdk
SUPABASE_URL=https://<YOUR_PROJECT>.supabase.co
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

### Button-Based Navigation (Material Design 3)
- **Thumbs Up** to like a page
- **Thumbs Down** to skip
- **Roam** to load a new random URL
- **You** hub for profile, social, settings, and (when privileged) Admin/Moderator panel
- Full Material Design 3 polish with native Android look & feel


### Gamification & Social
- **Badges** ΓÇö 70+ unlockable badges across 12 categories with progress tracking
- **Level progression** ΓÇö Levels 1ΓÇô50, XP earned from rating, submitting, and discovering
- **Leaderboard** ΓÇö Weekly, monthly, and all-time XP rankings
- **Activity feed** ΓÇö See what people you follow are discovering and rating
- **URL sharing** ΓÇö Send URLs directly to other users with push notifications
- **Public profiles** ΓÇö View other users' profiles, badges, and collections

### Notifications
- **Push notifications** ΓÇö FCM-based delivery for badge unlocks, level-ups, shared URLs, and feature updates
- **In-app notification center** ΓÇö View and manage all notifications within the app
- **Deep linking** ΓÇö Tap a notification to navigate directly to the relevant screen

### Navigation
- Intuitive back navigation: Settings Γåö Main, Profile Γåö Settings, Saved Γåö Settings
- System back button support with context-aware routing

### Smart Domain Blocking
- Automatically blocks all subdomains after repeated downvotes (e.g., blocking `itch.io` blocks all `username.itch.io` variants, preventing spam from the same site)
- 30-day suppression prevents repetitive content from dominating sessions

### Focus Mode
- Narrow discovery to specific topics or categories you select
- Switch between focused and wide exploration on the fly

### Authentication

The app supports **Google OAuth** and **email/password** from the onboarding screen. Google opens via Chrome Custom Tabs; email uses the inline form in `OnboardingScreen.kt`.

### Prefetch Queue

`MainViewModel` maintains two queues so the app is always ahead of the user:

| Queue | Size | What it holds |
|---|---|---|
| **Hot** | 12 | HEAD-validated URLs ΓÇö served instantly on tap |
| **Warm** | 15 | Fetched from the API but not yet validated ΓÇö promoted to hot as slots open |

On each Roam tap, a URL pops off the hot queue instantly. The hot queue immediately refills by pulling from warm and HEAD-checking each entry (5 s timeout). Warm refills in parallel with fresh API calls. This keeps 8 URLs buffered at all times and means hot-queue replenishment is ~5 s (just a HEAD check) rather than ~API + HEAD.

If both queues are empty (first launch, filter change, offline recovery), the app falls back to a live fetch with up to 3 retries.

### Discovery Flow

1. User taps **Roam** ΓåÆ `MainViewModel.roam()` pops from prefetch queue or fetches live
2. URL loaded in `RoamWebView` (full-screen, lifecycle-aware, state-saved across backgrounding)
3. Status bar shows `Category ┬╖ domain` once page loads
4. **Like** (thumbs up) ΓåÆ rates +1, stays on the page (you may still be reading)
5. **Skip** (thumbs down) ΓåÆ rates -1, navigates to the next URL
6. Long-press config sheet ΓåÆ save for later, share, add to collection, report broken link, roam within category

### Offline Ratings

Ratings that fail due to no connectivity are pushed onto `pendingRatings`. `connectivityFlow` observes network state; when the device comes back online, all queued ratings are flushed to Supabase.

### WebView Dark Mode

`RoamWebView` creates the WebView with a `UI_MODE_NIGHT_YES` configuration context, then calls `WebSettingsCompat.setAlgorithmicDarkeningAllowed(true)` (API 33+) or `WebSettingsCompat.setForceDark(FORCE_DARK_ON)` (API 29ΓÇô32). This forces dark rendering regardless of the system theme setting. Controlled by **Settings ΓåÆ Dark mode for web pages** (on by default, persisted to SharedPreferences).

### WebView State & Scroll Persistence

- **URL source of truth** ΓÇö `savedState` is a non-persisted `remember { Bundle() }` for live-session recovery only (renderer death while the app is alive). The ViewModel owns the current URL so process death does not restore a stale page.
- **Scroll memory** ΓÇö Injected script stores per-URL `{ y, height }` in **localStorage**. On load it polls until document height is ready, then `scrollTo`.
- **Save-before-pause** ΓÇö `ON_PAUSE` runs `__roam_saveScroll` and waits for the JS callback (or 250ms) **before** `pauseTimers()`, so the write is not dropped. Kotlin keeps a scroll-Y backup for restore.
- **Restore on resume** ΓÇö Surviving renderer: `__roam_restoreScroll(fallbackY)` + delayed `scrollTo` if still near top. Renderer death: `restoreState`/`loadUrl`, then restore after `onPageFinished` with the Kotlin Y fallback.
- **System bars** ΓÇö Theme and WebView re-assert status/navigation bars after resume and page finish so sites cannot hide them.


### Admin / Moderator Access

`MainViewModel` observes Supabase `sessionStatus`. On `Authenticated`, `checkUserRole()` reads `app_metadata.role` from the session user (`jsonPrimitive`). `role=admin` enables the Admin panel; `role=moderator` (or admin) enables the Moderator panel. Opening the **You** tab re-syncs role. Entry: You ΓåÆ Admin/Moderator Panel ΓåÆ `AdminScreen`. Regular users cannot unlock admin mode via Settings taps.



## Settings

| Setting | Default | Storage |
|---|---|---|
| Skip paywalled sites | Off | Supabase `user_settings` |
| Dark mode for web pages | On | SharedPreferences |
| Preferred languages | `["en"]` | Supabase `user_settings` |
| Interest categories | (onboarding) | Supabase `user_categories` |
| Sound effects | On | SharedPreferences |
| Haptic feedback | On | SharedPreferences |
| Celebration animations | On | SharedPreferences |

## Permissions

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.VIBRATE" />
```

- **INTERNET** ΓÇö Supabase + WebView page loads
- **ACCESS_NETWORK_STATE** ΓÇö Offline detection for rating queue
- **VIBRATE** ΓÇö Haptic feedback on Like/Skip

## Error Handling

- **Network errors** ΓåÆ offline message in status bar; ratings queued for retry
- **Roam failures** ΓåÆ up to 3 retries with 500 ms backoff; `RoamState.Error` shown with retry button
- **Timeouts** ΓåÆ Ktor `requestTimeoutMillis = 15_000`, OkHttp `callTimeout = 15 s`
- **Unhandled exceptions** ΓåÆ Sentry captures with device info, app version, user ID

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for the full version history.

## Troubleshooting

**Build fails / Gradle sync error**
```bash
./gradlew clean
./gradlew --refresh-dependencies installDebug
```

**App crashes on startup**
- Check `local.properties` has both required keys (`SUPABASE_URL`, `SUPABASE_ANON_KEY`). `SENTRY_DSN` is optional ΓÇö without it, Sentry is a no-op.
- Check Logcat for `FATAL EXCEPTION`

**"Discovery failed" on roam**
- Verify the `roam` Supabase Edge Function is deployed:
  ```
  supabase functions deploy roam --project-ref <YOUR_PROJECT_REF> --workdir /path/to/roam
  ```
- Check Sentry for `WORKER_ERROR` events

**WebView appears blank after returning from background**
- Ensure `RoamWebView` lifecycle observer is active (not removed)
- Live-session `savedState` is a non-persisted `remember { Bundle() }`; URL comes from the ViewModel
- Scroll is restored from localStorage via `__roam_restoreScroll` on resume

**Admin/mod panel missing for privileged user**
- Confirm JWT `app_metadata.role` is `admin` or `moderator`
- Role unlock follows `sessionStatus`; open the You tab to force a re-check
- Logcat: filter `MainViewModel` for `checkUserRole ΓåÆ role=`

**Scroll jumps to top after returning from background**
- Scroll is saved before `pauseTimers` and restored with a Kotlin Y backup
- Confirm JS is enabled (Settings) so localStorage scroll memory can run


