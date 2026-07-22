---
name: project-audit
description: "Produce a detailed summary of the entire project that illuminates gaps and suggests improvements. Use when: you want a full project health check; onboarding a new contributor; preparing for a milestone or release; identifying what to work on next; reviewing completeness against a roadmap or planning document. Modes: exhaustive (read every source file), docs-only (docs/READMEs only, no code), hard (deep code audit with grep for TODOs/FIXMEs/auth checks)."
argument-hint: "Optional: subsystem name ('android', 'web', 'security', ...) and/or mode flag ('--exhaustive', '--docs-only', '--hard')"
---

# Project Audit

Produces a structured, evidence-based report covering project status, gaps, and prioritized improvement suggestions.

## When to Use

- Preparing for a release or milestone review
- Onboarding a new contributor who needs the full picture
- Identifying the highest-value next tasks
- After a long feature push, to re-orient
- When CONTEXT/ROADMAP docs feel stale

---

## Mode Selection

Parse the argument string before starting. Set one depth mode and optionally one focus filter.

### Depth Modes

| Mode flag | What changes |
|-----------|-------------|
| *(none)* | **Standard** — spot-check 2–4 key files per subsystem; structural signals only |
| `--exhaustive` | **Exhaustive** — read every source file; enumerate all functions, types, routes, DB migrations, Edge Functions, test files |
| `--docs-only` | **Docs-only** — skip all source code; read only `*.md`, `*.txt`, `*.toml`, config root files; report purely on documentation completeness/currency |
| `--hard` | **Hard audit** — run grep searches for `TODO`, `FIXME`, `HACK`, `XXX`, `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `unsafe`, hardcoded secrets patterns (`sk_`, `anon`, `service_role`, bare URLs in source); read every auth-gated route and DB function; enumerate RLS policies in migrations; flag every missing `auth.uid()` check |

Modes are mutually exclusive. If none is provided, use Standard.

### Focus Filter

If a subsystem name is provided (e.g. `android`, `web`, `security`, `testing`, `scripts`, `supabase`), restrict Phase 3 to that subsystem only. All other phases still run.

---

## Procedure

Work through these phases sequentially. Each feeds the next.

### Phase 1 — Read the Map

Load all top-level orientation documents **in order**:

1. `CONTEXT.md` or `CLAUDE.md` / `AGENTS.md` (AI handoff file — most dense)
2. `README.md` (user-facing description)
3. `PLANNING.md` (design decisions, scope)
4. `ROADMAP.md` or `TASKS.md` (stage-by-stage task list with completion markers)
5. Any `docs/` folder entries (checklists, deployment guides, audit reports)

Extract from these:
- Stated MVP scope vs post-MVP
- Current completion percentage and open stages
- Known blockers, known issues, deferred decisions
- Any "investigate", "TODO", "not started", "⏳", "🔴", "🟡" markers

### Phase 2 — Auto-Discover Subsystems

**Do not assume a fixed subsystem list.** Instead:

1. List the root directory contents.
2. For each top-level folder, identify it as a subsystem if it contains **any** of: `package.json`, `build.gradle.kts`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `*.csproj`, `src/`, `lib/`, `functions/`, `migrations/`.
3. For each discovered subsystem, record:
   - Folder path
   - Primary language / framework (infer from build file or `src/` file extensions)
   - Entry points (e.g. `src/app/`, `src/index.ts`, `src/main/`)
   - Whether it has its own build system (`package.json`, `build.gradle.kts`, etc.)
   - Whether it has `TESTING.md`, `jest.config.*`, `*.test.*`, `*.spec.*`, or `__tests__/`
   - Whether it has a `README.md`

Do not skip folders that don't match expected names. Report what's actually there.

### Phase 3 — Audit Each Subsystem

Apply the selected depth mode to each subsystem (or the focused subsystem if a filter is set).

#### Standard mode (default)

For each subsystem:

| Signal | How to check |
|--------|--------------|
| Test coverage | Look for `coverage/` folder, `jest.config`, `*.test.ts`, `*.spec.kt` files |
| CI/CD | Read `.github/workflows/` — are all subsystems covered? |
| Linting / types | Check for `eslint.config`, `tsconfig.json`, strict mode |
| Documentation | Is there a `README.md`? Is it current? Does it match code? |
| Security | Are secrets in env vars? Are RLS policies present? Is input validated? |
| Completeness | Cross-reference code against ROADMAP task markers |

Spot-check 2–4 key files. Look for structural signals:
- Are TODOs or FIXMEs present?
- Are error paths handled?
- Are auth checks present on sensitive routes/functions?
- Are tests testing real behavior or just type-checking?

#### Exhaustive mode (`--exhaustive`)

For each subsystem:
1. **List every file** in `src/`, `lib/`, `functions/`, `migrations/`, `app/src/`.
2. Read **every file** — not just key files.
3. For each file, record:
   - Exported functions / classes / types
   - All route definitions (for web/API layers)
   - All DB migrations (for supabase/backend)
   - All test files and what they cover
   - Any unresolved TODOs, commented-out code, or placeholder implementations
4. Build a complete inventory: routes, functions, migrations, tests — list each one.
5. Cross-reference the inventory against ROADMAP claimed completions line by line.

#### Docs-only mode (`--docs-only`)

Skip all `.ts`, `.tsx`, `.kt`, `.js`, `.sql` source files entirely.

For each subsystem and root folder:
1. Read every `*.md` and `*.txt` file.
2. Read `package.json`, `build.gradle.kts`, config root files for metadata only (version, dependencies).
3. Report:
   - Which subsystems have README; which don't.
   - Whether docs reference real file paths (spot-check 3 references per doc).
   - Whether ROADMAP task markers match the last-updated dates in docs.
   - Stale claims: docs that say "complete" but are dated significantly before the current date.
   - Missing docs: subsystems with code but no README or TESTING.md.

#### Hard audit mode (`--hard`)

Run the following grep searches across the entire codebase, then read every matched file:

```
Search targets (run each separately and list all hits):
1.  TODO|FIXME|HACK|XXX                          → in all source files
2.  @ts-ignore|@ts-expect-error                  → TypeScript suppressions
3.  eslint-disable                               → lint suppressions
4.  \bunsafe\b                                   → unsafe Kotlin/Rust/etc.
5.  hardcoded secret patterns:
    (sk_live|sk_test|anon|service_role|eyJ)      → in source (not .env.example)
    password\s*=\s*['"][^'"]+['"]                → hardcoded passwords
    (http|https):\/\/[a-z0-9.-]+\.[a-z]{2,}     → hardcoded URLs in source (not test fixtures)
6.  auth\.uid\(\)|getUser\(\)|userId             → collect all auth check call sites
```

Then for each auth-sensitive path:
- Every Supabase Edge Function: does it call `supabase.auth.getUser()` before accessing data?
- Every Next.js API route or server action: does it check session before mutating?
- Every DB migration: does every table have a `SELECT` RLS policy restricted by `auth.uid()`?
- Every Android API call: does it pass a valid Bearer token?

List every function/route/table that does NOT have an auth check as a **Security gap**.

### Phase 4 — Cross-Reference Tasks vs Reality

For every stage marked `✅ Done` in the ROADMAP:
- In **Standard** mode: spot-check at least one claimed deliverable against actual code.
- In **Exhaustive** or **Hard** mode: verify every claimed deliverable.
- Flag any mismatches as "marked done but implementation not found".

For every stage marked `⏳ In Progress` or `[ ]`:
- List the specific open tasks with their task IDs.
- Note any dependencies or blockers from Phase 1.

### Phase 5 — Synthesize and Report

Produce the report in this exact structure:

---

## Audit Report: [Project Name]

**Date:** [today's date]
**Auditor:** GitHub Copilot
**Mode:** [Standard | Exhaustive | Docs-only | Hard]
**Focus:** [All subsystems | specific subsystem name]

### Subsystems Discovered

List each subsystem found in Phase 2 with its language/framework and whether it has tests and docs.

| Subsystem | Path | Framework | Tests? | Docs? |
|-----------|------|-----------|--------|-------|
| ...       | ...  | ...       | ✅/❌   | ✅/❌  |

### Executive Summary

2–4 sentences. Overall health, most critical gap, single most valuable next action.

### Subsystem Status

| Subsystem | Stated Status | Evidence | Gaps |
|-----------|--------------|----------|------|
| ...       | ✅/⏳/❌      | ...      | ...  |

### Strengths

3–6 bullet points. Each backed by a specific file or line of evidence.

### Gaps Found

**Features** — planned but not implemented, or partially implemented
- [ ] [task ID if available] — description — evidence

**Testing** — missing coverage, untested flows, coverage below threshold
- [ ] ...

**Documentation** — missing READMEs, stale docs, undocumented APIs, broken file references
- [ ] ...

**Security** — RLS gaps, unvalidated inputs, exposed secrets, missing auth checks *(populated by hard audit; may be empty in other modes)*
- [ ] ...

**Infrastructure** — CI not covering all platforms, missing alerts, storage/cost risks
- [ ] ...

### Suggested Improvements

Rank by impact × effort. Each item must name a specific file, function, or task.

**Immediate (do before next release)**
1. ...

**Short-Term (next 1–2 weeks)**
1. ...

**Long-Term (post-launch)**
1. ...

### Open Questions

Things that could not be resolved from code alone and need human judgment:
- ...

---

*(In Exhaustive mode, append a full inventory section after the report:)*

## Inventory (Exhaustive mode only)

### Routes
List all HTTP routes / page paths found.

### Edge Functions / API Handlers
List each function name, file path, and whether it has an auth check.

### DB Migrations
List each migration file and tables/policies it creates.

### Test Files
List each test file and describe what it covers (1 sentence each).

---

## Quality Criteria

The report is done when:
- [ ] Subsystems were discovered dynamically, not assumed
- [ ] Every open ROADMAP stage has its tasks listed
- [ ] At least one concrete gap is identified per subsystem
- [ ] Every "Immediate" suggestion names a specific file or action
- [ ] No gap is listed without evidence from code or docs
- [ ] Strengths are backed by evidence, not assumptions
- [ ] In Hard mode: every auth-sensitive surface has been checked and result recorded
- [ ] In Exhaustive mode: inventory section is present and complete
- [ ] In Docs-only mode: every subsystem's documentation presence/absence is declared
