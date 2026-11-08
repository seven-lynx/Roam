# Changelog

All notable changes to the Roam browser extension.

## [Unreleased]

### Fixed
- Saved pages no longer expire after 30 days, and pages saved while signed out are listed locally instead of disappearing; they are pushed to the account the next time the saved list loads.
- Notification taps now mark the item read **and** open its target (shared URL, badge, level-up, challenge, follower profile), matching web and Android.
- Badge and challenge chips count unlocked badges and active challenges instead of every row in the table.
- Settings controls (public profile, skip paywalled, deep-dive mode, always-translate, discovery languages) hydrate from the account on open instead of always rendering unchecked/English.
- Duplicate click listeners no longer stack on the saved-pages list each time it opens, which fired repeated removals.
- "Translate this page" is a clean one-shot action again; "Always translate roamed pages" is a separate persisted setting.
- New Google sign-ups see a "Claim your username" row instead of copying a broken `/u/undefined` profile link.
- Stale engagement samples (popup closed before the next roam) are dropped rather than reported as long dwells.
- Removed dead message types and handlers (`GET_USER_CATEGORIES`, `SET_USER_CATEGORIES`, `GET_SUBCATEGORIES`, `SET_DISCOVERY_LANGUAGE`) and the stale `lib/debug.ts`, which described the retired URL-queue architecture. Every remaining request type is reachable from a UI surface.

### Added
- ROAM-OS theme for the popup — phosphor-teal and gold on abyss, Space Grotesk and IBM Plex Mono bundled, a status bar that names the current screen, and an opt-in CRT overlay. Effects paint inside the popup only: never on the OAuth tab and never on the page being browsed.
- Display section in the config panel: a ROAM-OS/Classic switch plus CRT effects, static and flicker toggles, persisted as `app_theme_variant`, `crt_effects`, `crt_static` and `crt_flicker` — the same keys Android reads. Static and flicker default off.
- `src/theme.css` as the single palette and typography source, shared by the popup and the OAuth callback page, with unit coverage for the appearance switches.
- Collections screen in the popup — rename, delete (two-tap confirm), make public/private, copy public link — backed by the existing `collection` Edge Function actions.
- Deep-dive discovery toggle and multi-language filtering, both persisted to `user_settings.preferred_languages` / `discovery_mode`.
- Level, XP, day streak and roamed/submitted counters in the "You" section.
- Desktop notifications (opt-in, `desktop_notifications` toggle) for follows, shares, badge unlocks, level-ups and challenge completions. Unread notifications are polled on a 5-minute `chrome.alarms` schedule and a tap opens the same target the web bell uses. Unlocks that land while the popup is closed also show as a toast on the next open.
- Community screen: the activity feed for the people you follow, plus follower/following lists with unfollow. Follow and unfollow call the `follow` function, so social XP and badge evaluation still run server side.
- You screen: one-time username claim, editable display name and bio, and password change for email accounts (re-authenticates first, as the web settings page does).
- Unit coverage for notification payloads, watermark selection, activity wording and input validation (98 tests total).

### Changed
- Popup colours are semantic tokens now (`--danger`, `--ok`, `--info`, `--accent-ink`) instead of hardcoded hex, so both themes colour error and success states correctly; accent-backed buttons pick an ink colour that stays legible on gold. `--text-secondary` is finally defined — it was referenced once and resolved to nothing.
- Service worker split: the collections, notifications and preferences handlers moved to `background/handlers/`, and URL normalisation to `lib/url.ts`. `background.ts` went from 1,350 to ~1,100 lines; discovery and auth remain to be split (rule E.3).
- Two new manifest permissions, `alarms` and `notifications`, both documented in the `extension/RULES.md` permissions table.

### Still on the web app
- Data export and account deletion stay on the web settings page, linked from the You screen: export needs an authenticated file download and deletion is irreversible.

## [0.5.0] - 2026-08-05

### Changed
- Discovery algorithm v31–v35 — inline scoring eliminates N+1 per-row sub-queries, parallel batch RPC calls with `Promise.allSettled`, TABLESAMPLE increased from 5% to 15%, seen_ids cap reduced from 10K to 3K, Phase 2 LIMIT increased from 100 to 500, pool-empty guard with BERNOULLI(30) retry. Significantly faster response and fewer false exhaustion states.
- Prefetch focus mode fix — corrected regression where focus-mode prefetch would bypass category filters.

### Fixed
- Badge text readability improved across all platforms.
- Deno type errors resolved in evaluate-badges and challenge Edge Functions.
- `save-url` fire-and-forget chains replaced with async IIFE to prevent unhandled promise rejections.
- Hardcoded secrets removed from scripts directory.

### Backend
- Challenge system — daily challenges with XP rewards and real-time progress tracking.
- `roam-health-check` Edge Function with GitHub Actions health-check workflow.
- Docker Hub login added to CI to fix rate limiting.

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
