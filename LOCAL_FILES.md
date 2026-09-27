# Local-only files

This repo is **public**. Some files that are part of the Roam development
environment live outside this repository, on the maintainer's local machine.
If you're contributing, you don't need any of these — they're only relevant
for the original author running the project end-to-end.

## Where local-only files live

All local-only files live under `~/Roam-local/` (or wherever the maintainer
chose to back them up). This is **not** part of the git repo.

| What | Local location | Why not in git |
|---|---|---|
| `.env` (real API keys) | `~/Roam-local/secrets/.env` | Contains live secrets for Supabase, Sentry, Resend, content seeders, etc. |
| Internal docs (audits, incidents, costs, roadmap drafts) | `~/Roam-local/docs/` | Reference infrastructure, costs, and incidents that aren't suitable for a public repo. |
| Seeder scripts and report tooling | `~/Roam-local/scripts/` | Call live APIs and reference internal data sources. |
| Firebase service account JSON | `~/Roam-local/android/app/google-services.json` | Project-specific Firebase config. |
| VS Code MCP config | `~/Roam-local/vscode/mcp.json` | Personal AI tooling configuration. |
| Full git history (pre-migration) | `~/Roam-local/roam-history-*.bundle` | Backup bundle from before the public/private split. |

## Setting up your own local-only files

If you're forking and self-hosting, you'll need to:

1. Copy `.env.example` to `.env` in the repo root.
2. Fill in your own values for the services you use (Supabase project, Sentry project, etc.).
3. Skip the local-only files entirely — they're not needed for contributing code.

## Secret rotation

See the maintainer's internal `SECRETS_AUDIT.md` for the rotation procedure.
For contributors, GitHub's built-in secret scanning is enabled on this repo.
