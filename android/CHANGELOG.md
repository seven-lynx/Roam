# Changelog

All notable changes to the Roam Android app.

## [1.1.7] - 2026-07-10

### Fixed
- Admin/mod menu not appearing — Admin and moderator panels now auto-unlock from the JWT role on session load. Moderators no longer need the 5-tap Settings easter egg. `checkUserRole()` retries with backoff (up to 5s) so the panel unlocks even when Supabase auth initializes after the ViewModel.
- Scroll position lost when app is backgrounded — WebView scroll is saved to localStorage (survives renderer death) and force-saved/restored on `ON_PAUSE`/`ON_RESUME`. Height-aware polling waits for lazy content before restoring. Snapshot overlay covers white flash during renderer recovery. Removed race between `ON_RESUME` restore and `onPageFinished` re-injection.
- Status bar flash during page load — Theme and WebView re-assert system bars after resume and page finish so sites cannot hide the status bar via theme-color / fullscreen hints.
- Web admin gate — `/admin` now allows both `admin` and `moderator` JWT roles (matches Android mod panel access).

### Changed
- Config sheet peek height increased from 15dp to 28dp for a more reachable handle.
- Version bumped to 1.1.7 (versionCode 28).

## [1.1.6] - 2026-07-08

### Fixed
- CI pipeline — Resolved all lint errors and warnings across the project.
- Edge function type safety — Fixed Deno type errors in admin-moderation and submit-url edge functions.

## [1.1.4] - 2026-07-07

 ### Fixed
 - Badge count inconsistency — Profile pages (both web and Android) now show a single, consistent badge count derived from actual unlocked badges. Fixed `profile.badge_count` denormalized counter drifting from `user_badges` due to missing `unlocked_at` timestamps on badge inserts. All four profile views (own profile, public profile on both platforms) now share the same source of truth.
 - Streak days always showing 0 — `update_streak()` was only called from the Roam edge function with silent error suppression. Added `record_daily_activity()` helper and now maintain streaks from all user actions: roaming, saving URLs, submitting URLs, and following users. Profile edge function now returns gamification data including `streak_days`, `max_streak`, `xp_total`, `level`, and badges.
 
 ### Backend
 - Added `sync_profile_badge_count()` function — reconciles `profiles.badge_count` with actual locked badges and runs after every `evaluate_badges()` call
 - Added `record_daily_activity()` helper — ensures `user_daily_activity` row exists for today, then calls `update_streak()`; called from roam, save-url, submit-url, and follow edge functions
 - Fixed `evaluate_badges()` — now explicitly sets `unlocked_at = now()` on all badge unlocks to prevent future drift
 - Hardened `update_streak()` with better NULL handling
 - New migration repairs existing `user_badges` rows with `NULL unlocked_at` and syncs all `profile.badge_count` values
 - Profile edge function now returns gamification data (`xp_total`, `level`, `streak_days`, `max_streak`, `badge_count`), badges array, and `collections_count`
 
 ## [1.1.3] - 2026-07-07

### Fixed
- Background/foreground URL drift — WebView no longer restores stale URLs from before process death. Changed savedState Bundle from `rememberSaveable` to `remember` so the ViewModel remains the single source of truth for current navigation, eliminating the "current URL changes after switching apps" bug.
- Duplicate history entries — Fixed URL history recording from both `roam()` and `onWebViewUrlChanged()` firing for the same navigation. Combined with the URL drift fix, this eliminates 2-3 duplicate entries per page visit.
- Inflated XP — Same root cause as duplicate history (spurious page reloads on resume). Fixed by the URL drift resolution above.
- Admin/mod menu buttons — Moderator links previously pointed to `/moderator?view=...` (a non-existent route, returning 404). All links now use the correct `/admin?view=...` paths. Merged admin and moderator sections into a single combined panel with role-correct heading. Added Badges, Email, and Beta Signups links for admins. Admin-only URL loader field.
- Webapp sign-in in WebView — Fixed race condition where the session cookie wasn't propagated before the WebView started loading roamtheweb.app pages, causing blank/unauthenticated views. WebAuthUtil now retries session retrieval (3 attempts, 200ms delay), sets explicit Max-Age cookie expiry based on JWT lifetime, and added `injectSessionAndWait()` with a 300ms post-flush delay for atomic navigation + auth.
- Public profiles failing to load — Fixed two bugs: (1) `getPublicProfile()` in the repository was passing a malformed full URL to `functions.invoke()` instead of the function name + body pattern used by every other method, causing all requests to fail silently. (2) The profile edge function only read `username` from GET query params, but the Android SDK sends POST with a JSON body — now accepts both.
- Public profile blank screen — Added explicit fallback state for when the profile is null but not in a loading/error state, showing a "Couldn't load this profile" message with a Retry button. Added Sentry exception capture to the profile load failure path for observability.
- URLs opening in external browser — Restored three critical WebView containment guards that were missing: `onCreateWindow` override to capture `window.open()` and `target="_blank"` links inside the same WebView; scheme blocking in `shouldOverrideUrlLoading` to block `intent://`, `market://`, `tel:`, and other non-http schemes; and the deprecated `shouldOverrideUrlLoading(String)` overload for OEM WebViews (Samsung, Huawei) and server-side redirects.
- Admin mode security — Regular users can no longer unlock admin mode by tapping version 5× in Settings. Admin mode is now exclusively auto-enabled by `checkUserRole()` when the JWT contains `role=admin`. Moderator mode still unlocks via tap for JWT-verified moderators.

### Changed
- Config bottom sheet — Admin and moderator panels merged into a single section with a dynamic heading ("🔒 Admin" vs "🛡️ Moderator"). All actionable links now use verified `/admin?view=...` routes.
- Cookie injection — WebAuthUtil retries up to 3 times with 200ms delays if Supabase session isn't available on first call, handles token propagation race at app startup.
- Public profile screen — Added Retry button to both error and null-profile states for self-recovery without navigating away.

### Web
- Admin dashboard — Added `ModeratorRedirect` component that redirects `/moderator` → `/admin`, so old deep links from previous app versions don't 404.

### Backend
- Profile edge function — Now accepts both GET (query params) and POST (JSON body) so both the web app and Android app can use the same endpoint.

## [1.1.2] - 2026-07-06

### Added
- Social features — Follow/unfollow users, view public profiles, search users, and share URLs with friends directly from the app.
- "You" tab — A new hub replacing the Settings bottom bar icon. View your level, XP, streak, follower/following counts, and badges at a glance, with quick access to all account and social screens.
- Profile screen — View any user's public profile including bio, badges, collections, and follower/following counts. Follow or unfollow with a single tap.
- Activity feed — See what people you follow are discovering and rating in real time, powered by a new server-side activity tracking system.
- Share with a friend — Send the current page to a follower via the config sheet. Recipients get a push notification.
- User search — Search for users by username to find and follow new curators.
- Copy profile link — Copy your public profile URL to share outside the app.
- Open in Roam Web — Opens roamtheweb.app inside the app with automatic sign-in via session cookie injection.
- Follower/following lists — Tap follower or following counts on the You tab to expand an inline list and navigate to user profiles.

### Changed
- Bottom bar — "Settings" replaced with "You" as the primary hub for account, social, and app configuration.
- Config bottom sheet — Added "Share with a friend" action. "Category preferences" now opens the native profile screen instead of the web app.
- Leaderboard — Tapping a user row now navigates to their public profile.
- Settings screen — Streamlined to browser and discovery configuration only. Profile, saved URLs, history, and notifications moved to the You hub.

### Fixed
- Leaderboard — Fixed crash caused by incorrect JSON response parsing (the Edge Function returns a wrapper object, not a bare array).
- Leaderboard — Top-3 highlighting now uses theme-aware colors readable in both light and dark mode.
- Badges — Badge counts now correctly use the `get_user_badges` RPC instead of querying the bare badges definitions table.
- Leaderboard privacy — Private profiles no longer appear in leaderboard rankings. The Edge Function now filters by `is_public = true`.
- User search privacy — Only public profiles appear in user search results.
- XP farming — Tab switching no longer triggers duplicate roam calls and XP awards. Added client-side debounce (1s) on the Roam button.
- XP consistency — Level now automatically stays in sync with XP via a database trigger. XP no longer appears to "jump up and down" — it only ever increases.

### Backend
- User activity system — New `user_activity` table with automatic triggers on ratings, URL submissions, and collection creation. Powers the cross-platform activity feed via the `get_activity_feed` RPC.
- Leaderboard privacy filter — Edge Function now excludes private profiles from all leaderboard periods.

## [1.0.16] - 2026-07-01

### Fixed
- Discovery returning duplicate URLs — The roam() RPC had been replaced with a primitive stub that didn't record seen URLs or apply domain cooldowns, causing the same top-scored URLs to repeat indefinitely. Restored the full v24 discovery algorithm with TABLESAMPLE variety, weighted-random ordering, interest scoring, and proper seen-URL tracking.
- WebView blocked cleartext HTTP — The network security config blocked all cleartext traffic, preventing pages served over http and https→http redirects (common on legacy web) from loading. Now allows cleartext for displayed content while Roam's own API traffic remains encrypted over https.

## [1.0.15] - 2026-06-12

### Added
- New application icon — Updated the launcher icon with the new Roam logo branding across all densities.
- Leaderboard refinements — Added a period selector (Weekly, Monthly, All Time) to the leaderboard and improved visual feedback with rank emojis and XP tracking.
- Bottom bar interaction feedback — Added temporary haptic-style visual feedback when liking or skipping pages to make interactions feel more responsive.

## [1.0.14] - 2026-06-11

### Added
- Achievements & gamification system — Earn badges and XP as you discover and rate URLs. Track your progress with an in-app level bar, badge gallery, and leaderboard. Badge unlocks trigger celebratory toasts, and level-up notifications arrive via push.
- Badges, leaderboard, and profile screens — Dedicated screens for browsing earned badges, viewing the community leaderboard, and inspecting your own (or others') profile with badges and level progress.

### Fixed
- White screen flash on unlock and cold start — The app no longer flashes a white screen when resuming from background or launching cold. A matching theme background is shown immediately, eliminating the jarring flash before the WebView renders.

## [1.0.13] - 2026-06-10

### Added
- Push notifications via Firebase Cloud Messaging (FCM) — Receive push notifications for important updates and events directly on your device.
- In-app notifications for URL submissions — Get notified within the app when your submitted URLs are approved or rejected, with a dedicated notifications screen to review all past notifications.
- Web + backend push notification infrastructure — Added service worker push handling on web and a Supabase Edge Function for sending push notifications across platforms.

## [1.0.12] - 2026-06-09

### Added
- One-shot translate button — Replaced the broken auto-translate toggle in the config sheet with a one-shot "Translate this page" button. The button triggers Google Translate directly via the WebView, avoiding the reliability issues the toggle had with dynamically-loaded content.
- Proactive cache warming — The WebView now pre-connects and warms the cache for the next queued URL while displaying the current page, reducing perceived load time when moving to the next page.
- Early spinner dismissal — The loading spinner now dismisses earlier (on page commit rather than waiting for full render), providing a more responsive feel.
- Faster queue refill — Queue cold-fill logic is now triggered earlier and more aggressively, reducing wait time between pages.

### Fixed
- Back/forward navigation broken — Fixed a bug where the ConfigBottomSheet's stale callback guard (which checked `previousRawUrl`) would match back/forward navigation URLs, causing the WebView to reload the current page instead of navigating. The guard now uses `RoamState.Loading` state checks, which correctly blocks stale callbacks during active roams while allowing normal browsing navigation.
- Scroll position lost on app background/foreground — Android lifecycle callbacks (ON_PAUSE/ON_RESUME) now force-save and force-restore scroll position via `evaluateJavascript`, bypassing the 200ms JS debounce. Added `pagehide`/`pageshow` listeners in the injected JS for synchronous scroll save on backgrounding and bfcache restore on OEM WebViews. This prevents losing reading position when switching apps or locking the screen.
- Auto-translate reliability — Removed the broken auto-translate toggle whose state tracking relied on unreliable load-time heuristics. The new one-shot button approach is stateless and works consistently across all pages.

## [1.0.11] - 2026-06-08

### Added
- JavaScript-based scroll memory — Scroll position is saved and restored via an injected self-contained script using sessionStorage, replacing the old evaluateJavascript lifecycle hooks. This eliminates async race conditions that could cause scroll to reset or jump on page load, and works independently of Android lifecycle events.
- Polling scroll restoration — The scroll script polls requestAnimationFrame until the page reaches its saved document height before restoring position, preventing premature scroll-to on pages with lazy-loaded content, images, or dynamic layouts.
- Intent scheme blocking — The WebView now blocks non-http/https URL schemes (intent://, market://, tel:, and others) that could be abused to launch external apps or trigger unintended actions from within the Roam browsing session.
- Prefetch WebView hardening — The background cache-warming WebView now blocks all navigation and window.open() calls, preventing prefetch requests from ever opening the system browser or firing intents.

### Fixed
- Removed unused mutableIntStateOf import and dead scroll-state variables (savedScrollY, savedScrollUrl) that were obsoleted by the new scroll-memory script
- Removed onPageStarted scroll-reset logic that conflicted with the new scroll restoration approach
- Removed ON_PAUSE evaluateJavascript scroll capture that had async timing issues on some devices

## [1.0.10] - 2026-06-07

### Added
- WebView renderer death recovery — When the Android system kills the WebView renderer process, the app now restores the page with a snapshot overlay and preserves scroll position, preventing white screens and lost reading progress.
- WebView creation failure handling — If WebView creation fails (e.g. on devices with limited resources), the error is now caught gracefully instead of crashing the app.
- Sentry noise reduction — DNS resolution failures and internal Sentry HTTP client exceptions are now filtered out of error reporting, keeping the issue feed actionable.
- Profile error visibility — Profile save failures now surface an error message to the user instead of silently failing.

### Fixed
- Infinite WebView load loop — Fixed a bug where the WebView would re-issue loadUrl() on every recomposition while a page was still loading, causing an infinite reload cycle that made browsing unusable.
- Bottom sheet animation crash — Added guard for IllegalStateException when bottom sheet animations conflict with rapid user input, preventing crashes during quick Roam/Done interactions.
- Profile empty-string guards — Stat cells and avatar URLs no longer crash on empty or null string values.
- Profile save errors — Failed profile updates now display an inline error instead of appearing to succeed with no changes persisted.

## [1.0.8] - 2026-06-06

### Changed
- Settings screen performance — Language lists are now memoized at file-level constants, eliminating unnecessary list recreation on every recomposition and delivering smooth scrolling throughout the Settings screen.
- In-app history navigation — History URLs now reliably open within the app WebView instead of launching the system browser, keeping all browsing within the Roam experience.
- Sentry initialization hardening — Sentry init is now wrapped in a try/catch to prevent crashes on devices or emulators where WebView is unavailable during startup.
- Session state checks — Improved authentication state detection using session status rather than currentUserOrNull, reducing edge cases where prefetch would start before the session token was fully propagated.

### Fixed
- Settings screen jank — Dropdown menus and language selectors no longer cause UI freezes or stutter during rapid scrolling.
- History URL handling — Added shouldOverrideUrlLoading to RoamWebView, preventing URL delegation to the system browser for history-tapped links.
- Prefetch timing — Added a 100ms delay after session authentication before starting prefetch, giving Supabase plugins time to propagate the token.
- Prefetch batch size — Reduced warm-fill batch size from 4 to 2 to avoid overwhelming the edge function with concurrent requests.

## [1.0.7] - 2026-06-06

### Added
- Language filter for discovery — Users can now filter by preferred language when discovering URLs, enabling more relevant recommendations based on language preference.
- Auto-translate persistence — Language preferences are now properly saved and restored across app sessions.
- URL history — New dedicated history feature to view and revisit previously discovered and visited URLs with full persistence across sessions.
- Page navigation buttons — Improved navigation controls for browsing multi-page content and moving between discovery results.

### Fixed
- Settings screen jankiness — Fixed performance issues in the Settings screen by memoizing language lists, eliminating unnecessary re-renders and UI freezes when navigating settings.
- Scroll state preservation — Fixed scroll position being reset unexpectedly during navigation.
- Navigation flow — Improved consistency of URL handling across history, bookmarks, and discovery surfaces.

## [1.0.3] - 2026-06-02

### Added
- Menu tap-to-close crash prevention — Fixed crash when rapidly tapping the menu to open and close; now debounced with proper state handling.
- Queue domain deduplication — Queue now intelligently skips candidate URLs if a same-domain entry already exists in the queue, preventing rapid-fire serves from the same website.
- Root-domain pattern matching — Enhanced suppression system now matches parent domains across all subdomains (e.g., rating down artist1.bandcamp.com also suppresses artist2.bandcamp.com).
- Domain muting cooldown enhancements — 1-hour cooldown on domain muting now applies consistently in Discovery and Focus modes.
- Registrable domain extraction — When excluding a domain, app now extracts registrable domain (last 2 parts) instead of full hostname, blocking all subdomains at once.
- Smart loading overlays — Loading overlay no longer shows for user-initiated navigation within a page—only displays when loading the actual roam URL itself.
- Network timeout improvements — Removed overly aggressive premature timeouts (8-10s) that were causing startup failures on slow networks; now relies on Ktor's 60s per-request timeout.
- Prefetch validation — Restored parallel validation of up to 3 prefetch URLs simultaneously for faster queue population.
- Background page preloading (opt-in) — New "Preload next page" setting loads the next queued URL in a hidden background WebView while you're reading the current one.
- Queue size and throughput improvements — Hot queue expanded from 10 to 12 slots and warm-fill batch size increased.
- Loading overlay flash fix — Overlay now waits for the page to fully commit before dismissing, eliminating the flash of the previous page's content.

### Fixed
- Menu gesture handling — Added debouncing and error handling to prevent rapid tap crashes; now checks for both Expanded and PartiallyExpanded sheet states.
- Loading overlay polish — Fixed flash of old URLs when loading screen clears; tracks lastLoadedUrl to keep overlay up until WebView finishes rendering.
- Configuration sheet state — Properly collects showConfigSheet state from ViewModel; uses partialExpand() instead of hide() to avoid IllegalStateException.
- Offline queue robustness — Improved queue deduplication logic to prevent serving same-domain URLs in succession.
- Network timeout handling — Removed overly aggressive 8-10s timeouts on repository functions that were causing false timeout errors on cold networks.
- Prefetch validation efficiency — Restored parallel validation to 3 URLs simultaneously for faster queue population.
- Domain muting consistency — Fixed muting behavior to apply appropriate cooldown in Discovery/Focus modes while maintaining full muting in Collections.

### Removed
- Deprecated discoveryMode code — Cleaned up as part of Focus mode transition for cleaner codebase and reduced maintenance surface.

## [1.0.2] - 2026-06-02

### Added
- Material Design 3 UI overhaul — Modern, polished interface with updated typography, colors, and component spacing throughout the app.
- System back button integration — Proper Android back navigation stack with predictable behavior.
- Swipe gesture support — Smooth swipe-up for bottom sheet actions, swipe navigation between tabs, and refined gesture-based controls.
- True offline support — Rate URLs while offline; queued ratings automatically sync when connectivity returns, with duplicate prevention.
- Domain exclusion refinement — Block registrable domains (e.g., itch.io) instead of full hostnames, preventing workarounds via subdomains.

### Fixed
- WebView stability — Fixed white screen on app resume, improved recovery from transient renderer crashes, better handling of memory pressure scenarios.
- Navigation reliability — System back button now correctly maintains navigation stack; no more accidental app exits or unexpected navigation jumps.
- Offline queue robustness — Enhanced sync logic to prevent duplicate rating submissions, improved retry behavior on transient network errors, persistent queue storage.
- Bottom sheet UX — Refined dismiss interactions, better touch target sizing, prevented accidental action triggers from swipe gestures.
- Performance — Reduced jank when loading pages with embedded media, improved scrolling smoothness, optimized WebView memory usage.
- Error handling — Better messaging for transient failures; clearer distinction between network errors, server errors, and client-side issues.

## [1.0.1] - 2026-05-31

### Added
- Material Design 3 redesign
- Refined bottom sheet actions for easier page-level controls (save, share, collections)
- Improved navigation polish across tabs and in-page controls
- Discovery status improvements, including clearer category/domain context

### Fixed
- Fixed white screen on app resume by improving WebView recovery behavior
- Improved reliability when roaming/loading pages after transient network or renderer issues
- Better offline behavior for ratings (queue while offline, sync when connection returns)
- Improved error handling and recovery messaging for roam failures