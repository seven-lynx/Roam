# Security Policy

## Reporting a vulnerability

**Please do not file a public GitHub issue for security bugs.**

Send vulnerability reports by email to `developer@roamtheweb.app`. For
sensitive details, request the maintainer's PGP key by email first and
encrypt your report with it.

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
  at the repo root (§ 1.3); the full rotation checklist lives in the internal
  (local-only) secrets audit.
- **Row-Level Security on every table.** RLS is the security boundary;
  middleware redirects are UX, not enforcement. See the Supabase backend
  rule file for details.
- **Service-role keys never reach the client.** The extension build
  refuses to bundle `SUPABASE_SERVICE_ROLE_KEY`. See the browser
  extension rule file (§ E.1).
- **Trivy + TruffleHog run on every PR.** See
  `.github/workflows/ci.yml`.

## Public repo hygiene

Roam is a single public repository — there is no separate private repo.
Internal-only files (audit reports, offline seeder scripts, AI/agent notes,
and secrets) are kept out of git via `.gitignore`:

- `docs/` (internal design docs, incident retros) — except the public
  reference docs that are explicitly allowlisted
- `scripts/` (seeder scripts, offline tooling) — except the CI
  rule-enforcement scripts that are explicitly allowlisted
- `.roam-local/`, `.github/skills/`, `.github/copilot-instructions.md`,
  `CLAUDE.md`, `web/CLAUDE.md`
- `**/*-firebase-adminsdk-*.json` (Firebase service-account files)
- `android/app/google-services.json`, `android/roam-release.jks`

If a security-sensitive file ever appears in the public repository, that is
a bug — file a public issue or email the maintainer.