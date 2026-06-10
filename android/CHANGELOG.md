# Changelog

All notable changes to the Roam Android app.

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