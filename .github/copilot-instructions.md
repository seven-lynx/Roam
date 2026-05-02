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
| Android app | `android/` | **NOT MVP** — do not touch unless explicitly asked |

**Routes (web):** `/` landing, `/join` onboarding, `/u/[username]` profile, `/c/[slug]` collections, `/admin` moderation.

**Extension entrypoints:** `popup.ts` (UI), `background.ts` (service worker), `lib/queue.ts` + `lib/queueManager.ts` (URL prefetch queue).

**Supabase Edge Functions:** `roam` (discovery), `rate` (voting), `submit-url` (submissions), `log-failed-urls` (moderation).

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
3. **Update ROADMAP.md tallies** any time a task is marked complete or a new task is added. The tallies appear in four places — all must be kept in sync:
   - **Nav table** (top of file): `Tasks` column per stage (e.g. `16/36`)
   - **Stages by Status** section: done/total count per stage
   - **Project Progress table**: per-category counts and the overall `X / Y tasks (Z%)` headline
   - **Executive Summary**: bullet points describing completion state and remaining task counts

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
4. Commit with a clear message (no AI references in commit messages).
4. After every `git push`, verify CI passed:
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
- Never take breaking changes without warning and approval.
- Never go down a research rabbit hole — read the docs first, then implement.
- If unsure, ask. Do not guess and vamp.
- Check git status before major refactors to avoid clobbering in-progress work.

---

## Key Docs

| File | Purpose |
|---|---|
| `CONTEXT.md` | Full current-state briefing, blockers, decisions |
| `ROADMAP.md` | Task history and upcoming work |
| `supabase/README.md` | DB schema, table descriptions |
| `supabase/API.md` | Edge Function RPC contracts |
| `extension/TESTING.md` | Manual extension testing guide |
| `web/TESTING.md` | Web app testing guide |
| `scripts/README.md` | Seeder overview and usage |
