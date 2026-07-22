# Roam — CLAUDE.md

Roam is a nostalgia-driven web discovery platform (spiritual successor to StumbleUpon). Users click Roam → get a random, interest-matched URL from a curated pool. No algorithmic engagement bait.

Before any significant task, read `docs/CONTEXT.md` for current state and blockers.

---

## Architecture

| Surface | Location | Stack |
|---------|----------|-------|
| Web app | `web/` | Next.js 16 + React 19 + Tailwind + Supabase JS |
| Browser extension | `extension/` | TypeScript + esbuild + Chrome/Firefox APIs + Supabase JS |
| Seeders | `scripts/` | Node.js — fetch data from public APIs, upsert to DB |
| Backend | `supabase/` | PostgreSQL, Edge Functions (Deno/TypeScript), Google OAuth |
| Android app | `android/` | Kotlin + Jetpack Compose |

**Web routes:** `/` landing, `/join` onboarding, `/signup` alternative sign-up, `/u/[username]` profile, `/collections/[slug]` collection detail, `/collections` browse all, `/leaderboard` XP rankings, `/badges` badge gallery, `/submit`, `/admin`, `/profile`, `/settings`, `/privacy`, `/terms`, `/how-it-works`, `/android-beta`, `/forgot-password`, `/auth/callback`, `/auth/verify-email`, `/auth/reset-password`, `/api/unsubscribe`.

**Edge Functions:** `roam`, `rate`, `submit-url`, `profile`, `collection`, `follow`, `save-url`, `share-url`, `leaderboard`, `feedback`, `report-url`, `log-failed-urls`, `export-user`, `delete-user`, `beta-signup`, `send-bulk-email`, `push-notify`.

---

## Common Tasks

All CLI commands assume the repo root as the working directory unless noted otherwise. Tokens are loaded from local config files — never echo or log them.

### Commit & Push

```powershell
# Refresh PATH so gh and pnpm are available
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")

# Stage, commit, push
git add -A
git commit -m "Concise description of change"  # No AI/Copilot/Cline references ever
git push

# Verify CI passed
gh run list --limit 2
# If CI shows X (failure), get the log:
$id = (gh run list --limit 1 --json databaseId --jq '.[0].databaseId')
gh run view $id --log-failed 2>&1 | Select-Object -Last 40
```

### Check Sentry Errors

```powershell
$token = (Get-Content android\local.properties | Select-String 'SENTRY_AUTH_TOKEN=(.+)').Matches[0].Groups[1].Value

# List unresolved issues (REST API — richer output)
Invoke-RestMethod `
  -Uri "https://us.sentry.io/api/0/projects/<ORG_SLUG>/<PROJECT_SLUG>/issues/?query=is:unresolved&limit=25" `
  -Headers @{ Authorization = "Bearer $token" } |
  Select-Object id,title,count,status | Format-Table

# Or via CLI (faster overview)
$sentry = "$env:USERPROFILE\AppData\Roaming\npm\sentry-cli.cmd"
& $sentry --auth-token $token issues list --org <ORG_SLUG> --project <PROJECT_SLUG>

# Resolve an issue
Invoke-RestMethod `
  -Uri "https://us.sentry.io/api/0/issues/<ISSUE_ID>/" `
  -Method PUT -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $token" } `
  -Body '{"status":"resolved"}'

# Fetch event details for debugging (use regex, NOT ConvertFrom-Json)
$r = Invoke-WebRequest "https://us.sentry.io/api/0/issues/<NUMERIC_ID>/events/latest/" -Headers @{Authorization="Bearer $token"} -UseBasicParsing
$r.Content | Out-File "$env:TEMP\sentry_event.json" -Encoding utf8
$raw = Get-Content "$env:TEMP\sentry_event.json" -Raw
[regex]::Matches($raw, '"type"\s*:\s*"([^"]+)"') | Select-Object -First 3 | ForEach-Object { "Type: $($_.Groups[1].Value)" }
[regex]::Matches($raw, '"value"\s*:\s*"([^"]{1,300})"') | Select-Object -First 3 | ForEach-Object { "Message: $($_.Groups[1].Value)" }
[regex]::Matches($raw, '"function"\s*:\s*"([^"]+)"') | Select-Object -Last 10 | ForEach-Object { "  $($_.Groups[1].Value)" }
```

See `.github/skills/sentry-fetch-issues/SKILL.md` and `.github/skills/sentry-cli/SKILL.md` for full reference.

### Supabase — Push Migrations & Deploy Functions

```powershell
$supabase = "$env:USERPROFILE\scoop\shims\supabase.exe"
$repo = (Get-Location).Path

# Push all pending migrations to remote
& $supabase db push --workdir $repo --yes

# Deploy a single Edge Function
& $supabase functions deploy <function-name> --project-ref <PROJECT_REF> --workdir $repo

# Create a new migration
& $supabase migration new <name> --workdir $repo
```

The project ref is in `supabase/config.toml`. See `.github/skills/supabase-cli/SKILL.md` for local dev workflow.

### Vercel — Logs & Deployments

```powershell
$vercel = "$env:USERPROFILE\AppData\Roaming\npm\vercel.cmd"
$env:VERCEL_TOKEN = (Get-Content web\.env.local | Select-String 'VERCEL_TOKEN=(.+)').Matches[0].Groups[1].Value

# Tail live runtime logs
& $vercel logs --token $env:VERCEL_TOKEN --follow <PROJECT_NAME>

# List recent deployments
& $vercel ls --token $env:VERCEL_TOKEN <PROJECT_NAME>
```

Production deploys happen automatically on `git push` to `main`. See `.github/skills/vercel-cli/SKILL.md`.

### Dead URL Checker

```powershell
# Dry-run (no DB changes)
$scriptPath = Join-Path (Get-Location) "scripts\run-dead-link-checker.ps1"
powershell -ExecutionPolicy Bypass -File $scriptPath --concurrency 50

# Write dead URLs to DB
powershell -ExecutionPolicy Bypass -File $scriptPath --concurrency 50 --commit

# Flush cached results without re-checking
powershell -ExecutionPolicy Bypass -File $scriptPath --concurrency 50 --commit-only
```

Progress auto-resumes from `scripts/.cache/dead-links-progress.json`. Commit progress tracked in `scripts/.cache/dead-links-commit-progress.json`.

### Run a Seeder

```powershell
# From scripts/
node seed-<name>.js                # normal run (uses cache)
node seed-<name>.js --no-cache     # bypass local cache, re-fetch from API
```

All seeders use `upsertUrls()` from `scripts/lib/seed.js`. Cache goes to `scripts/.cache/` (gitignored). Rate-limit all external API calls.

### Web App — Dev, Build, Test

```bash
# From web/
pnpm dev            # dev server
pnpm build          # production build
pnpm test           # jest --watch
pnpm test:ci        # jest --coverage --watchAll=false (run before marking done)
pnpm lint           # eslint
```

### Extension — Build & Test

```bash
# From extension/
pnpm build          # esbuild one-shot → dist/
pnpm build -- --firefox  # Firefox build → dist-firefox/
pnpm dev            # esbuild --watch
pnpm test           # vitest
```

Load `extension/dist/` in Chrome or `extension/dist-firefox/` in Firefox. See `extension/TESTING.md`.

---

## Conventions

### General
- Match patterns from nearby files before writing new code.
- No stubs. If you start something, finish it.
- Add comments only for non-obvious logic.
- **Never reference AI, Copilot, Cline, or automated tooling** in commit messages, PR descriptions, code comments, changelogs, or any user-facing or developer-facing docs. All output must read as human-authored.

### Web (Next.js 16)
- **Breaking changes from 14/15.** Check `node_modules/next/dist/docs/` for current APIs before writing Next.js code.
- Auth uses `@supabase/ssr` with cookie-based sessions. See `web/src/lib/` for the client pattern.
- Server Components are the default; use `'use client'` only when needed.
- Tests co-located in `__tests__/` with React Testing Library.

### Extension
- Typed messages only (`lib/messages.ts` — discriminated union). Never raw strings between popup and background.
- Prefetch cache lives in `chrome.storage.session`. Event-driven service worker architecture — no long-running background loops (MV3 terminates them after ~30s).
- URL validation: `AbortController` with 8-second timeout.
- Never manually edit `dist/` or `dist-firefox/`.

### Supabase / Edge Functions
- Deno runtime — use `import`, not `require`.
- All data access gated by RLS policies. Do not bypass in client code.
- Schema changes go in `supabase/migrations/` as numbered SQL files.
- RPC contracts in `docs/API.md`.

### Seeders
- Use `upsertUrls()` from `scripts/lib/seed.js` — do not bypass.
- Cache results in `scripts/.cache/` (gitignored) before upserting.
- Rate-limit all external API calls. Never hammer third-party APIs.

---

## Workflow

**Before starting:**
1. Read `docs/CONTEXT.md` for current state and blockers.
2. Check existing code and docs — don't rewrite what's already there.
3. Never remove functionality or change feature behavior without analysis + approval.

**After finishing:**
1. Summarize what was done in 2–3 sentences.
2. Update `docs/ROADMAP.md` or `docs/CONTEXT.md` as appropriate.
3. Commit with a clear, human-authored message. Run `pnpm test:ci` for web changes first.

**Hard rules:**
- No stubs or TODOs without explicit permission.
- No breaking changes without warning and approval.
- Read the docs first, then implement. Don't research-rabbit-hole.
- If unsure, ask. Don't guess.
- Check `git status` before major refactors.

---

## Key Docs

| File | Purpose |
|------|---------|
| `docs/CONTEXT.md` | Current-state briefing, blockers, decisions |
| `docs/ROADMAP.md` | Task history and upcoming work |
| `docs/API.md` | Edge Function RPC contracts |
| `supabase/README.md` | Backend schema, functions, and development guide |
| `extension/TESTING.md` | Manual extension testing guide |
| `web/README.md` | Web app route map and development guide |
| `COMMERCIAL_LICENSE.md` | Dual licensing terms |

---

## Licensing

Roam uses **dual licensing**: MIT for open source / personal use, Commercial for competing services or white-label. See `COMMERCIAL_LICENSE.md`. Don't add license headers to individual files — the project-level LICENSE covers all code.