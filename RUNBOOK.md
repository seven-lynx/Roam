# Roam Runbook

Operational incidents, their root causes, and resolutions. Add an entry for
every production incident and for every non-additive migration (rollback
procedures live here).

## Incidents

| Date | Surface | Symptom | Root cause | Resolution |
|---|---|---|---|---|
| 2026-04-26 | All | `roam()` revert — domain filtering broke discovery | Domain exclusion added in `20260426000001_roam_exclude_current_domain.sql` / `20260426000002_fix_roam_domain_extraction.sql` returned the same URLs repeatedly and broke discovery | Reverted in `20260426000004_revert_to_working_roam.sql`; domain exclusion re-added cleanly in later migrations |
| 2026-05-12 | Android | ROAM-ANDROID-7 / -6 / -4 P0 Sentry incidents | 500 from `roam` Edge Function; DNS failure with no retry; 60s timeouts on every request | Sentry breadcrumb capturing raw response body; retry + exponential backoff for DNS failures; timeouts cut to 15s; error tagging (`fd1accf`) |
| 2026-07-01 | Android | "Session Expired" on discovery | `roam()` v25 referenced a non-existent `seen_urls.seen_url_id` column (42703) and dropped `DEFAULT NULL` on optional params (42883) | Fixed in `20260701220207_fix_seen_urls_column_ref.sql` and `20260701221229_fix_roam_param_defaults.sql` |
| 2026-07-08 | Backend | `admin_analytics()` timed out at 15s | v2 added active_users, submissions_by_dow_hour, velocity, rejection_by_domain; DAU/WAU/MAU full-scanned `seen_urls`/`ratings` (millions of rows); `rejection_by_domain` ran SPLIT_PART over every `moderation_queue` row | `20260708000001_admin_analytics_v3.sql` added partial indexes + `statement_timeout=30s`; `20260708000002_admin_analytics_v4.sql` added materialized views with hourly pg_cron refreshes, timeout 35s |
| 2026-07-09 | All | `roam()` v26 migration drift — remote stuck on v25, discovery 500s → Android "Session expired" | `roam_v26_restore_v24_algorithm.sql` was marked applied but its DDL skipped on remote (file edited after apply); live body lacked `DEFAULT NULL` on middle params, so `roam(p_user_id => uuid)` raised 42883 | `20260709000000_redeploy_roam_v26.sql` re-ran the v26 definition verbatim so the remote function matched the code |
| 2026-07-18 | Backend | `admin_analytics()` v5 timed out; reverted to stable v3 | v5 added 24 heavy GROUP BY queries across 1.5M rows | `20260718000000_admin_analytics_stable.sql` reverted to v3 (12 datasets, <10s); separate focused RPCs for the extra data |
| 2026-07-30 | All | Streak bypass — inflated `streak_days` persisted past gaps; inflated `roam_count` | `record_daily_activity()` pre-inserted a row before `update_streak()`, so the first-activity-of-day gate skipped gap detection, reset, and increment | `20260730000010_fix_streak_bypass.sql` added `p_is_roam` param; `record_daily_activity` now delegates entirely to `update_streak` |
| 2026-08-03 | All | Discovery 404 / "you've seen everything" | `roam()` v30 shipped `array_agg(u.subcategory_id)` referencing a table alias only present inside a subquery; PL/pgSQL does not plan embedded SQL at CREATE FUNCTION time, so the migration applied cleanly then threw 42P01 on every call | Reverted in v31/v32; `scripts/verify-roam-rpc.mjs` added as a regression guard; static check added to CI |
| 2026-08 | All | Every `roam()` timed out for logged-in users | Verification ran under `service_role` (2-min timeout) but `authenticated` has `statement_timeout=8s`, so the query passed tests and failed for users | Hard Rule 1.6: SQL functions must be verified under the `authenticated` role with the real 8s timeout |
| 2026-08-04 | Backend | `supabase db push` blocked — `refresh_report_views()` timed out (57014) | Trailing `SELECT refresh_report_views();` refreshed all 5 materialized views with a 120s timeout on every push, blocking the roam() v32–v35 migrations | `20260718000002_fix_refresh_no_concurrently.sql` removed the trailing call; views refreshed on demand |
| 2026-08-04 | All | `roam()` ran 15–18s against the 8s `authenticated` ceiling (ROAM_EXHAUSTED empty-pool risk) | Per-row `NOT EXISTS LIKE` subqueries inside the candidate loop dominated cost; v34 SYSTEM(2) reached only ~3.9s with no headroom | `20260804000003_roam_v35_hoist_domain_checks.sql` hoisted domain LIKE checks out of the per-candidate loop; `roam-health-check` cron pages on empty pool / latency budget |
| 2026-08-04 | All | `roam()` v35 alias still broken — 42P01 on every call | v35 migration was already marked applied, so its alias fix never took effect; the live function still referenced out-of-scope `u` instead of `t` in `array_agg` | `20260804000004_fix_roam_v35_alias.sql` dropped and recreated every `roam()` overload with `array_agg(t.subcategory_id)` plus a post-patch assertion |
| — | Backend | `supabase db push` fails 28P01 / password authentication failed | Supabase CLI pgx driver cannot authenticate when the DB password contains URL-special characters (upstream supabase/cli#5175) | Reset DB password to alphanumeric + `-`, `_`, `.`; re-run `supabase link` + `db push --include-all` |
| 2026-10 | Backend | Tag graph migration conflicts with `url_tags` | New `url_tags` schema collided with a legacy empty `url_tags` table (TEXT `tag` column) | `20260919000000_drop_legacy_url_tags.sql` drops the legacy shape (guarded) before the tag-graph migration runs |
| — | Web | Silent broken follow button | A dead placeholder `web/src/components/FollowButton.tsx` (hardcoded `isFollowing=false`) shadowed the real `app/u/[username]/FollowButton.tsx` | Deleted the placeholder; Hard Rule 1.7 forbids duplicate component filenames |
| — | All | Accidental production deploys | Commit messages containing `[deploy]` triggered deploys, causing multiple production incidents | Removed the trigger; Hard Rule 1.1 rejects `[deploy]` / `[ship]` / `[prod]` / `[release]` tags |
| 2026-10-10 | CI | Rules Check workflow always "cancelled" — rule enforcement never ran | Both `rules` and `verify-roam-static` jobs shared one `cancel-in-progress` concurrency group, so one cancelled the other on every run | Distinct concurrency group per job; dropped the non-CI-safe `validate-env.mjs` step; `check-rules.mjs` now skips test files; fixed all outstanding `as any`/empty-catch violations the check had been silently missing |
| 2026-10-10 | CI | secrets-scan workflow failed on every push | `betterleaks/betterleaks-action` repo doesn't exist (Betterleaks ships a CLI, not an Action); the config also used the removed `filter.*` namespace and an unpublished `:v2` image tag | Run the CLI via Docker `ghcr.io/betterleaks/betterleaks:v2.0.0-rc.2`; migrated `.betterleaks.toml` to v2 syntax (`[extend] useDefault`, top-level `matchesAny`/`containsAny`/`entropy`) |
| 2026-10-10 | Android | CI failed: `sdkmanager tools` "Failed to find package 'tools'" | Google removed the deprecated `tools` SDK package; `android-actions/setup-android@v3` installs it by default | Override `packages: platform-tools` |
| 2026-10-10 | Android | `./gradlew` failed: "Could not find or load main class GradleWrapperMain" | An Oct 2026 repo migration re-encoded binary files as UTF-8 text, corrupting the committed `gradle-wrapper.jar` | Replaced with the valid Gradle 9.8.0 wrapper JAR; `.gitattributes` marks `*.jar` (and other binaries) as binary to prevent re-corruption |
| 2026-10-10 | Android | CI failed: "File google-services.json is missing" | Firebase `google-services.json` is a gitignored secret; the Google Services plugin hard-fails without it | Skip Android lint/compile in CI when `google-services.json` is absent (they run locally where the secret exists) |
| 2026-10-10 | Extension | CI test failed: check-rules "honors the allowlist file" | The test wrote `.agent-rules-allowlist` but `check-rules.mjs` reads `.rules-allowlist` | Fixed the test to write the correct filename |
| 2026-11-03 | Backend | `home_stats()` timed out (57014); telemetry widget showed zeros | `urls` (~1M rows); `home_stats()` ran COUNT/SUM sequential scans on every call, exceeding `anon`'s 3s `statement_timeout` | `20261103000008_fix_home_stats_perf.sql` cached aggregates in `home_stats_snapshot` for O(1) reads, refreshed hourly by cron |
| 2026-11-04 | Backend | Badge icons mojibake — 106 of 335 badge definitions garbled | Badge seed SQL saved with mixed encoding; multi-byte emoji mangled into CP1252/Latin-1 sequences | `20261104000000_badge_icon_mojibake_repair.sql` idempotent UPDATEs restore each slug's icon to the correct emoji |

## Migration rollbacks

Non-additive migrations (DROP, ALTER TYPE, …) must document a rollback here.

### 20261010000000_fix_moderation_audit_trigger.sql
- Change: Drops the legacy `trg_moderation_audit_log` trigger and its `fn_moderation_audit_log()` function (which forced `admin_id = auth.uid()` and therefore failed when moderation ran under the service role), and makes `moderation_audit_log.admin_id` nullable. The newer `trg_moderation_queue_audit` trigger (added in `20260501000001_moderation_audit_log.sql`) remains the single audit path.
- Rollback: Re-apply the `CREATE OR REPLACE FUNCTION fn_moderation_audit_log()` and `CREATE TRIGGER trg_moderation_audit_log …` definitions from `20260424000000_schema_improvements.sql`, backfill any NULL `admin_id` rows, then `ALTER TABLE moderation_audit_log ALTER COLUMN admin_id SET NOT NULL`.

### 20261016000000_drop_idx_urls_roam_hotpath.sql
- Change: Drops the orphaned `idx_urls_roam_hotpath` covering index on `public.urls` (~370 MB). It was built for an older `roam()` that filtered on `(approved, inactive, language, category_id)` and ordered by `roam_score_static DESC`; the current `roam()` (v35) uses `TABLESAMPLE SYSTEM(5)` plus inline random-weighted scoring and cannot use a B-tree index.
- Rollback: Re-create it from `20260712000000_performance_indexes_and_badge_scheduling.sql` — `CREATE INDEX IF NOT EXISTS idx_urls_roam_hotpath ON public.urls (approved, inactive, language, category_id, roam_score_static DESC) INCLUDE (id, url, title, description, og_image_url, subcategory_id, domain, wilson_score) WHERE approved = TRUE AND inactive = FALSE;`

### 20261016000001_replace_url_tags_surrogate_pkey.sql
- Change: Replaces the surrogate `id` UUID primary key on `public.url_tags` with the composite primary key `(url_id, tag_id)`. `url_tags.id` is never referenced (no FKs, no code reads it); the natural key is `(url_id, tag_id)`, which already has a UNIQUE constraint. Drops the ~43 MB `url_tags_pkey` index and the `id` column.
- Rollback: `ALTER TABLE public.url_tags DROP CONSTRAINT url_tags_pkey; ALTER TABLE public.url_tags ADD COLUMN id UUID NOT NULL DEFAULT gen_random_uuid(); ALTER TABLE public.url_tags ADD PRIMARY KEY (id); ALTER TABLE public.url_tags ADD CONSTRAINT url_tags_url_id_tag_id_key UNIQUE (url_id, tag_id);`

### 20261024000000_home_stats.sql
- Change: Adds `public.home_stats()`, a SECURITY DEFINER SQL function returning one row of aggregate counters (`total_users`, `total_ratings`, `active_urls`, `active_tags`, `total_serves`) for the marketing homepage and `/stats` page. Grant is limited to `anon` and `authenticated`; row-level data is never exposed.
- Rollback: `DROP FUNCTION IF EXISTS public.home_stats();`

### 20261103000009_serve_telemetry_hygiene.sql
- Change: Replaces the broken `urls.serve_count`-based serve telemetry with a lifetime counter (`serve_counter`) maintained by a rollup-before-prune job, and adds a daily hygiene job (`over_served_unrated`). Re-points the nightly `delete-old-seen-urls` cron to `rollup_seen_urls_and_prune()`, makes the `enforce_seen_url_cap` trigger fold evicted rows into the counter, re-sources `home_stats().total_serves` to `serve_counter.total_serves + COUNT(seen_urls)`, and adds a `refresh-over-served-unrated` cron (04:00 UTC).
- Rollback: `DROP TABLE IF EXISTS public.serve_counter, public.over_served_unrated; DROP FUNCTION IF EXISTS public.rollup_seen_urls_and_prune(), public.refresh_over_served_unrated(integer);` then restore `refresh_home_stats()` from `20261103000008_fix_home_stats_perf.sql`, restore `enforce_seen_url_cap()` from `20260506000004_seen_urls_cap.sql`, re-point the `delete-old-seen-urls` cron back to `DELETE FROM public.seen_urls WHERE seen_at < NOW() - INTERVAL '30 days'`, and `SELECT cron.unschedule('refresh-over-served-unrated');`.

<!-- Template:
### <migration filename>
- Change: ...
- Rollback: ...
-->
