# RULES.md — Roam Repository

> **Read this before writing any code, commit, or PR.**
> These rules are enforced by CI (`scripts/check-rules.mjs` + `.github/workflows/rules-check.yml`).
> Violating a **Hard Rule** will fail the PR; violating a **Process Rule** will fail review.

This file is the master ruleset. Platform-specific rules live in:
- `web/RULES.md`
- `extension/RULES.md`
- `supabase/RULES.md`
- `android/RULES.md`

These rule files are project conventions for human contributors. The same file is read by a number of third-party developer tools, which is why the format is short, declarative, and cross-referenced.

---

## 1. Hard Rules (CI-enforced, non-negotiable)

### 1.1 No `[deploy]` in commit messages
Commit-message-driven deploys have caused **multiple production incidents** in this repo's history. The trigger in `.github/workflows/deploy.yml` has been removed; any commit message containing `[deploy]` will be rejected at PR time.

**How to deploy:**
1. Push your branch and open a PR.
2. After CI passes, request review and merge to `main`.
3. Go to Actions → "Deploy Supabase Migrations & Functions" → **Run workflow** (this is `workflow_dispatch`-only, behind the `production` GitHub Environment with required reviewers).

**Forbidden tags:** `[deploy]`, `[ship]`, `[prod]`, `[release]`.

### 1.2 No references to automated tooling authorship in this repo
**No file in this repo may reference automated tooling that produced it, attribution comments, or hints at how the work was produced.** This includes:
- Commit messages (`fix: handle edge case [generated]`, `AI: improve`, etc. — no)
- Code comments (`// AI-generated`, `// prompted by`, etc. — no)
- Documentation (no "this README was written by …" notes, no RULES.md path names in visible docs)
- Pull request descriptions
- Inline attribution comments

**Why:** The public mirror (synced via `sync-public.ps1`) must not contain anything that hints at automated authorship. This is enforced by `scripts/check-rules.mjs`.

**Allowed neutral wording:** "this commit", "automated test", "script", "tooling".

### 1.3 No hardcoded secrets
- Never commit `.env`, `.env.local`, `*-firebase-adminsdk-*.json`, `*.jks`, or any file containing API keys.
- All secrets are loaded from env vars (see `.env.example` files at `web/`, `extension/`, `android/`, and root).
- `sync-public.ps1` filters internal files from the public mirror — verify your changes are not on the exclusion list by mistake.

**Enforced prefixes to grep for:** `AIza`, `sk-`, `sntryu_`, `sbp_`, `sb_secret_`, `sb_publishable_`, `re_`, `KGAT_`.

### 1.4 Migrations must be reversible
- Every migration in `supabase/migrations/` must be additive OR provide a documented rollback in `RUNBOOK.md`.
- `.skip` migrations are **forbidden in the active directory**. Move superseded migrations to `supabase/migrations/_superseded/` and add a one-line entry to `supabase/migrations/_superseded/SUPERSEDED.md` explaining why.
- New migrations MUST be tested with `supabase db reset` locally before push.

### 1.5 All env vars must be documented
Adding a new env var? You must also update the relevant `.env.example` file **in the same PR**. CI will fail otherwise.

### 1.6 SQL function changes must be tested under the `authenticated` role
PL/pgSQL functions created via Supabase migrations run under the `authenticated` role with `statement_timeout=8s` for normal users. Verification harnesses MUST:
- Connect as `authenticated` (not `service_role` or admin).
- Use the real `statement_timeout`.
- Run against a realistic dataset size (not just 5 rows).

## 2. Process Rules

### 2.1 Branch and PR
- One feature/fix per branch.
- Branch name: `feature/<kebab>`, `fix/<kebab>`, or `audit/<kebab>`. No `main` work.
- PR description must use `.github/pull_request_template.md` and link a tracked task in `docs/ROADMAP.md` (or a GitHub issue).
- Squash-merge; commit message on `main` follows Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`).

### 2.2 Local CI before push
Run, in order, before `git push`:
```bash
node scripts/check-rules.mjs              # catches forbidden patterns
node scripts/validate-env.mjs              # env validation
pnpm install --frozen-lockfile             # at root, web, extension
(cd web && pnpm lint && pnpm tsc --noEmit && pnpm test:ci)
(cd extension && pnpm build && pnpm test)
(cd android && ./gradlew test)
# For SQL changes:
supabase db reset && node scripts/verify-roam-rpc.mjs
```

### 2.3 Tests are required for behavior changes
- New edge function → add Deno tests in `supabase/functions/_tests/`.
- New React component → add Jest test in `web/src/__tests__/`.
- New SQL function → add a verification script or extension to `verify-roam-rpc.mjs`.
- "Just refactoring" is fine without tests **if** the diff is purely mechanical (rename, extract).

### 2.4 Documentation is part of the change
- New env var → `.env.example` update.
- New edge function → `docs/API.md` entry.
- New SQL table or column → `docs/API.md` and a migration comment block describing intent.
- Incident → `RUNBOOK.md` entry.
- Resolved audit item → close the checkbox in `docs/WEB_AUDIT_REPORT.md`.

### 2.5 No silent error swallowing
- `catch {}` empty catches must be commented: `catch { /* Supabase unavailable; fall back to fallback categories */ }`. Or replaced with a Sentry capture + user-visible message.
- Do not use `Promise<void>` returned from `supabase.from(...).insert(...)` without `await` — the prior audit found an entire function's worth of these in `save-url` and had to be rewritten.

### 2.6 Type safety
- TypeScript throughout (`web/`, `extension/`).
- Supabase types generated from schema: `supabase gen types typescript --linked > web/src/lib/supabase/database.types.ts`. Regenerate when migrations land.
- No `as any`. Use `as unknown as T` if you must cast, with a comment explaining why.
- Deno edge functions: `deno check supabase/functions/**/*.ts` must pass.

---

## 3. Code patterns (do this, not that)

### 3.1 URL normalization lives in one place
The `normalizeUrl(raw: string): string | null` function exists in three places that must be kept in sync:
- `extension/src/background/background.ts`
- `supabase/functions/_shared/normalise.ts`
- `scripts/lib/seed.js`

Add new tracking params to all three. Add a unit test in `supabase/functions/_tests/normalise.test.ts` for new cases.

### 3.2 Env validation lives in one schema
`web/src/lib/env.ts`, `extension/src/lib/env.ts`, `supabase/functions/_shared/env.ts`, `android/app/.../util/Env.kt`, `scripts/validate-env.mjs` all must agree on what vars exist and what their constraints are. **Add new vars to all five in the same PR.**

### 3.3 Prefer database-side logic for hot paths
The `roam()` function lives in Postgres because pushing ranking, filtering, and serendipity into the database is faster than round-tripping candidates. New ranking logic goes in SQL, not in app code, unless the SQL can't express it.

### 3.4 Prefer triggers for state derived from primary actions

## 4. Forbidden patterns

These are checked by `scripts/check-rules.mjs`:

| Pattern | Why |
|---|---|
| `as any` | Bypasses type safety; use `as unknown as T` with comment |
| `console.log` in `web/src/lib/`, `extension/src/lib/`, `supabase/functions/` | Use the shared logger or Sentry |
| `// TODO` without an issue link | TODOs rot; require traceability |
| `try { ... } catch {}` without a comment | Silent failure hides bugs |
| `Promise<void>` returned from Supabase writes without `await` | Fire-and-forget lost on SW termination |
| New SQL migration with `array_agg(u.*)` | Re-introduces v31 42P01 bug |
| `.skip` migration in active `supabase/migrations/` | Use `_superseded/` instead |
| New file in `web/src/components/` whose name exists in `web/src/app/<route>/` | Duplicate-`FollowButton` pattern |
| `proxy.ts` anywhere in `web/src/` | Should be `middleware.ts` |
| `contains(fromJSON([...]))` in an `if:` predicate in any `.github/workflows/*.yml` | `contains()` does element matching on arrays, not glob matching — use `dorny/paths-filter` (Hard Rule 1.6½) |
| Attribution of automated authorship in any committed file | Violates Hard Rule 1.2 |

Each rule can be locally waived with an allowlist file (`scripts/.rules-allowlist`). Use sparingly.

---

## 5. Test requirements

| Change type | Required test |
|---|---|
| New edge function | `supabase/functions/_tests/<name>.test.ts` |
| Modified edge function | Add cases to existing test |
| New SQL function | `verify-roam-rpc.mjs` extension or new `verify-<name>.mjs` |
| New React component | `web/src/__tests__/<name>.test.tsx` |
| New RLS policy | Integration test in `web/src/__tests__/security.test.ts` |
| New manifest permission | Document why in `extension/RULES.md` and add test in `extension/src/__tests__/` |
| Bug fix | Add a regression test that fails without the fix |

Coverage floor: maintain ≥30% on the existing tracked suites; aim for 50%.

---

## 6. Deploy rules

**Workflow file:** `.github/workflows/deploy.yml` (read-only for non-admins).

1. Only `workflow_dispatch` triggers deploys.
2. Deploys require the `production` GitHub Environment with reviewers.
3. The deploy job runs a pre-deploy gate: `deno check`, `supabase db reset`, `verify-roam-rpc.mjs` under `authenticated` role with 8s timeout.
4. Deploy job has `concurrency: { group: deploy-supabase, cancel-in-progress: false }`.
5. Each edge function deploy uses `paths-filter` to skip unchanged functions.
6. Post-deploy verification: `verify-roam` job polls `roam-health-check` until green.
7. Every other workflow (`ci.yml`, `rules-check.yml`, `health-check.yml`, etc.) **must** use `concurrency.cancel-in-progress: true` keyed off the branch ref or PR number. Without it, an amended commit or `git push --force` starts a fresh runner for every superseded commit and exhausts the free-tier Actions budget.

**You do NOT need to do anything special to deploy.** Merge to `main`, then ask an admin to dispatch the workflow.

---

## 7. Env / secrets rules

- All env vars documented in the relevant `.env.example` file.
- Production secrets are managed in Vercel + Supabase dashboards (see `docs/SECRETS_AUDIT.md`).
- Local secrets are loaded from `.env` (root), `web/.env.local`, `android/local.properties`.
- Never paste secrets in issues, PRs, commit messages, or chat.
- Rotation procedure: see `docs/SECRETS_AUDIT.md` § "Rotation checklist".

---

## 8. Self-check before commit

Run this mental checklist before `git commit`:

- [ ] No `[deploy]`, no automated-authorship references, no hardcoded secrets in the diff
- [ ] No new `.skip` files in `supabase/migrations/` (use `_superseded/`)
- [ ] New env vars are documented in `.env.example` files
- [ ] Tests added for behavior changes
- [ ] `pnpm test:ci` passes locally
- [ ] For SQL changes: `supabase db reset` + `verify-roam-rpc.mjs` under `authenticated`
- [ ] For migration that adds triggers: rollback documented in `RUNBOOK.md`
- [ ] For new permission/manifest change: documented in `extension/RULES.md`
- [ ] For new edge function writing to `user_actions`: replaced with a trigger
- [ ] For components: no name clash between `components/` and `app/<route>/`
- [ ] PR description uses `.github/pull_request_template.md`
- [ ] Linked task in `docs/ROADMAP.md` (or GitHub issue)

If any checkbox fails, fix before committing.

---

## What this file is NOT

- It is not documentation for users. Users read `README.md`.
- It is not a substitute for code review. Reviewers still apply judgment.
- It is not immutable. To change a Hard Rule, open a PR with rationale, get two approvals, and update this file in the same PR.

- `user_actions` rows are written by triggers, not by edge functions.
- `user_interest_scores.calibrated_weight` is updated by a trigger on ratings.
- `seen_urls.serve_count` is bumped by a trigger on inserts.

If you find yourself writing `await supabase.from('user_actions').insert(...)` in an edge function, **stop** and write a trigger.

### 3.5 Prefer server-side authorization, client-side as defense-in-depth
The `middleware.ts` redirects are UX, not security. The actual security boundary is RLS. Tests must exercise the RLS layer with a real JWT.

### 3.6 Manifest V3 service workers
- Event-driven only. No background loops.
- One persistent client per SW activation; re-create on cold start.
- `chrome.storage.session` for ephemeral state; `chrome.storage.local` for persistent.
- `chrome.runtime.onInstalled` and `chrome.runtime.onStartup` for initialization.


This rule exists because of the August 2026 outage where `roam()` "passed" verification under `service_role` (2-minute timeout) but timed out for every user.

### 1.6½ Workflow path-filter predicates must use `dorny/paths-filter`, not `contains(fromJSON([...]))`

The GitHub Actions `contains()` helper does **element** matching on arrays, not glob matching. So
```yaml
if: contains(fromJSON('["supabase/functions/**"]'), '**')
```
is **always false** (no element of the array equals the literal `'**'`), and the step is silently skipped on every PR. The opposite version (`'*'`) is always true and the step runs unconditionally. Both forms hide bugs.

**Use `dorny/paths-filter` instead.** It does real glob matching against the changed-files list and exposes the result as a step output.

```yaml
- name: Detect changes in edge function source
  id: edge
  uses: dorny/paths-filter@<commit-sha>
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    filters: |
      edge:
        - 'supabase/functions/**'

- name: Type-check Edge Functions
  if: steps.edge.outputs.edge == 'true'
  run: deno check supabase/functions/**/*.ts
```

This is enforced by the rules-check workflow on the resulting YAML; any `contains(fromJSON([...]))` predicate inside an `if:` is now caught by `check-rules.mjs` (R10, see below).

### 1.7 No duplicate component filenames
Naming a file in `web/src/components/` the same as one in `web/src/app/<route>/` is a CRIT-level footgun. The duplicate `FollowButton.tsx` was a silent bug for months. **Forbidden** — `check-rules.mjs` catches new duplicates.

### 1.8 `proxy.ts` does not exist
Next.js 16 reads `middleware.ts` (or `src/middleware.ts`). The historical `proxy.ts` was renamed to `middleware.ts`. If you need middleware behavior, add it to `web/src/middleware.ts`.

### 1.9 Edge functions must be server-authoritative for gamification
The `user_actions` table and any XP/badge/challenge state MUST be writable only from:
- Database triggers fired by primary actions (`save`, `rate`, `discover`), OR
- Service-role server-side handlers with rate limiting.

Edge functions must never insert arbitrary `action_type` values on behalf of a client. If you are tempted to add a new edge function that writes to `user_actions` directly, stop and design a trigger instead.

### 1.10 The Android release keystore is gitignored
`android/roam-release.jks` is `.gitignore`d. The `sync-public.ps1` script excludes `*-firebase-adminsdk-*.json`. **Do not commit, link to, or paste contents of either file in any tracked file.**