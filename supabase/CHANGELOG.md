# Changelog

All notable changes to the Roam Supabase backend (PostgreSQL schema, Row-Level Security, and Deno Edge Functions).

## [2026-10-24] — Home stats
### Added
- Home-stats materialized view powering the public community counters on the homepage.

## [2026-10-17] — Challenge auto-population
### Changed
- Challenges now auto-populate from curated sets.

## [2026-10-16] — URL-tags write path
### Changed
- Replaced the `url_tags` surrogate key and dropped a hot-path index to cut write amplification.

## [2026-10-10] — Moderation audit fix
### Fixed
- Moderation audit trigger now records the acting moderator correctly.

## [2026-10-09] — Challenge reward fixes
### Fixed
- Challenge reward edge cases and consolidation handling.

## [2026-10-08] — Tag graph
### Added
- Tag-graph schema with seeded tags, subcategory→tag mappings, and tag relations.
- Backfilled URL tags from subcategories, superseding the legacy tagging system.

## [2026-09-27] — URL deduplication
### Added
- URL deduplication to collapse near-duplicate submissions.

## [2026-09-19] — Legacy tags removed
### Changed
- Dropped the legacy `url_tags` table (replaced by the tag graph).

## [2026-09-18] — User-actions RLS tightening
### Changed
- Tightened Row-Level Security on `user_actions`.

## [2026-08-06] — User actions
### Added
- `user_actions` event table for engagement tracking.

## [2026-08-05] — Challenge system
### Added
- Challenge system: daily challenges with XP rewards and real-time progress tracking.

## [2026-08-04] — Discovery v31–v35
### Changed
- Discovery v31 (inline scoring), v32 (recent-subcategory fix), and v35 (hoisted domain checks) for faster, more reliable discovery.

## [2026-07-31] — Share events
### Added
- Share-event tracking and restored missing tables.

## [2026-07-29] — Discovery v29–v30
### Changed
- Discovery v29 (variety exploration) and v30 (subcategory-rotation scoring).

## [2026-07-28] — Streaks
### Changed
- Effective-streak calculation and streak cleanup.

## [2026-07-18] — Badge expansion & analytics
### Added
- Badge audit and expansion (~150 badges), plus holiday and part-2 badges.
- Report materialized views and stabilized admin analytics.

## [2026-07-16] — Shared-URL notifications
### Added
- URL-shared notifications.

## [2026-07-10] — Leaderboard, user activity & subcategories
### Added
- Leaderboard RPC and user-activity tracking.
- Digital-archives and cars & automotive subcategories.
### Changed
- XP idempotency; Row-Level Security on daily stats.

## [2026-07-02] — Social graph
### Added
- Shared URLs, activity feed, user search, follow notifications, and moderator role.

## [2026-07-01] — Discovery v26
### Changed
- Discovery v26 (restored v24 algorithm with fixes).

## [2026-06-16] — Discovery v25 & level-ups
### Added
- Level-up notifications.
### Changed
- Discovery v25.

## [2026-06-13] — Gamification
### Added
- Badges, levels, XP, and streaks.

## [2026-06-10] — Notifications
### Added
- Notifications and push tokens.

## [2026-06-06] — Beta signups
### Added
- Beta-signup storage.

## [2026-06-02] — Discovery v23–v24
### Changed
- Discovery v23 (domain-cooldown enhancements) and v24 (subdomain pattern matching).

## [2026-05-30] — Profiles, analytics & collections
### Added
- Auto-created profiles on signup, admin analytics RPCs, and materialized views.
- Collection limits and item counts.

## [2026-05-27] — Discovery v21
### Fixed
- Category-filter fix.

## [2026-05-13] — URL reports & discovery v20
### Added
- URL-reports Row-Level Security.
### Changed
- Discovery v20 (reduced tablesample).

## [2026-05-12] — Discovery v18–v19
### Fixed
- PL/pgSQL ambiguity (v18) and variable conflict (v19).

## [2026-05-06] — Discovery v13–v17
### Changed
- Discovery v13 (conditional fallback), v14 (preload exclusions), v15 (tablesample 25), v16 (precomputed score), and v17 (score-static column).

## [2026-05-03] — Discovery v11–v12 & filters
### Changed
- Discovery v11 (freshness/diversity/exploration) and v12 (merged category filter).
- Category/subcategory filters, passive URL retirement, and deterministic subcategory IDs.

## [2026-05-02] — Discovery mode & calibration
### Added
- Discovery mode, interest calibration, Wilson-score floor, and URL-inactive flag.

## [2026-05-01] — Performance, moderation & personalization
### Added
- Moderation audit log, personalization, feedback, saved URLs, and collection item-count RPC.
### Changed
- Fast candidate pool, tablesample variety, and subcategory filter.

## [2026-04-30] — Filters & indexes
### Added
- Language filtering (from TLD), paywalled domains, and additional indexes.

## [2026-04-26] — Core discovery fixes
### Fixed
- Null-subcategory and domain-extraction fixes; domain exclusion.

## [2026-04-23] — Initial schema
### Added
- Initial database schema and core discovery RPC.
