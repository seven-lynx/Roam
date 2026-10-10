# RULES.md — Supabase Backend

Read `../RULES.md` first. This file adds backend-specific rules.

## Stack
- PostgreSQL (Supabase)
- Deno Edge Functions (TypeScript)
- Supabase CLI for migrations + deploys
- 164 migrations in `supabase/migrations/` (history of all schema changes)
- 27 edge functions in `supabase/functions/`

## Hard rules (backend-specific)

### S.1 `authenticated` role has `statement_timeout=8s`
This is non-obvious and load-bearing. Every PL/pgSQL function in the public schema must complete within 8s for a normal user, or users see `57014` errors. The verification harness (`scripts/verify-roam-rpc.mjs`) MUST connect as `authenticated` and respect the timeout. The admin/Management-API session has `statement_timeout=2min` — **do not verify with admin**.

### S.2 No `.skip` files in the active directory
If a migration needs to be skipped, move it to `supabase/migrations/_superseded/` and document why in `SUPERSEDED.md`. The active directory should only contain migrations that will be applied in timestamp order.

### S.3 Triggers, not edge functions, for derived state
Any state derived from a primary user action (`save`, `rate`, `discover`, `follow`, `submit`) must be updated by a **Postgres trigger**:
- `user_actions` rows are inserted by triggers
- `user_interest_scores.calibrated_weight` is updated by a trigger on ratings
- `seen_urls.serve_count` is bumped by a trigger

Edge functions may call RPCs that wrap these, but the canonical writer is the trigger.

### S.4 RLS is the security boundary
Middleware redirects are UX, not security. Every table accessible from the client must have an RLS policy. Every policy must be tested with a real JWT — see the test cases in `web/src/__tests__/security.test.ts`.

When you add a new table:
1. Add `ALTER TABLE x ENABLE ROW LEVEL SECURITY;`
2. Add policies for `anon`, `authenticated`, and `service_role`.
3. Add a test that calls the API as `anon` and as `authenticated` and asserts the right rows are visible.

### S.5 Migrations must be additive OR documented as reversible
Non-additive migrations (DROP, ALTER TYPE) must include a paired rollback in `RUNBOOK.md`. Pure additive migrations (CREATE TABLE, ADD COLUMN with default) are always safe to ship.

### S.6 Edge function error handling
- Wrap handlers in try/catch and return JSON errors with status codes.
- Use the `rateLimit()` helper from `_shared/rate-limit.ts` for any function callable by unauthenticated clients.
- Use the `initSentry()` helper from `_shared/sentry.ts` for error reporting.
- Never `console.log` in production functions — use Sentry capture.

### S.7 URL normalization is canonical in `_shared/normalise.ts`
The browser extension and seeders have copies of `normalizeUrl()`. The Deno version in `_shared/` is the canonical one. If you change tracking-param handling, update all three and add a test.

## Forbidden patterns (backend-specific)

- Writing to `user_actions` from an edge function (use a trigger)
- Empty `try { } catch { }` in edge functions
- `console.log` in production edge functions
- Migrations with `array_agg(u.*)` (the v31 42P01 bug — re-introduces alias ambiguity)
- New tables without RLS
- New edge functions without a paired `_tests/<name>.test.ts`
- `.skip` files in `supabase/migrations/` (use `_superseded/` instead)
- Hardcoded URLs (use `Deno.env.get('SUPABASE_URL')`)

## Migration safety checklist

Before adding a migration, answer:

- [ ] Is this additive (CREATE/INSERT) or non-additive (DROP/ALTER)?
- [ ] If non-additive, is there a rollback in `RUNBOOK.md`?
- [ ] Does it run within 8s under the `authenticated` role with realistic data?
- [ ] Does it add or modify triggers? If so, is the rollback safe under load?
- [ ] Does it change RLS policies? If so, is there a security test?
- [ ] Does it depend on a column that might not exist yet? (use `IF EXISTS` guards)