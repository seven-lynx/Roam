# Secrets Audit & Rotation Procedure

## Secrets inventory

The following secrets are declared in `.env.example` (gitignored; copy to `.env` and fill from the secure password manager):

| Secret | Purpose | Set via |
|---|---|---|
| `SUPABASE_URL` | Supabase project URL | `.env` / client config |
| `SUPABASE_ANON_KEY` | Public anon key (client-safe) | `.env` / client config |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (server-only, never to client) | `supabase secrets set` |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI personal access token | `.env` |
| `GITHUB_TOKEN` | GitHub API (seeders, optional) | `.env` |
| `NASA_API_KEY` | NASA APOD API (seeder, optional) | `.env` |
| `NYT_API_KEY`, `GUARDIAN_API_KEY`, `SMITHSONIAN_API_KEY`, `EUROPEANA_API_KEY`, `DPLA_API_KEY`, `PODCAST_INDEX_API_KEY`, `PODCAST_INDEX_API_SECRET`, `SEMANTIC_SCHOLAR_API_KEY`, `KAGGLE_TOKEN` | Content seeder API keys (optional) | `.env` |
| `RESEND_API_KEY` | Transactional email | `.env` / `supabase secrets set` |
| `SENTRY_AUTH_TOKEN` | Source-map upload | `.env` / CI |
| `SENTRY_ORG`, `SENTRY_PROJECT` | Sentry org / project | `.env` / CI |
| `CRON_SECRET` | Cron scheduler auth (cron-daily-challenges, cron-streak-cleanup, cron-secret-badges) | `.env` / edge function env |
| `SENTRY_WEBHOOK_SECRET` | Sentry → GitHub webhook shared secret | `supabase secrets set` |
| `SENTRY_DSN` | Edge Function error reporting (Sentry project `roam-supabase`) | `supabase secrets set` |
| `GITHUB_PAT` | GitHub token for filed issues | `supabase secrets set` |
| `GITHUB_REPO` | Target repo for filed issues (defaults to `seven-lynx/Roam`) | `supabase secrets set` |

Edge-function secrets (`SENTRY_WEBHOOK_SECRET`, `SENTRY_DSN`, `GITHUB_PAT`, `FCM_SERVICE_ACCOUNT_JSON`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `RESEND_API_KEY`, `SAFE_BROWSING_API_KEY`) are set on the remote project via `supabase secrets set` and read from the function environment, not from `.env`.

## Rotation procedure

1. Generate the new secret value (long, random string).
2. Add the new value alongside the old in `.env` / `supabase secrets set` so there is no window where the old value stops working before the new one is deployed.
3. Deploy or restart affected services (edge functions, web, extension build).
4. Verify the new value works (logs, health checks, `roam-health-check`).
5. Remove the old value from `.env` / unset the old secret.
6. Update any dependent client configs (e.g. `SUPABASE_ANON_KEY` in `web/.env.local`, `android/local.properties`).
7. Record the rotation date in this document.

## Rotation checklist

- [ ] No hardcoded secrets in the repo (enforced by `scripts/check-rules.mjs` and TruffleHog in CI — see `.github/workflows/ci.yml`).
- [ ] Service-role keys never reach the client (the extension build refuses to bundle `SUPABASE_SERVICE_ROLE_KEY`).
- [ ] `.env` is gitignored (`.gitignore`).
- [ ] Firebase service-account files (`*-firebase-adminsdk-*.json`) and the Android release keystore (`android/roam-release.jks`) are gitignored.
- [ ] Secrets are rotated on any suspected exposure. If a secret may have leaked to the public repository, treat it as compromised and file a security report per `SECURITY.md`.

## Related

- `SECURITY.md` — vulnerability reporting and hard rules that protect users.
- `.github/workflows/secrets-scan.yml` — secret scanning on PRs.
- `.github/workflows/ci.yml` — Trivy + TruffleHog run on every PR.
- `.env.example` — full secret template with placeholder values.