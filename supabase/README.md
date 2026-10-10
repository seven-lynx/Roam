# Roam Supabase Backend

Roam's backend runs on Supabase and provides authentication, the PostgreSQL schema, Row-Level Security, and the Edge Functions that power discovery, ratings, submissions, collections, follows, profiles, feedback, and moderation.

## What lives here

- `migrations/` — schema changes and RLS policies (164 migration files)
- `functions/` — 27 Deno Edge Functions
- `scripts/` — backend tooling (e.g. `check-migrations.mjs` migration drift check)
- `config.toml` — Supabase project configuration

## Current responsibilities

- Serve the discovery RPC that the app clients call to get a URL
- 27 Deno Edge Functions for complex operations: `activity-feed`, `admin-moderation`, `beta-signup`, `challenges`, `collection`, `cron-daily-challenges`, `cron-secret-badges`, `cron-streak-cleanup`, `delete-user`, `evaluate-badges`, `export-user`, `feedback`, `follow`, `leaderboard`, `log-failed-urls`, `profile`, `push-notify`, `rate`, `report-engagement`, `report-url`, `roam`, `roam-health-check`, `save-url`, `scrape-url`, `send-bulk-email`, `share-url`, `submit-url`
- Persist users, URLs, ratings, collections, follows, saved URLs, push tokens, notifications, and moderation data
- Enforce access control with RLS instead of client-side trust
- Keep the public HTTP API documented: see [docs/API.md](../docs/API.md)

## Working on the backend

- Add schema changes as migrations in `migrations/`
- Keep Edge Function input validation strict and explicit
- Update [docs/API.md](../docs/API.md) when request or response shapes change
- Use `supabase db push` to apply migrations; `supabase functions deploy <name>` to deploy functions
- Before a release, run `node supabase/scripts/check-migrations.mjs` to confirm local and remote migration history are in sync

## Migrations

The migration history is the source of truth for the database schema. Two things can silently break it:

1. **Drift** — the remote database applies migrations that aren't committed to the repo (or vice-versa). `check-migrations.mjs` reports any *pending* (local → remote) and *uncommitted* (remote-only) migrations.
2. **Out-of-order application** — a migration applied before an earlier-timestamped one makes `supabase db push` refuse to insert those earlier migrations.

If `db push` reports "Found local migration files to be inserted before the last migration on remote database", rerun with `supabase db push --include-all`.

## Troubleshooting

### `supabase db push` fails with `28P01` / "password authentication failed"

**Resolved.** The production database password now contains only alphanumeric
characters plus `-`, `_`, `.`, so the CLI authenticates correctly. Keep it that
way — do not reintroduce URL-special characters.

**Cause (for reference):** the Supabase CLI's Postgres driver (`pgx`) cannot
authenticate when the database password contains URL-special characters (`$`,
`+`, `*`, `(`, `&`, `)`, etc.). This is a known, unfixed upstream bug
(supabase/cli#5175); `psql` and `node-postgres` connect fine with the same
credentials, only the CLI fails.

If the password is ever reset again, use only alphanumeric plus `-`, `_`, `.`
characters, then re-link:

```powershell
# update .env with the new password, then:
$pw = (Get-Content .env | Where-Object { $_ -match '^SUPABASE_DB_PASSWORD=' } | Select-Object -First 1) -replace '^SUPABASE_DB_PASSWORD=', ''
supabase link --project-ref yrhckctwtdjowulfuaqc --password $pw
supabase db push --include-all
```

Note: the CLI reads the keychain credential set by `supabase link`, **not**
`SUPABASE_DB_PASSWORD` in `.env` — so editing `.env` alone does nothing.

### Tag graph migrations conflict with the existing `url_tags` table

**Resolved.** `20261008000000_tag_graph_schema.sql` runs
`CREATE TABLE public.url_tags`, but production had a legacy `url_tags` table from
the old tagging system (columns `id`, `url_id`, `tag` TEXT, `tagged_by`,
`created_at`). The legacy table was empty and had no dependents, so
`20260919000000_drop_legacy_url_tags.sql` drops it (guarded to only drop the
legacy TEXT-`tag` shape) before the tag-graph migration runs.

## Useful references

- [API reference](../docs/API.md) — full request/response contracts for all functions
- [ROADMAP](../docs/ROADMAP.md) — build history and upcoming work
- [CONTEXT](../docs/CONTEXT.md) — current-state briefing and architectural decisions
- [Main project README](../README.md) — architecture overview and development setup
