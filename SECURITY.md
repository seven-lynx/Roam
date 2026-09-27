# Security Policy

## Reporting a vulnerability

**Please do not file a public GitHub issue for security bugs.**

Send vulnerability reports by email to the address listed in
[`README.md`](README.md). Encrypt sensitive details with the PGP key
published on the maintainer's profile (linked from the same README).

A good report includes:

- A clear description of the issue and its impact.
- Reproduction steps or a minimal proof-of-concept.
- The affected commit SHA, file, and (if known) deploy URL.
- Your name / handle for the public credit list, if you want one.

We aim to acknowledge reports within **3 business days** and to ship a fix
or a documented mitigation within **30 days** of confirmation. Critical
issues (active exploitation, data exposure) are escalated to a hotfix.

## Supported versions

| Component | Supported | Notes |
|-----------|-----------|-------|
| Web (`web/`) | Latest `main` | Live at https://roamtheweb.app |
| Browser extension | Latest store release | Both Chrome Web Store and Firefox AMO |
| Android app | Latest Play Store release | Min SDK 26, target SDK 35 |
| Supabase backend | Latest `main` migrations | `supabase db reset` before push |

## Hard rules that protect users

These are enforced by `scripts/check-rules.mjs` and CI:

- **No hardcoded secrets.** Prefixes checked: `AIza`, `sk-`, `sntryu_`,
  `sbp_`, `sb_secret_`, `sb_publishable_`, `re_`, `KGAT_`. See the rulebook
  at the repo root (┬º 1.3) and [`docs/SECRETS_AUDIT.md`](docs/SECRETS_AUDIT.md).
- **Row-Level Security on every table.** RLS is the security boundary;
  middleware redirects are UX, not enforcement. See the Supabase backend
  rule file for details.
- **Service-role keys never reach the client.** The extension build
  refuses to bundle `SUPABASE_SERVICE_ROLE_KEY`. See the browser
  extension rule file (┬º E.1).
- **Trivy + TruffleHog run on every PR.** See
  `.github/workflows/ci.yml`.

## Public mirror hygiene

The public mirror is built by `sync-public.ps1`, which strips:

- `docs/` (internal design docs, incident retros)
- `scripts/` (seeder scripts, internal tooling)
- `.github/skills/`, `.github/copilot-instructions.md`, `CLAUDE.md`,
  `web/CLAUDE.md`, `web/RULES.md`
- `.github/workflows/deploy.yml`, `health-check.yml`, `reports.yml`
- `**/*-firebase-adminsdk-*.json` (Firebase service-account files)
- `android/app/google-services.json`

If a security-sensitive file ever appears in the public mirror, that is a
bug ΓÇö file a public issue or email the maintainer.