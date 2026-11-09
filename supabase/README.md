# Roam Supabase Backend

Roam's backend runs on Supabase and provides authentication, the PostgreSQL schema, Row-Level Security, and the Edge Functions that power discovery, ratings, submissions, collections, follows, profiles, feedback, and moderation.

## What lives here

- `migrations/` — schema changes and RLS policies (full schema history)
- `functions/` — 31 Deno Edge Functions
- `scripts/` — backend tooling (e.g. `check-migrations.mjs` migration drift check)
- `config.toml` — Supabase project configuration

## Current responsibilities

- Serve the discovery RPC that the app clients call to get a URL
- 30 Deno Edge Functions for complex operations: `activity-feed`, `admin-moderation`, `beta-signup`, `challenges`, `collection`, `cron-daily-challenges`, `cron-notification-cleanup`, `cron-secret-badges`, `cron-streak-cleanup`, `delete-user`, `evaluate-badges`, `export-user`, `feedback`, `follow`, `game-action`, `leaderboard`, `profile`, `push-notify`, `rate`, `report-engagement`, `report-url`, `roll-action`, `roam`, `roam-health-check`, `save-url`, `scrape-url`, `send-bulk-email`, `sentry-webhook`, `share-url`, `submit-url`
- Persist users, URLs, ratings, collections, follows, saved URLs, push tokens, notifications, and moderation data
- Enforce access control with RLS instead of client-side trust
- Keep the public HTTP API documented: see [docs/API.md](../docs/API.md)

## Working on the backend

- Add schema changes as migrations in `migrations/`
- Keep Edge Function input validation strict and explicit
- Update [docs/API.md](../docs/API.md) when request or response shapes change
- Use `supabase db push --project-ref yrhckctwtdjowulfuaqc --password <db-password>` to apply migrations to production (always pass `--project-ref` — the CLI may be linked to `roam-staging`); `supabase functions deploy <name>` to deploy functions
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

## Sentry → GitHub issue webhook

`functions/sentry-webhook/` receives Sentry webhooks and files a GitHub issue in
`seven-lynx/Roam` for every new or regressed error. It is deterministic plumbing
(no model calls). It is deployed with `verify_jwt = false` (see `config.toml`)
and is protected by a shared secret instead of a JWT.

**Secrets (set via `supabase secrets set`):**

| Secret | Purpose |
| --- | --- |
| `SENTRY_WEBHOOK_SECRET` | Shared secret; Sentry sends it as the `x-sentry-webhook-secret` header or `?secret=` query param |
| `GITHUB_PAT` | GitHub token with `Issues: write` on `seven-lynx/Roam` |
| `SENTRY_AUTH_TOKEN` | Optional — enrich filed issues with the latest event's stack trace |
| `GITHUB_REPO` | Optional — target repo, defaults to `seven-lynx/Roam` |

**Deploy:**

```powershell
supabase functions deploy sentry-webhook
```

**Sentry-side setup (one-time):**

1. In Sentry, create a custom integration (Settings → Developer Settings →
   Custom Integrations) with the webhook URL
   `https://<project-ref>.supabase.co/functions/v1/sentry-webhook?secret=<SENTRY_WEBHOOK_SECRET>`,
   and enable the **Issue** webhook subscription (and/or the **Alert Action**
   toggle if you prefer alert-rule-driven filing).
2. The function files an issue on `created` / `unresolved`+`regressed`. It is
   idempotent per Sentry issue: repeated deliveries do not create duplicates
   (dedup key is `sentry-issue:<id>` in the issue body).
3. Bodies are redacted before filing — bearer tokens, JWTs, Supabase keys,
   `key=value` credentials and email addresses never reach the (public) repo.
   See **Redaction** in `docs/API.md`.

### Keeping GitHub and Sentry in step

Issue webhooks fire on state *changes* only (`created`, `resolved`, `assigned`,
`archived`, `unresolved`), which leaves two blind spots: a group that has been
unresolved since before the integration was installed never emits a `created`
webhook, and a group whose tracking issue was closed while it stayed unresolved
emits nothing afterwards — it was never resolved, so it cannot become `regressed`
and the reopen path never runs.

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `sentry-issue-sync.yml` | issue closed / reopened with label `sentry` | Resolves (or un-resolves) the Sentry group named by the body's `sentry-issue:<id>` marker |
| `sentry-reconcile.yml` | weekly, plus `workflow_dispatch` | Runs `scripts/sentry-reconcile.mjs`; `--file` hands drifted groups to the bridge as a synthesized `action: created` payload |

Both need the repository secret `SENTRY_AUTH_TOKEN` (org-scoped, `event:write`).
Filing from CI additionally needs the repository secret `SENTRY_WEBHOOK_SECRET`; the
webhook URL is derived from the existing `SUPABASE_URL` repository secret, and
`vars.SENTRY_WEBHOOK_URL` overrides it if a non-standard URL is ever needed.
Locally: `node scripts/sentry-reconcile.mjs --check`. Operating procedure, failure
modes, and the response to a red weekly run are in `RUNBOOK.md` → *Sentry ↔ GitHub
tracking*.

## `push-notify` database webhook

`functions/push-notify/` is triggered by a **Supabase Database Webhook** on
`INSERT` into `public.notifications`. It resolves the recipient's `push_tokens`
and delivers a push message via FCM (Android) and Web Push (browser). For
moderation decisions (`url_approved` / `url_rejected`) it also sends a
transactional email via Resend when email notifications are enabled.

**One-time webhook setup (must be created in the dashboard — it is not captured
by migrations):**

1. Go to **Database → Webhooks → Create a new webhook**.
2. Configure:
   - **Name:** `notify-on-insert`
   - **Table:** `notifications`
   - **Events:** `INSERT`
   - **Payload format:** `JSON` — the function expects `{ type, table, record }`
   - **HTTP method:** `POST`
   - **URL:** `https://<project-ref>.supabase.co/functions/v1/push-notify`
   - **Auth:** service-role (so the webhook is authenticated; the function itself
     does not verify a JWT).

**Secrets (set via `supabase secrets set`):**

| Secret | Purpose |
| --- | --- |
| `FCM_SERVICE_ACCOUNT_JSON` | Firebase service-account JSON for Android FCM |
| `FCM_PROJECT_ID` | Firebase project id |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push VAPID keys |
| `RESEND_API_KEY` | Resend API key for transactional approval/rejection emails |

**Per-type opt-out:** the function reads `user_settings.notification_preferences`
(a JSONB of `{ "<type>": { "push": true, "email": true } }`). An absent type or
channel means enabled; only an explicit `push: false` / `email: false` skips that
channel. Email is additionally limited to `url_approved` and `url_rejected`, and
is skipped when `user_settings.email_notifications` is false.

## Useful references

- [Changelog](./CHANGELOG.md) — notable schema, RLS, and Edge Function changes
- [API reference](../docs/API.md) — full request/response contracts for all functions
- [ROADMAP](../docs/ROADMAP.md) — build history and upcoming work
- CONTEXT — current-state briefing and architectural decisions (maintainer-local; not committed to this repository)
- [Main project README](../README.md) — architecture overview and development setup
