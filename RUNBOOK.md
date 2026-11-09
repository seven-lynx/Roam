# Roam Runbook

Operational incidents, their root causes, and resolutions. Add an entry for
every production incident and for every non-additive migration (rollback
procedures live here).

_Last reviewed: 2026-11-09._

## Hard Rules

Hard Rules are project-wide invariants enforced by `scripts/check-rules.mjs`
and CI. Incident resolutions cite them by number.

| Rule | Title | Enforced by |
|---|---|---|
| 1.1 | Reject `[deploy]` / `[ship]` / `[prod]` / `[release]` commit-message tags | `scripts/check-rules.mjs` (R1) |
| 1.2 | No provenance notes in committed files (comments, docs, commit messages) | `scripts/check-rules.mjs` (R2) |
| 1.3 | No hardcoded secret prefixes | `scripts/check-rules.mjs` (R3); `secrets-scan.yml` |
| 1.4 | No `.skip` migrations in the active directory; move to `_superseded/` | `scripts/check-rules.mjs` (R4) |
| 1.5 | Every env var is documented in the matching `.env.example` | review; `web/src/lib/env.ts` fails the build when a required var is missing |
| 1.6 | SQL functions verified under the `authenticated` role with the real 8s `statement_timeout` | `deploy.yml` / `deploy-staging.yml` ("Verify roam() RPC under authenticated role" — pre-flight step is advisory and records a per-user baseline, the post-migration step blocks on regressions against it); `scripts/verify-roam-rpc.mjs` |
| 1.6½ | Workflow path filters use `dorny/paths-filter`, never `contains(fromJSON([...]))` | `scripts/check-rules.mjs` (R10) |
| 1.7 | No duplicate component filenames (e.g. `web/src/components/X.tsx` vs `app/.../X.tsx`) | `scripts/check-rules.mjs` (R5) |
| 1.8 | `proxy.ts` does not exist; middleware lives in `middleware.ts` | `scripts/check-rules.mjs` (R6) |
| 1.9 | Edge functions are server-authoritative for gamification | `supabase/functions/_tests/user-actions-rls.test.ts` |
| 1.10 | Android release keystore and Firebase service-account keys stay out of the repo | `.gitignore`; `secrets-scan.yml` |

`scripts/check-rules.mjs` IDs are not 1:1 with Hard Rule numbers: R1–R9 cover the
Hard Rules themselves — commit tags, provenance notes, secrets, `.skip` migrations,
duplicate component filenames, `proxy.ts`, the v31 `array_agg(u.*)` warning (R7),
an uncommented empty `catch {}` (R8), and `as any` casts (R9). R10
(`contains(fromJSON(...))` predicates, see 1.6½) and R11 (`<type>/<kebab>` branch
names, Process Rule 2.1 in `RULES.md`) enforce process rules rather than Hard
Rules. R11 also runs locally through `.githooks/pre-push` — register the hook once
per clone with `git config core.hooksPath .githooks`.

## Operational framework

### Severity levels

| Severity | Meaning | Response SLA |
|---|---|---|
| P0 | Production outage or data-loss risk affecting all users | Acknowledge < 15 min; mitigate < 1 h |
| P1 | Major feature broken for a surface (Android, web, backend) | Acknowledge < 1 h; mitigate < 4 h |
| P2 | Degraded performance or partial feature loss | Acknowledge < 4 h; fix in next release |
| P3 | Cosmetic or CI-only issue | Fix at team discretion |

### On-call and escalation

- Primary on-call owns the first response and opens the RUNBOOK entry.
- Escalate to the backend lead for database/Edge Function incidents; to the
  mobile lead for Android incidents; to the web lead for web/CI incidents.
- Any P0 requires a post-incident review within 5 business days.

### Declaring an incident

Declare an incident when any of the following is true:

- User-facing discovery, submission, or authentication fails in production.
- A migration blocks `supabase db push` or fails on remote.
- CI is red on `main` for more than one deploy cycle.
- Data integrity is at risk (streaks, counts, audit logs).

### Post-incident review

Every P0/P1 incident gets a short retrospective capturing: what happened, the
trigger, the fix, how to detect it earlier next time, and any Hard Rule or
process change needed. File the retrospective as a linked comment on the
incident's fix PR.

## Incidents

| Date | Surface | Symptom | Root cause | Resolution | Fix |
|---|---|---|---|---|---|
| 2026-11-09 | All | `roam()` took 17–22s for one account and failed the deploy gate on every dispatch (issue #118) | `u.id != ALL(v_seen_ids)` and `u.domain != ALL(v_cooled_domains)` are ScalarArrayOpExpr, which PostgreSQL cannot hash — 2,803 element comparisons per candidate row, 22.6s; the score-ordered fallback then walked all 990,968 index rows to return 0 rows (44.3s), which it could not avoid because it cannot stop early when fewer than 500 candidates exist. The account's scope had collapsed to one subcategory (198 domains), so every domain was permanently cooling down | `20261109043000_roam_v37_bounded_exhaustion.sql`: exclusions read the source tables (`NOT IN`, planned as a hashed SubPlan, 97ms), the fallback stopped sorting by `roam_score_static` (bounded at 1.4s) and is gated behind a strict probe whose predicate set is identical to its own. The account's 1-subcategory scope was restored to all 8 categories | `20261109043000_roam_v37_bounded_exhaustion.sql` (rollback: re-apply `20261108171257_roam_v36_exists_pool_check.sql`) |
| 2026-04-26 | All | `roam()` revert — domain filtering broke discovery | Domain exclusion added in `20260426000001_roam_exclude_current_domain.sql` / `20260426000002_fix_roam_domain_extraction.sql` returned the same URLs repeatedly and broke discovery | Reverted in `20260426000004_revert_to_working_roam.sql`; domain exclusion re-added cleanly in later migrations | `20260426000004_revert_to_working_roam.sql` |
| 2026-05-12 | Android | ROAM-ANDROID-7 / -6 / -4 P0 Sentry incidents | 500 from `roam` Edge Function; DNS failure with no retry; 60s timeouts on every request | Sentry breadcrumb capturing raw response body; retry + exponential backoff for DNS failures; timeouts cut to 15s; error tagging (`fd1accf`) | `fd1accf` |
| 2026-07-01 | Android | "Session Expired" on discovery | `roam()` v25 referenced a non-existent `seen_urls.seen_url_id` column (42703) and dropped `DEFAULT NULL` on optional params (42883) | Fixed in `20260701220207_fix_seen_urls_column_ref.sql` and `20260701221229_fix_roam_param_defaults.sql` | `20260701220207_fix_seen_urls_column_ref.sql` / `20260701221229_fix_roam_param_defaults.sql` |
| 2026-07-08 | Backend | `admin_analytics()` timed out at 15s | v2 added active_users, submissions_by_dow_hour, velocity, rejection_by_domain; DAU/WAU/MAU full-scanned `seen_urls`/`ratings` (millions of rows); `rejection_by_domain` ran SPLIT_PART over every `moderation_queue` row | `20260708000001_admin_analytics_v3.sql` added partial indexes + `statement_timeout=30s`; `20260708000002_admin_analytics_v4.sql` added materialized views with hourly pg_cron refreshes, timeout 35s | `20260708000002_admin_analytics_v4.sql` |
| 2026-07-09 | All | `roam()` v26 migration drift — remote stuck on v25, discovery 500s → Android "Session expired" | `roam_v26_restore_v24_algorithm.sql` was marked applied but its DDL skipped on remote (file edited after apply); live body lacked `DEFAULT NULL` on middle params, so `roam(p_user_id => uuid)` raised 42883 | `20260709000000_redeploy_roam_v26.sql` re-ran the v26 definition verbatim so the remote function matched the code | `20260709000000_redeploy_roam_v26.sql` |
| 2026-07-18 | Backend | `admin_analytics()` v5 timed out; reverted to stable v3 | v5 added 24 heavy GROUP BY queries across 1.5M rows | `20260718000000_admin_analytics_stable.sql` reverted to v3 (12 datasets, <10s); separate focused RPCs for the extra data | `20260718000000_admin_analytics_stable.sql` |
| 2026-07-30 | All | Streak bypass — inflated `streak_days` persisted past gaps; inflated `roam_count` | `record_daily_activity()` pre-inserted a row before `update_streak()`, so the first-activity-of-day gate skipped gap detection, reset, and increment | `20260730000010_fix_streak_bypass.sql` added `p_is_roam` param; `record_daily_activity` now delegates entirely to `update_streak` | `20260730000010_fix_streak_bypass.sql` |
| 2026-08-03 | All | Discovery 404 / "you've seen everything" | `roam()` v30 shipped `array_agg(u.subcategory_id)` referencing a table alias only present inside a subquery; PL/pgSQL does not plan embedded SQL at CREATE FUNCTION time, so the migration applied cleanly then threw 42P01 on every call | Reverted in v31/v32; `scripts/verify-roam-rpc.mjs` added as a regression guard; static check added to CI | `20260803000000_roam_v31_inline_score_faster.sql` / `20260804000000_roam_v32_fix_recent_subcats_alias.sql` |
| 2026-08 | All | Every `roam()` timed out for logged-in users | Verification ran under `service_role` (2-min timeout) but `authenticated` has `statement_timeout=8s`, so the query passed tests and failed for users | Hard Rule 1.6: SQL functions must be verified under the `authenticated` role with the real 8s timeout | — |
| 2026-08-04 | Backend | `supabase db push` blocked — `refresh_report_views()` timed out (57014) | Trailing `SELECT refresh_report_views();` refreshed all 5 materialized views with a 120s timeout on every push, blocking the roam() v32–v35 migrations | `20260718000002_fix_refresh_no_concurrently.sql` removed the trailing call; views refreshed on demand | `20260718000002_fix_refresh_no_concurrently.sql` |
| 2026-08-04 | All | `roam()` ran 15–18s against the 8s `authenticated` ceiling (ROAM_EXHAUSTED empty-pool risk) | Per-row `NOT EXISTS LIKE` subqueries inside the candidate loop dominated cost; v34 SYSTEM(2) reached only ~3.9s with no headroom | `20260804000003_roam_v35_hoist_domain_checks.sql` hoisted domain LIKE checks out of the per-candidate loop; `roam-health-check` cron pages on empty pool / latency budget | `20260804000003_roam_v35_hoist_domain_checks.sql` |
| 2026-08-04 | All | `roam()` v35 alias still broken — 42P01 on every call | v35 migration was already marked applied, so its alias fix never took effect; the live function still referenced out-of-scope `u` instead of `t` in `array_agg` | `20260804000004_fix_roam_v35_alias.sql` dropped and recreated every `roam()` overload with `array_agg(t.subcategory_id)` plus a post-patch assertion | `20260804000004_fix_roam_v35_alias.sql` |
| — | Backend | `supabase db push` fails 28P01 / password authentication failed | Supabase CLI pgx driver cannot authenticate when the DB password contains URL-special characters (upstream supabase/cli#5175) | Reset DB password to alphanumeric + `-`, `_`, `.`; re-run `supabase link` + `db push --include-all` | — |
| 2026-10 | Backend | Tag graph migration conflicts with `url_tags` | New `url_tags` schema collided with a legacy empty `url_tags` table (TEXT `tag` column) | `20260919000000_drop_legacy_url_tags.sql` drops the legacy shape (guarded) before the tag-graph migration runs | `20260919000000_drop_legacy_url_tags.sql` |
| — | Web | Silent broken follow button | A dead placeholder `web/src/components/FollowButton.tsx` (hardcoded `isFollowing=false`) shadowed the real `app/u/[username]/FollowButton.tsx` | Deleted the placeholder; Hard Rule 1.7 forbids duplicate component filenames | — |
| — | All | Accidental production deploys | Commit messages containing `[deploy]` triggered deploys, causing multiple production incidents | Removed the trigger; Hard Rule 1.1 rejects `[deploy]` / `[ship]` / `[prod]` / `[release]` tags | — |
| 2026-10-10 | CI | Rules Check workflow always "cancelled" — rule enforcement never ran | Both `rules` and `verify-roam-static` jobs shared one `cancel-in-progress` concurrency group, so one cancelled the other on every run | Distinct concurrency group per job; dropped the non-CI-safe `validate-env.mjs` step; `check-rules.mjs` now skips test files; fixed all outstanding `as any`/empty-catch violations the check had been silently missing | — |
| 2026-10-10 | CI | secrets-scan workflow failed on every push | `betterleaks/betterleaks-action` repo doesn't exist (Betterleaks ships a CLI, not an Action); the config also used the removed `filter.*` namespace and an unpublished `:v2` image tag | Run the CLI via Docker `ghcr.io/betterleaks/betterleaks:v2.0.0-rc.2`; migrated `.betterleaks.toml` to v2 syntax (`[extend] useDefault`, top-level `matchesAny`/`containsAny`/`entropy`) | — |
| 2026-10-10 | Android | CI failed: `sdkmanager tools` "Failed to find package 'tools'" | Google removed the deprecated `tools` SDK package; `android-actions/setup-android@v3` installs it by default | Override `packages: platform-tools` | — |
| 2026-10-10 | Android | `./gradlew` failed: "Could not find or load main class GradleWrapperMain" | An Oct 2026 repo migration re-encoded binary files as UTF-8 text, corrupting the committed `gradle-wrapper.jar` | Replaced with the valid Gradle 9.8.0 wrapper JAR; `.gitattributes` marks `*.jar` (and other binaries) as binary to prevent re-corruption | — |
| 2026-10-10 | Android | CI failed: "File google-services.json is missing" | Firebase `google-services.json` is a gitignored secret; the Google Services plugin hard-fails without it | Skip Android lint/compile in CI when `google-services.json` is absent (they run locally where the secret exists) | — |
| 2026-10-10 | Extension | CI test failed: check-rules "honors the allowlist file" | The test wrote `.agent-rules-allowlist` but `check-rules.mjs` reads `.rules-allowlist` | Fixed the test to write the correct filename | — |
| 2026-11-03 | Backend | `home_stats()` timed out (57014); telemetry widget showed zeros | `urls` (~1M rows); `home_stats()` ran COUNT/SUM sequential scans on every call, exceeding `anon`'s 3s `statement_timeout` | `20261103000008_fix_home_stats_perf.sql` cached aggregates in `home_stats_snapshot` for O(1) reads, refreshed hourly by cron | `20261103000008_fix_home_stats_perf.sql` |
| 2026-11-04 | Backend | Badge icons mojibake — 106 of 335 badge definitions garbled | Badge seed SQL saved with mixed encoding; multi-byte emoji mangled into CP1252/Latin-1 sequences | `20261104000000_badge_icon_mojibake_repair.sql` idempotent UPDATEs restore each slug's icon to the correct emoji | `20261104000000_badge_icon_mojibake_repair.sql` |
| 2026-11-08 | Backend | Submitting anything that is not a URL failed with the client's generic "Something went wrong — please try again"; `ROAM-ANDROID-P` held 80 such events, none with a stack | `submit-url` called `normalizeUrl()` unguarded. `_shared/normalise.ts` throws on anything that is not an absolute http(s) URL, so input like `test@roamtheweb.app` escaped `Deno.serve` as a 500 — and the `if (!normalizedUrl) return 400` beside it was unreachable, since the call throws instead of returning falsy | Handler catches and answers `400 { error }`, matching `scrape-url` | `1ad29d4c` |

| 2026-11-09 | Backend | XP and levels stopped moving; no error reached the client | `award_xp()` declares `RETURNS TABLE(new_xp_total, new_level, xp_awarded)` and then ran `RETURN QUERY SELECT * FROM public.apply_xp(...)`, whose result columns carry the same three names — one namespace, two candidates, so every call raised `42702 column reference "xp_awarded" is ambiguous` and awarded nothing. `game-action` logs the failure as a warning, so callers saw success — every call failing since `20261103000002_unify_xp_badges.sql` landed on 2026-11-03. Found while sweeping `function_logs` on 2026-11-09 | `20261109030000_fix_award_xp_ambiguous_column.sql` aliases the `apply_xp` call and qualifies each column; `apply_xp` unchanged | `20261109030000_fix_award_xp_ambiguous_column.sql` |


Dates shown as `2026-08` (month only) or `—` (date not recorded). Fix references the migration file or commit that resolved the incident where known.

## Sentry ↔ GitHub tracking

Every unresolved Sentry group should have an open GitHub issue, and every
`sentry`-labelled issue should track a live group. Three pieces keep that true:

| Piece | Direction | Trigger |
|---|---|---|
| `supabase/functions/sentry-webhook` | Sentry → GitHub | Sentry issue webhook: files an issue, or reopens and comments on a `regressed` one |
| `.github/workflows/sentry-issue-sync.yml` | GitHub → Sentry | A `sentry`-labelled issue is closed or reopened |
| `.github/workflows/sentry-reconcile.yml` + `scripts/sentry-reconcile.mjs` | Both sides read-only; files on request | Mondays 07:00 UTC, plus manual `workflow_dispatch` |

Sentry's issue webhooks fire on state *changes* only (`created`, `resolved`,
`assigned`, `archived`, `unresolved`). A group that stays `unresolved` after its
tracker is closed keeps firing and emits no webhook at all, so the bridge never
reopens the issue: the error goes quiet on GitHub while it is still live. That is
how #85 sat closed while `ROAM-SUPABASE-2` was still firing. Mirroring the close
makes the two states agree, so a later recurrence becomes a genuine `regressed`
transition — which the bridge already reopens and comments on.

### Weekly reconciliation

The Monday run is the drift detector. It **fails when a group and its tracker
disagree**, so a green run means every unresolved group has an open tracker. When
it is red:

```powershell
node scripts/sentry-reconcile.mjs --check          # the report the workflow printed
gh workflow run sentry-reconcile.yml -f file=true  # file/reopen the drifted groups
node scripts/sentry-reconcile.mjs --check          # now exits 0
```

`--file` posts a synthesized `action: created` payload to the same webhook Sentry
calls, so dedupe (`create` / `reopen` / `comment` / `skip`), the `sentry` label,
redaction, and enrichment all stay in `supabase/functions/sentry-webhook/normalize.ts`.
Re-running it is safe: a group whose tracker is already open is commented on or
skipped, never filed twice.

Never silence a red run with `|| true` — the non-zero exit is the entire signal.

### Configuration

Setup (Sentry custom integration, `?secret=` URL) lives in `supabase/README.md`.
What matters when something stops working:

| Name | Where it lives | Needed by | If missing |
|---|---|---|---|
| `SENTRY_AUTH_TOKEN` | repo secret | both workflows | job prints a notice and mirrors/files nothing |
| `SENTRY_WEBHOOK_SECRET` | repo secret **and** Supabase secret | reconcile `--file`; the bridge | `--file` falls back to reporting; the bridge answers `401 unauthorized` |
| `SUPABASE_URL` | repo secret | reconcile `--file` | no URL to post to; read from `vars.SUPABASE_URL`, falling back to `secrets.SUPABASE_URL` |
| `SENTRY_WEBHOOK_URL` | repo variable | override only | set it only if the function is not at `<SUPABASE_URL>/functions/v1/sentry-webhook` |
| `GITHUB_PAT` | Supabase secret | the bridge | issue creation fails with `502` |

Rotating `SENTRY_WEBHOOK_SECRET` means updating the Sentry integration URL as well
as both secrets — the secret travels in the URL's `?secret=` parameter, so a
half-done rotation silently stops filing.

### Failure modes

| Symptom | Cause | Action |
|---|---|---|
| `Sentry replied 404` (sync workflow) | group deleted or merged in Sentry | warning and exit 0 — nothing can be mirrored |
| `No sentry-issue marker in #N` | issue hand-labelled `sentry`, or its body was edited | file again through `--file`, or drop the label |
| `401 unauthorized` from the function | repo secret and Supabase secret have drifted apart | set both from one value; rotate together |
| `502` from the function | `GITHUB_PAT` missing or without `Issues: write` | rotate the token |
| Green run but a Sentry error has no issue | the group has not changed state since the integration was installed, so no webhook ever fired | run `--check`, then `--file` — this is the case the weekly run exists for |

When the behaviour here changes, change the workflow files and this section in the
same commit: the secrets table and the `--file` gate are what drift first.

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
- Related incident: `2026-11-03` `home_stats()` timed out (57014).

### 20261103000010_moderation_queue_category_id.sql
- Change: Adds `category_id` (pillar) to `moderation_queue` so pillar-level submissions are preserved end-to-end; previously `submit-url` only stored `subcategory_id`, so clients sending a top-level `category_id` (web, extension, Android thumbs-up) had it silently dropped and landed in discovery as uncategorized.
- Rollback: None required — additive (`ALTER TABLE ... ADD COLUMN`). To reverse: `ALTER TABLE public.moderation_queue DROP COLUMN category_id;`

### 20261104000000_badge_icon_mojibake_repair.sql
- Change: Idempotent UPDATEs restoring each garbled badge slug's icon to the correct emoji (106 of 335 badge definitions were mangled from mixed CP1252/Latin-1 seed encoding).
- Rollback: None required — idempotent data repair. Related incident: `2026-11-04` Badge icons mojibake.

### 20261104000010_restore_weekly_challenge_warrior_badge.sql
- Change: Re-inserts the dropped "Complete 5 weekly challenges" badge under the unique slug `weekly-challenge-warrior` (category `curiosity`) after the original `weekly-warrior` slug was already taken by the streaks badge.
- Rollback: None required — additive (`INSERT ... ON CONFLICT (slug) DO NOTHING`). To reverse: `DELETE FROM public.badges WHERE slug = 'weekly-challenge-warrior';`

### 20261104000020_approval_copy_catalog_to_database.sql
- Change: Rewords the moderation decision notification body from "...was approved and is now in the catalog." to "...was approved and is now in the database." for consistency across the in-app notification and transactional approval email.
- Rollback: Restore the prior body wording in `public.notify_on_moderation_decision()` (replace "the database." with "the catalog." in the approved branch).

### 20261104000030_walkthrough_completed.sql
- Change: Adds `profiles.walkthrough_completed_at timestamptz` and backfills existing accounts to `created_at` so they skip the scripted onboarding walkthrough.
- Rollback: None required — additive (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` + UPDATE). To reverse: `ALTER TABLE public.profiles DROP COLUMN walkthrough_completed_at;`

### 20261107184451_url_failure_tracking.sql
- Change: Adds `public.url_failure_reports` (primary key `(url_id, user_id)`) and the `report_url_failures(jsonb)` SECURITY DEFINER RPC, plus `urls.inactive_since` maintained by `handle_urls_inactive_since()` so the 500-retirements-per-day cap is a single indexed query. Also dedupes `url_reports` and adds the unique `(url_id, user_id)` index that the `report-url` upsert now depends on, and schedules `delete-old-url-failure-reports` (03:30 UTC, 180-day purge). Replaces the deleted `log-failed-urls` Edge Function.
- Rollback: Redeploy the pre-upsert `report-url` first — it fails with "no unique or exclusion constraint matching the ON CONFLICT specification" the moment `uq_url_reports_url_user` is dropped. Then: `DROP FUNCTION IF EXISTS public.report_url_failures(jsonb); DROP TABLE IF EXISTS public.url_failure_reports; DROP TRIGGER IF EXISTS trg_urls_inactive_since_ins ON public.urls; DROP TRIGGER IF EXISTS trg_urls_inactive_since ON public.urls; DROP FUNCTION IF EXISTS public.handle_urls_inactive_since(); ALTER TABLE public.urls DROP COLUMN IF EXISTS inactive_since; DROP INDEX IF EXISTS public.uq_url_reports_url_user; SELECT cron.unschedule('delete-old-url-failure-reports');`
- Irreversible: the `url_reports` dedupe deletes duplicate rows. They are not recoverable; only write this migration off if the retired pairs can be re-collected from clients.

### 20261109060000_roam_v38_prefetch_skips_state.sql
- Change: Adds `public.mark_url_seen(url_id, cool_domain)` (the single definition of "a serve happened": the `seen_urls` upsert plus the 24 h domain cooldown) and `public.roam_prefetch(user, count, exclude_domains, category, subcategory)`, which sets the transaction-local GUC `roam.prefetch` and loops `roam()` accumulating returned domains. `roam()` keeps its six-argument signature, so the gate is a `CREATE OR REPLACE` — the OID and the existing grants survive and no second overload can appear. Prefetch stops consuming discovery state (issue #122).
- Rollback: Re-apply the `roam()` body from `20261109043000_roam_v37_bounded_exhaustion.sql`, then `DROP FUNCTION IF EXISTS public.roam_prefetch(uuid, integer, text[], uuid, uuid); DROP FUNCTION IF EXISTS public.mark_url_seen(uuid, boolean);`. **Deploy the Edge Function first in that direction**: the current `roam` function calls `roam_prefetch`, which 503s every prefetch until it is redeployed. The clients swallow that, so the failure mode is an empty prefetch buffer, not a broken serve.
- Related: `docs/API.md` (`roam`, `roam_prefetch()`, `mark_url_seen()`), `docs/ALGORITHM.md` §9.

### 20261109120000_retire_engagement_metrics.sql
- Change: Retires the engagement metrics. Drops `trg_seen_urls_engagement_pair_scores`, `update_pair_scores_from_engagement()`, `idx_seen_urls_engagement`, and `report_engagement()` (defensive `IF EXISTS`: that RPC shipped in `20261109070000` (#126) but was never applied to any project — `supabase migration list` shows no remote version — and its file is deleted with this change). `seen_urls.dwell_ms`/`skipped` are kept and marked deprecated: both are permanently NULL, because their only writer was an RLS-blocked client UPDATE, so the trigger and `roam()`'s seven `skipped = TRUE` filters were inert. Nothing reads them.
- Rollback: Recreate the trigger and function from `20260708000004_interest_pair_scores_v2.sql` and the index from `20260708000003_seen_urls_engagement.sql`, then restore the Edge Function and the extension plumbing from git history. No data is lost by design — the columns were never written.
- Related: `supabase/CHANGELOG.md`, `docs/API.md` (`mark_url_seen`), `extension/CHANGELOG.md`.

## How to cut an entry

When to write an entry:

- Every production incident (user-facing discovery, submission, authentication, or data-integrity failure) gets an incidents-table row.
- Every non-additive migration (`DROP`, `ALTER TYPE`, column removal, etc.) gets a Migration rollbacks entry with a Change and a Rollback.
- Additive migrations may be documented here for traceability but do not require a rollback.

Required fields (incidents table):

| Field | What to include |
|---|---|
| Date | `YYYY-MM-DD`; `2026-08` if only the month is known; `—` if not recorded |
| Surface | `All`, `Android`, `Backend`, `CI`, `Web`, or `Extension` |
| Symptom | What users or operators observed |
| Root cause | The underlying cause, with migration/function names and SQLSTATE codes where relevant |
| Resolution | What fixed it, with migration filenames |
| Fix | The migration file or commit hash that resolved it, or `—` |

Required fields (migration rollbacks):

- `### <migration filename>` heading
- `- Change:` what the migration does
- `- Rollback:` exact steps to reverse it, or "None required — additive" plus a reverse command
- `- Related incident:` (optional) links to the incidents-table row by date

Process:

1. Open the incident as soon as severity is confirmed (P0/P1: within the response SLA).
2. Fix the issue and merge the fix PR.
3. Add the RUNBOOK entry in the same PR or a fast-follow docs PR.
4. For P0/P1, file the post-incident review as a comment on the fix PR (see Operational framework).

Severity and escalation are defined in the Operational framework section above; Hard Rules are listed in the Hard Rules section above.
