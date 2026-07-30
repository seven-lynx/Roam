# Changelog

All notable changes to the Roam browser extension.

## [0.4.0] - 2026-07-29

### Changed
- Discovery algorithm v29+v30 — 5% TABLESAMPLE for variety, 24-hour domain cooldown, exploration bonus for under-explored subcategories, serendipity mode for occasional wildcards, and subcategory rotation for broader coverage over time.
- Cross-platform performance — Batch URL discovery, response caching, and unified tracking parameters reduce latency and server load across all platforms.
- Prefetch optimization — Parallelized reachability checks, added prefetch throttling, deferred `recordUrlVisit` to reduce background work, and fixed focus-mode prefetch regression.

### Fixed
- OAuth sign-in on Chrome — Dual-path `launchWebAuthFlow` with tab fallback for reliability. Added timeout handling for the auth flow.
- OAuth sign-in on Firefox — `postMessage` fallback, `web_accessible_resources` matches corrected, conflicting `service_worker` key removed from background config, and `chrome.commands` guarded for Firefox compatibility.
- Chrome Web Store compliance — Removed unused `identity` permission that was flagged during review.
- Sentry — Resolved the top errors across both Chrome and Firefox, reducing noise in the issue feed.

## [0.3.0] - 2026-06-06

### Added
- Compact popup UI — Inline notifications, browsing history, stats dashboard, and save confirmation toasts accessible directly from the popup.
- Prefetch validation — New API endpoints and validation logic for proactive cache warming.
- Feature parity with Android — Language preferences, interest scoring, and domain muting now match the Android experience.

### Changed
- Performance improvements — Optimized API calls and reduced redundant network requests.

## [0.2.0] - 2026-06-04

### Added
- One-shot translate button — Replaced the language multi-select with a translate-to picker. Users can now translate the current page to their preferred language with a single click.
- Language preference persistence — Translation language preferences are saved and restored across sessions.

### Fixed
- Translate language preference not being applied correctly in the popup.

## [0.1.1] - 2026-06-02

### Fixed
- Extension startup — Replaced `import.meta.env` references with esbuild `__defines__` to resolve blank popup on install.
- Empty matches in manifest — Fixed build error where manifest regex patterns returned empty arrays.

## [0.1.0] - 2026-05-31

### Added
- Initial release of the Roam browser extension for Chrome and Firefox.
- Tab-based OAuth authentication with Supabase.
- Popup interface with Roam button, rating controls, and language preferences.
- Keyboard shortcut support (`Ctrl+Shift+R` / `MacCtrl+Shift+R`).
- Background service worker for API communication and prefetch.