# Roam Runbook

Operational incidents, their root causes, and resolutions. Add an entry for
every production incident and for every non-additive migration (rollback
procedures live here — see [RULES.md](RULES.md) §1.4 and
[supabase/RULES.md](supabase/RULES.md) S.5).

## Incidents

| Date | Surface | Symptom | Root cause | Resolution |
|---|---|---|---|---|
| 2026-07-01 | Android | "Session Expired" on discovery | `roam()` v25 referenced a non-existent `seen_urls.seen_url_id` column (42703) and dropped `DEFAULT NULL` on optional params (42883) | Fixed in `20260701220207_fix_seen_urls_column_ref.sql` and `20260701221229_fix_roam_param_defaults.sql` |
| 2026-08-03 | All | Discovery 404 / "you've seen everything" | `roam()` v30 shipped `array_agg(u.subcategory_id)` referencing a table alias only present inside a subquery; PL/pgSQL does not plan embedded SQL at CREATE FUNCTION time, so the migration applied cleanly then threw 42P01 on every call | Reverted in v31/v32; `scripts/verify-roam-rpc.mjs` added as a regression guard; static check added to CI |
| 2026-08 | All | Every `roam()` timed out for logged-in users | Verification ran under `service_role` (2-min timeout) but `authenticated` has `statement_timeout=8s`, so the query passed tests and failed for users | Hard Rule 1.6: SQL functions must be verified under the `authenticated` role with the real 8s timeout |
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

<!-- Template:
### <migration filename>
- Change: ...
- Rollback: ...
-->
