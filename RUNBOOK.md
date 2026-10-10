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
There are currently no outstanding non-additive migrations requiring a rollback.

<!-- Template:
### <migration filename>
- Change: ...
- Rollback: ...
-->
