# Database Schema

High-level reference for the core tables. This is a summary — [`supabase/migrations/`](migrations/) is the authoritative schema history (numbered SQL migrations applied with `supabase db push`).

## Core discovery tables

| Table | Purpose |
|---|---|
| `urls` | All discovered pages — URL, title, description, votes, scores, source. Retired rows carry `inactive` + `inactive_since` and are filtered out of `roam()` |
| `ratings` | Per-user up/down votes |
| `url_ratings` | Aggregated rating state per URL |
| `seen_urls` | Which URLs a user has already been served. `dwell_ms`/`skipped` are deprecated and permanently NULL — the engagement metric was retired (`20261109120000`) |
| `serve_counter` | Successful-serve analytics (`serve_count`) |
| `categories` | The 8 category pillars |
| `subcategories` | The ~72 subcategories (topics) under the pillars |

## Personalisation tables

| Table | Purpose |
|---|---|
| `user_categories` | What a user wants served: one row per selected pillar (`subcategory_id` NULL) or per selected topic. Written only through `replace_user_interests()` (issue #121) |
| `user_settings` | Per-user preferences: `preferred_languages`, `skip_paywalled`, `discovery_mode`, `interest_mode` (`'pillars'`/`'topics'`, issue #121), notification prefs |
| `user_interest_scores` | Per-user, per-subcategory calibration weights |
| `user_category_scores` | Per-user, per-category calibration (for unsegmented URLs) |
| `interest_pair_scores` | Adjacent-category pair scoring for serendipity |
| `user_domain_cooldowns` | 24-hour per-session domain cooldown |
| `user_exhaustion_state` | Per-scope record of why discovery returned nothing: reason, next cooldown expiry, notify state (issue #120) |
| `user_suppressed_domains` | 30-day domain suppression (from repeated downvotes) |
| `user_subcategory_affinity` | Per-user subcategory affinity |
| `user_tag_weights` | Per-user tag weights |

## Social & content tables

| Table | Purpose |
|---|---|
| `collections` / `collection_items` | User-saved lists |
| `collection_favorites` | Favourited collections |
| `profiles` / `follows` | Social layer |
| `user_activity` | Activity feed — recent actions by followed users |
| `shared_urls` / `share_events` | Peer-to-peer URL sharing |
| `moderation_queue` | Submitted URLs pending review |
| `moderation_audit_log` | Immutable log of admin moderation decisions |
| `url_reports` | User reports of broken/dead links |
| `url_failure_reports` | One row per (URL, reporter) failure aggregate — drives threshold retirement via `report_url_failures()` |
| `push_tokens` / `notifications` | Push notification infrastructure; `discovery_exhausted` (issue #120) is the push-only "your feed ran dry" nudge |
| `beta_signups` / `feedback` | Waitlist signups and in-app feedback |

## Gamification tables

| Table | Purpose |
|---|---|
| `badges` / `user_badges` | Badge definitions and per-user unlocks |
| `xp_actions` / `xp_log` | XP definitions and per-user earnings |
| `user_actions` | Per-user action tracking |
| `challenges` / `challenge_instances` / `user_challenges` | Daily challenges and completions |
| `leaderboard_snapshots` | Cached leaderboard state |
| `daily_stats` / `user_daily_activity` | Daily rollup stats and streak tracking |

## Tagging tables

| Table | Purpose |
|---|---|
| `tags` / `url_tags` | Tags and their URL assignments |
| `tag_relations` | Relations between tags |
| `subcategory_tag_mapping` | Subcategory ↔ tag mapping |
| `tagging_jobs` | Batch tagging job queue |

## Operational / utility tables

| Table | Purpose |
|---|---|
| `url_attributes` / `url_quality` | Scraped page attributes and quality signals |
| `paywalled_domains` | Known paywalled domains |
| `roam_config` | Feature/experiment flags |
| `home_stats_snapshot` | Cached home-screen stats |
| `saved_urls` | Saved URL state |
| `scrape_suggestions` | URL scrape suggestions |
| `log_failed_urls` | Failed URL log |
| `over_served_unrated` | Over-served-but-unrated tracking |
| `seeding_runs` | Seeder execution audit log |
| `email_log` | Email notification delivery log |

## See also

- [../docs/ALGORITHM.md](../docs/ALGORITHM.md) — how these tables drive scoring.
- [../docs/API.md](../docs/API.md) — Edge Functions and RPCs.
- [../README.md](../README.md) — product overview.
