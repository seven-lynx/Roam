# Roam — Copilot Instructions

Roam is a nostalgia-driven web discovery platform (spiritual successor to StumbleUpon). Users click Roam → get a random, interest-matched URL from a curated pool. No algorithmic engagement bait.

For a full current-state briefing, read `CONTEXT.md` before starting any significant task.

---

## Architecture

Three surfaces, one Supabase backend:

| Layer | Location | Technology |
|---|---|---|
| Web app | `web/` | Next.js 16 + React 19 + Tailwind + Supabase JS |
| Browser extension | `extension/` | TypeScript + esbuild + Chrome/Firefox APIs + Supabase JS |
| Seeders | `scripts/` | Node.js — fetch data from public APIs, upsert to DB |
| Database + Auth | `supabase/` | PostgreSQL, Edge Functions (Deno/TypeScript), Google OAuth |
| Android app | `android/` | Kotlin + Jetpack Compose |

**Routes (web):** `/` landing, `/join` onboarding, `/u/[username]` profile, `/c/[slug]` collections, `/submit` URL submission, `/admin` moderation, `/profile` account, `/settings` preferences, `/privacy` and `/terms` legal, `/how-it-works` guide, `/beta` waitlist, `/forgot-password`.

**Extension entrypoints:** `popup.ts` (UI), `background.ts` (service worker), `lib/queue.ts` + `lib/queueManager.ts` (URL prefetch queue).

**Supabase Edge Functions:** `roam` (discovery), `rate` (voting), `submit-url` (submissions), `profile` (public profile), `collection` (CRUD), `follow` (social), `save-url` (saved links), `feedback` (reports), `report-url` (broken links), `log-failed-urls` (moderation), `export-user` (GDPR export), `delete-user` (GDPR deletion), `beta-signup` (waitlist), `send-bulk-email` (notifications).

**RPC Functions:** `roam()` (weighted-random discovery), `admin_url_stats()` (dashboard statistics).

---

## Build & Test

```bash
# Web app (from web/)
pnpm dev            # dev server
pnpm build          # production build
pnpm test           # jest --watch
pnpm test:ci        # jest --coverage --watchAll=false
pnpm lint           # eslint

# Extension (from extension/)
pnpm build          # esbuild one-shot → dist/
pnpm dev            # esbuild --watch

# Seeders (from scripts/)
node seed-<name>.js             # run seeder
node seed-<name>.js --no-cache  # bypass local cache

# Dead URL checker — PS1 requires ExecutionPolicy Bypass; always use full path:
$scriptPath = Join-Path (Get-Location) "scripts\run-dead-link-checker.ps1"
powershell -ExecutionPolicy Bypass -File $scriptPath --concurrency 50
# Add --commit to write changes to DB (default is dry-run)
# Use --commit-only to flush cached results without re-checking
# Commit progress tracked in scripts/.cache/dead-links-commit-progress.json (only new results committed)
# Auto-resumes from scripts/.cache/dead-links-progress.json on crash

# Supabase — always use the scoop binary with --workdir; npx/PATH don't work reliably
# Supabase CLI binary: $env:USERPROFILE\scoop\shims\supabase.exe
# Push migrations to remote:
$supabase = "$env:USERPROFILE\scoop\shims\supabase.exe"
$repo = (Get-Location).Path
& $supabase db push --workdir $repo --yes

# Deploy an Edge Function:
& $supabase functions deploy <name> --project-ref <PROJECT_REF> --workdir $repo
# Project ref is in supabase/config.toml — see supabase/README.md

# Vercel CLI — always use full path; not on PATH in VS Code terminal
# Vercel CLI binary: $env:USERPROFILE\AppData\Roaming\npm\vercel.cmd (v54.6.1)
$vercel = "$env:USERPROFILE\AppData\Roaming\npm\vercel.cmd"
$env:VERCEL_TOKEN = (Get-Content web\.env.local | Select-String 'VERCEL_TOKEN=(.+)').Matches[0].Groups[1].Value
& $vercel logs --token $env:VERCEL_TOKEN --follow <PROJECT_NAME>  # tail live logs
& $vercel ls --token $env:VERCEL_TOKEN <PROJECT_NAME>             # list deployments
# See .github/skills/vercel-cli/SKILL.md for full reference

# Sentry CLI — always use full path; not on PATH in VS Code terminal
# Sentry CLI binary: $env:USERPROFILE\AppData\Roaming\npm\sentry-cli.cmd (v3.4.3)
$sentry = "$env:USERPROFILE\AppData\Roaming\npm\sentry-cli.cmd"
$token = (Get-Content android\local.properties | Select-String 'SENTRY_AUTH_TOKEN=(.+)').Matches[0].Groups[1].Value
& $sentry --auth-token $token issues list --org <ORG_SLUG> --project <PROJECT_SLUG>
# See .github/skills/sentry-cli/SKILL.md for full reference
```

Load the unpacked extension from `extension/dist/` in Chrome, or `extension/dist-firefox/` in Firefox. See `extension/TESTING.md` for the full manual testing guide.

---

## Conventions

### General
- Match patterns from nearby files before writing new code.
- Prefer simple, clean, readable code. Elegant > Trendy.
- No stubs. If you start something, finish it.
- Add comments only for non-obvious logic.

### Web (Next.js)
- **This is Next.js 16 — it has breaking changes from 14/15.** Before writing any Next.js code, check `node_modules/next/dist/docs/` for current APIs. Heed deprecation notices. See `web/AGENTS.md`.
- Auth uses `@supabase/ssr` with cookie-based sessions. See `web/src/lib/` for the client setup pattern.
- Server Components are the default; use `'use client'` only when needed.
- Tests: co-located in `__tests__/` with React Testing Library. Run `pnpm test:ci` before marking a task done.

### Extension
- All cross-component communication uses typed messages (`lib/messages.ts` — discriminated union). Never pass raw strings between popup and background.
- Queue state lives in `chrome.storage.local` only. Never use in-memory state for queue persistence.
- URL validation uses `AbortController` with an 8-second timeout. Keep this consistent.
- Build output is in `dist/` (Chrome) and `dist-firefox/`. Do not manually edit dist files.

### Supabase / Edge Functions
- Edge Functions run on Deno. Use `import` syntax, not `require`.
- All user-facing data access is gated by RLS policies. Do not bypass RLS in client code.
- Schema changes go in `supabase/migrations/` as numbered SQL files. See `supabase/README.md` for the full schema.
- See `supabase/API.md` for RPC contracts.

### Seeders
- All seeders use `upsertUrls()` from `scripts/lib/seed.js` — do not bypass it.
- Seeders must cache results locally in `scripts/.cache/` (gitignored) before upserting.
- Rate-limit all external API calls. Never hammer third-party APIs.

---

## Workflow Rules

**Before starting any task:**
1. Read `CONTEXT.md` for current state and blockers.
2. Check existing code and docs before implementing anything new.
3. Never remove functionality or change how a feature works without analysis + approval.

**After completing any task:**
1. Summarize what was done in 2–3 sentences.
2. Add an entry to `ROADMAP.md` or `CONTEXT.md` as appropriate.
3. **Update ROADMAP.md tallies** any time a task is marked complete or a new task is added. The tallies appear in **four places** — all must be kept in sync. Use PowerShell `.Replace()` (not `replace_string_in_file`) because ROADMAP.md contains U+FFFD characters that break the tool:

   | Location | Example string to find & replace |
   |---|---|
   | **Nav table** — `Tasks` column of the stage row near top of file | `\| **[Stage 9(...)]** — Security Audit \| ⏳ In Progress \| 28/37 \| 60h \|` |
   | **Project Progress headline** — inside `## Project Progress` | `**Overall Completion: 213 / 301 tasks (71%)**` |
   | **Project Progress table row** — per-category row | `\| Security & Quality (Stage 9) \| 28 \| 37 \| 76% \|` |
   | **Stages by Status** — under `## Stages by Status` | `- Stage 9 (Security Audit): 28/37 tasks` |

   The nav table rows use full markdown links — do **not** assume plain text; copy the exact anchor text from the file.

   Recount by running:
   ```powershell
   $c=[IO.File]::ReadAllLines("ROADMAP.md"); $cur="other"; $d=@{}; $o=@{}
   foreach($l in $c){
     if($l -match '^## Stage (\d+)'){$cur="Stage $($Matches[1])"}
     if($l -match '^## Post-Launch'){$cur="PostLaunch"}
     if($l -match '^\- \[x\] \*\*'){if(!$d[$cur]){$d[$cur]=0};$d[$cur]++}
     elseif($l -match '^\- \[ \] \*\*'){if(!$o[$cur]){$o[$cur]=0};$o[$cur]++}
   }
   ($d.Keys+$o.Keys|Select-Object -Unique|Sort-Object)|%{$dd=$d[$_]??0;$oo=$o[$_]??0;"${_}: $dd/$($dd+$oo) (open=$oo)"}
   $td=0;foreach($v in $d.Values){$td+=$v};$to=0;foreach($v in $o.Values){$to+=$v}
   "TOTAL: $td / $($td+$to)"
   ```
4. Commit with a clear message. Never reference AI, Copilot, or automated tooling in commit messages, PR descriptions, code comments, or any user-facing or developer-facing docs.
5. After every `git push`, verify CI passed:
   ```powershell
   $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
   gh run list --limit 2
   ```
   If the CI run shows `X` (failure), immediately fetch the failure log and fix it before moving on:
   ```powershell
   $id = (gh run list --limit 1 --json databaseId --jq '.[0].databaseId')
   gh run view $id --log-failed 2>&1 | Select-Object -Last 40
   ```
   Note: `gh` and `pnpm` require a refreshed PATH in VS Code's integrated terminal — always prepend the PATH refresh line above before calling either tool.

**Hard rules:**
- Never create stubs or TODOs without explicit permission.
- Never reference AI, Copilot, or automated tooling anywhere in the codebase — not in comments, docs, commit messages, changelogs, or PR descriptions. All output must read as human-authored.
- Never take breaking changes without warning and approval.
- Never go down a research rabbit hole — read the docs first, then implement.
- If unsure, ask. Do not guess and vamp.
- Check git status before major refactors to avoid clobbering in-progress work.

---

## Vercel

Project deploys automatically on `git push` to `main`. For manual inspection or log access:

```powershell
$vercel = "$env:USERPROFILE\AppData\Roaming\npm\vercel.cmd"
$env:VERCEL_TOKEN = (Get-Content web\.env.local | Select-String 'VERCEL_TOKEN=(.+)').Matches[0].Groups[1].Value

# Tail live runtime logs
& $vercel logs --token $env:VERCEL_TOKEN --follow <PROJECT_NAME>

# List recent deployments
& $vercel ls --token $env:VERCEL_TOKEN <PROJECT_NAME>
```

See `.github/skills/vercel-cli/SKILL.md` for env var management and deployment inspection.

---

## Sentry

Auth token is in `android/local.properties` as `SENTRY_AUTH_TOKEN`. See `.github/skills/sentry-cli/SKILL.md` for org/project slugs.

**Via REST API (PowerShell — richer output):**

```powershell
$token = (Get-Content android\local.properties | Select-String 'SENTRY_AUTH_TOKEN=(.+)').Matches[0].Groups[1].Value

# List unresolved issues
Invoke-RestMethod `
  -Uri "https://us.sentry.io/api/0/projects/<ORG_SLUG>/<PROJECT_SLUG>/issues/?query=is:unresolved&limit=25" `
  -Headers @{ Authorization = "Bearer $token" } |
  Select-Object id,title,count,status | Format-Table

# Resolve an issue by ID
Invoke-RestMethod `
  -Uri "https://us.sentry.io/api/0/issues/<ISSUE_ID>/" `
  -Method PUT -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $token" } `
  -Body '{"status":"resolved"}'
```

**Via Sentry CLI** (`$env:USERPROFILE\AppData\Roaming\npm\sentry-cli.cmd`, v3.4.3):

```powershell
$sentry = "$env:USERPROFILE\AppData\Roaming\npm\sentry-cli.cmd"
$token = (Get-Content android\local.properties | Select-String 'SENTRY_AUTH_TOKEN=(.+)').Matches[0].Groups[1].Value
& $sentry --auth-token $token issues list --org <ORG_SLUG> --project <PROJECT_SLUG>
```

See `.github/skills/sentry-cli/SKILL.md` for release management and source map uploads.
See `.github/skills/sentry-fetch-issues/SKILL.md` for detailed event parsing.

---

## Licensing

Roam uses **dual licensing**:

| License | When to Use | Details |
|---|---|---|
| **MIT** | Open source, personal use, internal tools, forks that stay open | See [LICENSE](LICENSE) |
| **Commercial** | Competing service, white-label, closed-source modifications | See [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md) |

**Key Rule:** Anyone building commercial services with Roam (or reselling/white-labeling it) must obtain a commercial license. Contributors who open-source their work use MIT for free.

**For new code:**
- Don't add license headers to individual files — the project-level LICENSE file covers all code
- Never reference licensing in commits; just ship working code

---

## Key Docs

| File | Purpose |
|---|---|
| `CONTEXT.md` | Full current-state briefing, blockers, decisions |
| `ROADMAP.md` | Task history and upcoming work |
| `LICENSE` | Open source MIT License |
| `COMMERCIAL_LICENSE.md` | Commercial licensing terms and inquiry process |
| `supabase/README.md` | DB schema, table descriptions |
| `supabase/API.md` | Edge Function RPC contracts |
| `extension/TESTING.md` | Manual extension testing guide |
| `web/README.md` | Web app route map and development guide |
| `scripts/README.md` | Seeder overview and usage |
| `.github/skills/vercel-cli/SKILL.md` | Vercel CLI reference (logs, deployments, env vars) |
| `.github/skills/sentry-cli/SKILL.md` | Sentry CLI reference (releases, source maps) |
| `.github/skills/sentry-fetch-issues/SKILL.md` | Fetch and parse Sentry issues (REST API) |
| `.github/skills/supabase-cli/SKILL.md` | Supabase CLI reference (migrations, functions, local dev) |
