# Pull Request

## Summary

<!-- One or two sentences. What does this PR do, and why? -->

## Linked task

<!-- Required. Either a docs/ROADMAP.md entry or a GitHub issue number. -->
- `docs/ROADMAP.md` entry: <!-- e.g. "Stage 11, Hardening: WEB-AUDIT CRIT-2" -->
- or GitHub issue: #<!-- e.g. 123 -->

## Type of change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that changes existing behavior)
- [ ] Refactor (no functional change)
- [ ] Documentation only
- [ ] Migration / SQL change
- [ ] Edge function change

## Pre-merge checklist

Read the rulebook at the repo root first.

### Universal checks

- [ ] No `[deploy]`, `[ship]`, `[prod]`, or `[release]` tags in any commit message
- [ ] No hints at automated authorship in any committed file (comments, doc, commit message)
- [ ] No hardcoded secrets (checked against the ┬º 1.3 prefixes in the rulebook)
- [ ] No `.skip` migrations added to `supabase/migrations/` (use `_superseded/` if applicable)
- [ ] No new duplicate filenames between `web/src/components/` and `web/src/app/<route>/`
- [ ] No `proxy.ts` reintroduced (use `middleware.ts`)

### Behavior-change checks

- [ ] New env var ΓåÆ `.env.example` updated in same PR (root, `web/`, `extension/`, or `android/` as applicable)
- [ ] New edge function ΓåÆ test added in `supabase/functions/_tests/`
- [ ] New React component ΓåÆ test added in `web/src/__tests__/`
- [ ] New SQL function or RPC ΓåÆ `scripts/verify-roam-rpc.mjs` extended or new verification script added
- [ ] Migration that adds a trigger ΓåÆ rollback documented in `RUNBOOK.md`
- [ ] New RLS policy ΓåÆ security test added in `web/src/__tests__/security.test.ts`
- [ ] New manifest permission ΓåÆ documented in the browser extension rule file's "Permissions table"

### Local CI loop (run before pushing)

```bash
node scripts/check-rules.mjs
node scripts/validate-env.mjs
pnpm install --frozen-lockfile
(cd web && pnpm lint && pnpm tsc --noEmit && pnpm test:ci)
(cd extension && pnpm build && pnpm test)
(cd android && ./gradlew test)
# If SQL change:
supabase db reset && node scripts/verify-roam-rpc.mjs
```

- [ ] All of the above pass locally

### Documentation

- [ ] New env var ΓåÆ `.env.example` updated
- [ ] New edge function ΓåÆ `docs/API.md` updated
- [ ] New SQL table/column ΓåÆ migration comment block describes intent
- [ ] Resolved audit item ΓåÆ checkbox ticked in `docs/WEB_AUDIT_REPORT.md`

## How to verify

<!-- What should the reviewer do to verify this change? -->

## Screenshots / recordings

<!-- If UI change, attach before/after. -->

## Risks

<!-- What could go wrong? Mitigations? -->