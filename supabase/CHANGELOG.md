# Changelog

All notable changes to the Roam Supabase backend (PostgreSQL schema, Row-Level Security, and Deno Edge Functions).

## [2026-11-09] — `report_engagement()`: engagement reports actually persist (issue #122 follow-up)
### Fixed
- **`report-engagement` had never written a row.** It used a client-side `.from('seen_urls').update(...)` under the caller's JWT, and `seen_urls` is RLS-enabled with a SELECT-only policy (`20260423000000_initial.sql:262,347` — "Written exclusively by roam() ... no INSERT policy needed"). The UPDATE matched zero rows and PostgREST answered 204, so there was no error to log: `dwell_ms`/`skipped` stayed NULL for every report the browser extension sent. That also left `trg_seen_urls_engagement_pair_scores` (`AFTER UPDATE OF dwell_ms, skipped`) unfired, so `interest_pair_scores` never learned from engagement, and `roam()`'s skip penalty (`skipped = TRUE`) never saw a row.
- **The write moved into `public.report_engagement(url_id, dwell_ms, skipped)`** — `SECURITY DEFINER`, user from `auth.uid()`, so there is no `p_user_id` to spoof and no UPDATE policy to add to a table whose writes are deliberately server-only. Same shape as `mark_url_seen()`.
- **A report is proof of a serve.** The RPC upserts: a URL that reached the screen without a row — a v38 prefetch, or any client predating `mark_url_seen()` — is now recorded instead of being dropped. On conflict only `dwell_ms`/`skipped` move, so reporting engagement never re-orders the 3,000-row exclusion window or extends a 24 h cooldown.
- A `url_id` that does not exist maps to **400**, not 500: an FK violation there is a stale client, not a server fault.

### Deploy order
- Migration **before** Edge Function — the function calls `report_engagement()`, which does not exist until the migration lands. Reversed, every report 500s; the extension fires it per page and ignores failures, so the failure mode is missing engagement data, not a broken browse.

## [2026-11-09] — `roam()` v38: prefetch stops consuming discovery state (issue #122)
### Fixed
- **A prefetch no longer writes `seen_urls` or refreshes a domain cooldown.** The `roam` Edge Function's `prefetch` flag only gated XP, so every buffered URL cost a seen row and a 24 h `user_domain_cooldowns` entry exactly like a real serve. With the web deck ticking every 4,000 ms in batches of 5, a user who reads 12 URLs in a minute buffered enough to cool every domain in a narrow scope for a day — the state #118 then had to make cheap to *detect*. Prefetch now routes to `roam_prefetch()`, which sets the transaction-local GUC `roam.prefetch` and loops `roam()`, accumulating returned domains so a non-writing `roam()` still yields distinct rows.
- **`roam()` keeps its 6-argument signature**, so the write gate could be added with `CREATE OR REPLACE`: the OID and the existing `REVOKE`/`GRANT` survive and no second overload can appear. Adding a 7th parameter would have landed as an overload beside the 6-argument one (PostgREST cannot resolve that reliably), and a `DROP`-and-recreate discards privileges that a replace keeps.
- **`mark_url_seen(url_id, cool_domain)` is now the single definition of "a serve happened"** — the seen upsert plus the cooldown refresh, `SECURITY DEFINER`, keyed off `auth.uid()`. `roam()` calls it for a real serve; the clients call it when a *prefetched* URL reaches the screen, which is the only place that state should be created. Without it, a buffered-then-shown URL would get no row at all: `report-engagement`'s `UPDATE` would match 0 rows with no error, the skip penalty would never set, and the 24 h cooldown would never fire for a served URL, so the deck would keep re-serving the same domain.
- **The batch is one round trip.** `roam_prefetch()` loops server-side, so the deck's ~94 `roam()` calls/min drops to ~19 (`count` 5 → 1 call).

### Added
- `scripts/verify-roam-rpc.mjs` guards both invariants the design rests on: **exactly one** `public.roam()` overload, and that overload's body still consults `roam.prefetch`. Neither previous static check could have caught a duplicate overload — both scan *all* overloads for a regex, so a stale 6-argument body passed them, and the DB-backed half of `rules-check.yml`'s `verify-roam-static` job is a stub that exits 0. The prefetch-gate check skips itself when `roam_prefetch()` is absent, so the pre-migration preflight still passes.
- `docs/API.md` entries for `roam_prefetch()` and `mark_url_seen()`, and the `prefetch` request flag re-documented as "writes no discovery state".

### Deploy order
- Migration **before** Edge Function: `roam_prefetch()` does not exist until the migration lands, and the reverse order 503s every prefetch. The client already swallows that (`web/src/lib/roam-buffer.ts`), so the failure mode is an empty buffer, not a broken serve.


## [2026-11-09] — `roam()` v37: discovery stops paying 20 s to find nothing
### Fixed
- `roam()` excludes seen URLs and cooled domains with `NOT IN (SELECT ... FROM seen_urls / user_domain_cooldowns ...)` instead of `<> ALL(array)`. `<> ALL` is a ScalarArrayOpExpr and PostgreSQL cannot hash it — the executor rescans the array for every candidate row, so a 2,000-entry seen set plus 803 cooled domains cost ~23 µs per row: **22,601 ms** for a bare seq scan carrying only those two predicates. The subquery form plans as a hashed SubPlan and the same probe now measures **97 ms** (issue #118). The shape matters: `NOT EXISTS (SELECT 1 FROM unnest(arr) ...)` does *not* hash here — `unnest` is estimated at 10 rows, so the planner picks a Nested Loop Anti Join and rescans per row (measured 3.6 s, 4.7M comparisons). Tables carry statistics; arrays do not.
- The score-ordered fallback dropped its `ORDER BY roam_score_static DESC`. That ordering made it an index walk over **990,968** index rows whenever fewer than 500 candidates existed — the only state the branch ever runs in — and it could not stop early: **44,320 ms** producing 0 rows, 12,876 ms with the exclusions already hashed. Unordered `LIMIT 500` is bounded at **1,381 ms**; the outer query still weights candidates by `eff_score * (0.7 + 0.3 * random())`.
- The fallback, and the `v_pool_check` retry after it, are gated behind a strict probe over the fallback's *own* predicate set. When the strict set is empty — an account whose whole scope is cooling down — the function now answers "nothing available" in one probe instead of proving it row by row. Combined: saturated scope **17-22 s → 97 ms**, near-empty path **44 s → ~1.4 s**.
- `scripts/verify-roam-rpc.mjs` fails the deploy gate if any `roam()` overload reintroduces `<> ALL` over the seen/cooldown/skip arrays. The latency was invisible to every existing check: the migration applied cleanly, the query returned correct rows, and only the clock noticed.

## [2026-11-09] — The silent failures behind the log sweep
### Fixed
- `roam` reads `update_streak`'s result as what it is. `RETURNS TABLE` makes the client hand back an array of rows, so `streak_days`, `max_streak` and `is_streak_broken` came back `undefined` and every call logged `streak updated: undefined days (best: undefined, broken: false)` for a streak that had in fact been updated. The row is now taken from `data[0]`.
- `roam` checks the `error` that `update_streak` and `award_xp` return. supabase-js reports an RPC failure in `error` rather than throwing, so the `catch` blocks wrapped around these calls could never fire: an award that failed left no log line at all. That is why the `42702` above surfaced from `game-action`, which does check, and never from `roam`, which generates most of the traffic.
- `leaderboard` upserts its snapshot instead of inserting it. Two refreshes can start inside the same millisecond, and `delete`-then-`insert` then writes the same `(period, user_id, snapshot_at)` twice — the second one collided on `leaderboard_snapshots_pkey` and logged a 23505 for a row that was already correct. `ignoreDuplicates` turns the loser into a no-op.

## [2026-11-09] — `award_xp()` stops raising 42702 on every call
### Fixed
- `award_xp()` no longer dies with `column reference "xp_awarded" is ambiguous`. It declares `RETURNS TABLE(new_xp_total, new_level, xp_awarded)` and then ran `RETURN QUERY SELECT * FROM public.apply_xp(...)`, whose result carries those same three names — one namespace, two candidates, `42702`. `apply_xp` is correct and untouched; the wrapper now aliases the call and qualifies every column. **All** `award_xp()` calls had been failing since `20261103000002_unify_xp_badges.sql` turned the function into this wrapper on 2026-11-03, so XP and levels were frozen while callers saw success: `game-action` catches the error and logs `[game-action] apply_xp failed: …` as a **warning**, observed every ~20 s on 2026-11-07. Nothing exercised the wrapper's `RETURN QUERY`, so the migration applied cleanly and only runtime traffic found it.

## [2026-11-09] — Submitting a non-URL answers 400 instead of 500
### Fixed
- `submit-url` guards its `normalizeUrl()` call. `_shared/normalise.ts` throws on anything that is not an absolute http(s) URL — `new URL('test@roamtheweb.app')` raises `TypeError: Invalid URL` — and the handler called it unguarded, so the throw escaped `Deno.serve` as a **500** carrying a body no client could explain. Android maps every status outside its listed branches to "Something went wrong — please try again", which is the entire content of `ROAM-ANDROID-P`: 80 events, no stack on any of them, first seen 2026-06-07 (issue #112). The handler now mirrors `scrape-url` and returns `400 { error: <reason> }`. Reachable only by authenticated callers, so nothing leaked; the cost was an unactionable Sentry group plus a false server-fault signal for what is a plain input error.

## [2026-11-08] — Sentry groups and their GitHub trackers stay in step
### Fixed
- Closing a Sentry-filed issue now resolves the Sentry group it tracks, and reopening the issue un-resolves it (`.github/workflows/sentry-issue-sync.yml`, keyed off the `<!-- sentry-issue:<id> -->` marker the bridge writes). Sentry's issue webhooks fire on state *changes* only — `created`, `resolved`, `assigned`, `archived`, `unresolved` — so a group left `unresolved` next to a closed tracker emitted nothing afterwards. It could never become `regressed` either, which meant the reopen/comment path added for #101 never ran for it: #85 was closed at 17:35:48 while `ROAM-SUPABASE-2` was still unresolved and still receiving events.
- `scripts/sentry-reconcile.mjs` (weekly via `.github/workflows/sentry-reconcile.yml`, or on demand) compares every unresolved Sentry group with its GitHub tracker and reports the drift. Two states never reach GitHub on their own: a group that has been unresolved since before the integration was installed never emits a `created` webhook (`ROAM-ANDROID-P`, first seen 2026-06-07, 80 events, no tracker of any kind), and the closed-tracker case above. `--file` hands a drifted group to the existing bridge as a synthesized `action: created` payload, so dedupe, labels, redaction, stack-trace enrichment and the reopen decision all run unchanged instead of being re-implemented in a second place.

## [2026-11-08] — Sentry issue bodies keep their stack traces after the payload change
### Fixed
- `sentry-webhook` reads the exception from the shape the events API actually returns. `exceptionValues` only looked at a top-level `exception` key, which webhook payloads carry but `…/events/latest/` does not — it nests the same data under `entries[]` as `{ type: 'exception', data: { values } }`. Enrichment therefore fetched a valid event, parsed zero frames, and filed the issue without a `### Stack trace` section on its **silent** exit, so the #43 warnings never fired and the outage read as a rotated `SENTRY_AUTH_TOKEN`. The secret was correct throughout: its published digest matches `sha256` of the working token, and the same token read 15 frames off issue #71's event while the GitHub issue showed none (issue #93).
- `release` is read as either a string (webhooks) or `{ version }` (events API), so an enriched issue's `Release` row is no longer permanently empty.
- The third enrichment exit — an issue URL that yields no API base — now logs a `sentry-webhook:` warning like the other two, instead of returning silently.

### Security
- `sentry-webhook` redacts issue titles, messages, culprits, stack frames and tag values before filing: bearer tokens, JWTs, `sb_publishable_*` / `sb_secret_*` keys, generic `key=` credentials (`apikey`, `token`, `password`, `secret`, `authorization`) and email addresses. An `UnauthorizedRestException` from the Android and extension clients echoes the failed call's full request headers — including a live user session token and their email — and `seven-lynx/Roam` is public. Found while backfilling issues #55–#61; none of those leaked (checked before filing). Redaction is idempotent, so already-redacted text passes through unchanged.
### Fixed
- `tagsToObject` accepts the `[{ key, value }]` shape the events API returns as well as webhook `[key, value]` pairs, so an enriched issue now actually renders its `### Tags` table instead of silently omitting the section.
- Markdown table cells escape `|` and collapse newlines, so a tag or release containing a pipe can no longer break the field or tag tables.

## [2026-11-07] — Sentry issue bodies keep their stack traces
### Fixed
- `sentry-webhook` says so when enrichment is off instead of returning silently. A missing `SENTRY_AUTH_TOKEN` and a non-OK event fetch each log a warning now, so an issue filed without a `### Stack trace` section is one log line away from the cause instead of a mystery in the issue body (issue #19).

## [2026-11-07] — Supabase CLI v3 compatibility
### Fixed
- `config.toml` uses the `[local_smtp]` section instead of the removed `[inbucket]` one. The CLI renamed it in v2.108.0 and rejects the old name outright, so the deploy workflow's migration dry-run failed before Edge Functions could be deployed.
- `auth.email.enable_signup` / `auth.sms.enable_signup` became `auth.email.enabled` / `auth.sms.enabled`, ahead of their removal in CLI v4.

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
