# Roam — Code-Level Audit Report

**Mode:** Full source-code examination (~40 files read + grep across all subsystems)  
**Auditor:** GitHub Copilot  
**ROADMAP baseline:** 255/343 tasks (74%) complete

---

## Subsystems Discovered

| Subsystem | Primary Language | Test Coverage | Sentry | Auth Guard |
|---|---|---|---|---|
| Web (Next.js 16) | TypeScript / React 19 | Jest + RTL (4 test files) | ✅ `@sentry/nextjs` | ✅ server-side `getUser()` |
| Browser Extension | TypeScript / MV3 | Vitest (setup only, no tests) | ✅ `@sentry/browser` | via Supabase session |
| Android App | Kotlin / Jetpack Compose | None in repo | ✅ Sentry Android | ViewModel auth state |
| Edge Functions | Deno / TypeScript | 4 Deno test files | ❌ (Sentry SDK not used) | per-function `getUser()` |
| PostgreSQL | SQL | None | n/a | SECURITY DEFINER + RLS |
| Scripts / Seeders | Node ESM | None | n/a | service role key via env |

---

## Executive Summary

Roam is a well-structured monorepo with strong foundations: server-side auth everywhere, RLS on all tables, a centralized logger, fail-fast env validation in most paths, and Sentry instrumentation across clients. The ROADMAP accuracy is high, but **three stale entries misrepresent completion state** — tasks 10.10 (T&C checkbox) and Stage 14 are done in code but marked open. The most consequential finding is a **PostgreSQL migration conflict** that leaves two `roam()` function overloads co-existing, with v11 improvements unreachable from most call paths. Raw `console.*` calls leak into production across multiple subsystems. The extension has a critical gap: **zero actual test files** despite a test setup scaffold. Security posture is good but not complete — CORS is still `*` wildcard after 36 migrations.

---

## Findings

### CRITICAL

---

**C1 — Migration conflict: two `roam()` function signatures co-exist**  
*Files:* `supabase/migrations/20260503000001_roam_return_category_id.sql` + `20260503000005_roam_v11_freshness_diversity_exploration.sql`

After migration `000001` (`roam_return_category_id`), the active SQL function has **5 parameters** `(p_user_id, p_collection_id, p_exclude_domain, p_subcategory_id, p_category_id)` and returns `category_id` in the result set. Migration `000005` (v11) then runs:

```sql
DROP FUNCTION IF EXISTS public.roam(UUID, UUID, TEXT, UUID) CASCADE;  -- 4-param: matches nothing
CREATE FUNCTION public.roam(p_user_id UUID, ... p_subcategory_id UUID DEFAULT NULL) ...
```

The DROP targets the 4-parameter signature — which no longer exists — so it is a **no-op**. A new 4-param version (with all v11 improvements) is created alongside the pre-existing 5-param version (without v11 improvements). PostgreSQL function overloading means:

- Calls that omit `p_category_id` are **ambiguous** between the two overloads and may throw `ERROR: function roam(...) is not unique` at runtime.
- Calls using named `p_category_id` resolve to the 5-param version, which **lacks freshness decay, exploration bonus, and domain cooldown**.
- The v11 4-param version's final `RETURN QUERY` omits `category_id` from the SELECT, so `roam/index.ts`'s `row.category_id ?? row.subcategory_id` fallback produces `null` for calls that do resolve through it.

**Fix:** See `supabase/migrations/20260503000007_roam_v12_merge_category_and_v11.sql`.

---

**C2 — CORS wildcard on all Edge Functions (task 9.34)**  
*File:* `supabase/functions/_shared/cors.ts`

```typescript
'Access-Control-Allow-Origin': '*'
```

All 11 Edge Functions share this header. Because functions validate user identity via Bearer token, the wildcard doesn't allow unauthorized data access. However, it defeats Origin-based CSRF protection and allows any site to make credentialed requests. Task 9.34 has been open since Stage 9 with no code change applied.

---

**C3 — `SUPABASE_SERVICE_ROLE_KEY` in Next.js server component with ISR caching**  
*File:* `web/src/app/admin/dashboard/page.tsx`

`getSupabaseStats()` creates a service-role Supabase admin client. The null check is present and the function gracefully returns `null` if the key is missing. The `export const revalidate = 300` ISR cache is server-side only — no risk of the key leaking to client bundles in the current setup. However, `import 'server-only'` is absent, leaving the module importable from client components without a build-time error.

---

### HIGH

---

**H1 — Extension has zero actual test files**  
*File:* `extension/src/__tests__/setup.ts` — only file in directory

`vitest.config.ts` declares `include: ['src/__tests__/**/*.test.ts']`. The `__tests__/` folder contains only `setup.ts` with a well-built Chrome API mock. Despite the ROADMAP listing Stage 11 testing tasks as 25/30 and Stage 13 as complete, there are **no extension unit tests** for `background.ts`, `popup.ts`, `messages.ts`, or `env.ts`. The web has 4 Jest test files; Supabase has 4 Deno test files; the extension has 0.

---

**H2 — `admin/page.tsx` uses a weaker admin role check than `proxy.ts`**  
*File:* `web/src/app/admin/page.tsx`

```typescript
// admin/page.tsx
if (!user || user.app_metadata?.role !== "admin") redirect("/");

// proxy.ts (hardened pattern)
const isAdmin =
  typeof user?.app_metadata === 'object' &&
  user.app_metadata !== null &&
  (user.app_metadata as Record<string, unknown>)?.role === 'admin';
```

Not exploitable in practice (Supabase ensures `app_metadata` is always an object), but the two checks are inconsistent. The middleware and the page should use the same pattern.

---

**H3 — Unsafe `any` casts in `background.ts`**  
*File:* `extension/src/background/background.ts`

```typescript
(session as any).expires_at          // session expiry — available as session.expires_at natively
(r: any) => r.category_id            // DB row in getUserCategories()
```

Two `any` casts bypass TypeScript's type safety. `expires_at` is a first-class property on the Supabase `Session` type — the cast is unnecessary. The row cast hides the actual schema returned by the user-categories query.

---

**H4 — Inconsistent env validation across four files**  
*Files:* `supabase/functions/roam/index.ts`, `proxy.ts`, `server.ts`, `submit-url/index.ts`

| File | Pattern |
|---|---|
| `roam/index.ts` | Module-level `Deno.env.get('SUPABASE_URL')!` |
| `proxy.ts` | `process.env.NEXT_PUBLIC_SUPABASE_URL!` |
| `server.ts` | `validateSupabaseEnv()` shared validator |
| `submit-url/index.ts` | `validateRequired([...])` throws on missing key |

`roam/index.ts` uses non-null assertions at module load. If `SUPABASE_URL` is unset, the function initializes with `undefined` and crashes on first request, which is harder to diagnose than `submit-url`'s startup throw.

---

**H5 — Raw `console.*` calls in production code**

| File | Lines | Calls |
|---|---|---|
| `extension/src/popup/popup.ts` | 186, 188, 394 | `console.log` (boot state, roam response) |
| `extension/src/callback/callback.ts` | 23–67 | 5× `console.log` debug traces |
| `web/src/app/admin/AdminPageClient.tsx` | 96 | `console.error` (not using `logger.ts`) |
| `web/src/components/ErrorBoundary.tsx` | 31 | `console.error` — **not wired to Sentry** |
| `supabase/functions/delete-user/index.ts` | 101, 112, 125 | 3× `console.error` |
| `supabase/functions/feedback/index.ts` | 115 | `console.error` |
| `supabase/functions/report-url/index.ts` | 90, 101 | 2× `console.error` |

`ErrorBoundary.tsx` is the most impactful: React render crashes go entirely unmonitored — `componentDidCatch` logs to console only.

---

### MEDIUM

---

**M1 — `category_id` stored as raw string in `reviewer_note`**  
*File:* `supabase/functions/submit-url/index.ts`

```typescript
reviewer_note: `category_hint:${categoryId}`
```

The `moderation_queue` table has no `category_id` column. The submitted category UUID is serialized into a text field with a custom prefix. `AdminPageClient.tsx` displays `reviewer_note` verbatim but does not parse the `category_hint:` prefix — so moderators see a raw string, not a category name. The submitted category context is effectively invisible in the moderation UI.

---

**M2 — `roam/index.ts` doesn't forward `subcategory_id`**  
*File:* `supabase/functions/roam/index.ts`

The Edge Function parses `category_id` and `collection_id` from the request body but not `subcategory_id`. The SQL RPC `p_subcategory_id` parameter (added in migration `20260501000008`) is never reached from web or extension call paths. The Android app sends `subcategory_id` per its REFERENCE.md, but the Edge Function silently drops it.

---

**M3 — Supabase Edge Functions have no Sentry integration**

Web, extension, and Android all capture exceptions to Sentry. All 11 Deno Edge Functions use only `console.error()` for error logging. If `roam()` hits an RPC timeout or `submit-url` fails its Safe Browsing call, there is no alert or error event.

---

**M4 — `integration.test.ts` tests a mock, not the functions**  
*File:* `supabase/functions/_tests/integration.test.ts`

The "integration" test file uses a hand-rolled `MockSupabaseClient` object. It never calls `Deno.serve` or sends HTTP requests to the actual Edge Function handlers. The tests verify the mock's behavior, not the functions.

---

**M5 — Admin page double-validates auth**  
*File:* `web/src/app/admin/page.tsx`

`admin/page.tsx` calls `supabase.auth.getUser()` independently, even though `proxy.ts` already ran `getUser()` and redirected unauthorized users for this same request — two JWT verifications per admin page load.

---

### LOW / INFORMATIONAL

---

**L1 — ROADMAP has 3 confirmed stale entries**

| ROADMAP claim | Code reality |
|---|---|
| Task 10.10 (T&C checkbox) — "not started" | `agreedToTerms` state + checkbox fully implemented in `join-content.tsx`; enforced in `createFormValid` |
| Stage 14 quick-nav — "0/11 complete" | All 14.x tasks confirmed in `MainViewModel.kt` (offline queue, dark mode, auto-translate, etc.) |
| Task 11.23 (admin analytics) — LOW priority, open | `AdminPageClient.tsx` has full `AnalyticsData` type, `loadAnalytics()`, and view toggle |

---

**L2 — Three `eslint-disable-next-line react-hooks/exhaustive-deps` suppressions**  
*Files:* `join-content.tsx` (L67), `reset-password/page.tsx` (L43), `AdminPageClient.tsx` (L169)

Intentional "run once" effects, but each suppression lacks a comment explaining why it's safe.

---

**L3 — `user_domain_cooldowns` has no expiry cleanup**  
*File:* `supabase/migrations/20260503000005_roam_v11_freshness_diversity_exploration.sql`

The `user_domain_cooldowns` table accumulates one row per domain served per user. Expired rows (where `cooldown_until < NOW()`) are never purged. No pg_cron job is referenced in any migration. The table will grow unboundedly for active users.

---

**L4 — No Deno type-checking step in CI**

CI runs `deno test` on Edge Functions but not `deno check`. TypeScript errors in Edge Functions that don't cause test failures go undetected until deployment.

---

## Strengths (Code-Verified)

| Strength | Evidence |
|---|---|
| Server-side auth everywhere | `proxy.ts`, `admin/page.tsx`, `profile/page.tsx`, `settings/page.tsx` all use `supabase.auth.getUser()` |
| Fail-fast env validation (most paths) | `submit-url` uses `validateRequired()`; web `layout.tsx` imports `@/lib/env`; extension `env.ts` validates at SW startup |
| RLS on all tables | Every migration with a new table includes `ENABLE ROW LEVEL SECURITY` |
| Sentry on all clients | Web: `@sentry/nextjs` + `logError()`. Extension: `@sentry/browser` + `window.addEventListener('unhandledrejection')`. Android: `Sentry.captureException` in ViewModel |
| T&C enforced in sign-up | `join-content.tsx`: `createFormValid` requires `agreedToTerms && passwordStrength !== 'weak'` |
| Rate limiting on profile endpoint | `profile/index.ts`: 60 req/min per IP with `Retry-After` header |
| Safe Browsing hardened | `submit-url/index.ts`: `validateRequired(['SAFE_BROWSING_API_KEY'])` throws at startup; HTTP errors → 503; malicious URLs → 422 |
| MV3 compliance, no background loops | `background.ts` is purely event-driven; prefetch uses `chrome.storage.session` with 5-min TTL |
| v11 discovery algorithm | Freshness decay + exploration bonus + domain diversity cooldown confirmed in migration `000005` and `MainViewModel.kt` |
| Wilson score + calibrated weights | Confirmed in SQL, Edge Function return, and ViewModel scoring |
| Prefetch deduplication | `background.ts`: `prefetchInFlight` module-level Promise prevents duplicate API calls |
| Android offline queue | `MainViewModel.kt`: `pendingRatings` + `connectivityFlow` flushes on reconnect (task 14.9) |

---

## Suggested Improvements

### Immediate (blocking or high-risk)

1. **Fix migration conflict (C1):** Apply `20260503000007_roam_v12_merge_category_and_v11.sql` — see that file for the combined function. Verify with `SELECT proname, pronargs FROM pg_proc WHERE proname = 'roam'` that exactly one overload remains.

2. **Wire `ErrorBoundary.tsx` to Sentry (H5):**
   ```typescript
   import * as Sentry from '@sentry/nextjs';
   componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
     Sentry.captureException(error, { contexts: { react: errorInfo } });
   }
   ```

3. **Remove debug `console.log` from popup/callback (H5):** Gate behind `if (process.env.NODE_ENV !== 'production')` or replace with `logDebug()`. The roam response log at line 394 may expose URL data in the extension popup's DevTools.

4. **Write extension tests (H1):** The chrome mock in `setup.ts` is complete. Minimum: test `env.ts` validation, `messages.ts` type discriminators, and `background.ts` cache behavior.

### Short-Term

5. **Align env validation to one pattern (H4):** Adopt `validateRequired()` consistently. `proxy.ts` and `roam/index.ts` should use it. Create `_shared/validate-env.ts` for Edge Functions.

6. **Fix `category_id` in moderation queue (M1):** Add `category_id UUID REFERENCES categories(id)` to `moderation_queue`. Update `submit-url` to write it directly. Update `AdminPageClient.tsx` to display the category name.

7. **Scope CORS allowlist (C2):** Replace `*` with `['https://roamtheweb.app', 'chrome-extension://<id>']`. Task 9.34 is overdue.

8. **Remove unsafe `any` casts in `background.ts` (H3):** Use the Supabase `Session` type directly for `expires_at`. Define a row interface for the user-categories query result.

9. **Add `import 'server-only'` to admin dashboard (C3):** Prevents accidental client bundle inclusion of the service-role-key-using module.

### Long-Term

10. **Real integration tests for Edge Functions:** Replace mock-based `integration.test.ts` with tests that use `supabase start` in CI and make real HTTP requests.

11. **Sentry for Edge Functions:** `@sentry/deno` is available. Instrument `roam`, `submit-url`, and `feedback` to capture RPC timeouts and auth failures.

12. **pg_cron cleanup for `user_domain_cooldowns` (L3):** Schedule a daily `DELETE FROM user_domain_cooldowns WHERE cooldown_until < NOW()`.

13. **Add `deno check` to CI (L4):** Run `deno check supabase/functions/**/*.ts` as a step before `deno test`.

14. **Reconcile ROADMAP (L1):** Mark tasks 10.10, Stage 14, and 11.23 complete.

---

## Open Questions

| # | Question |
|---|---|
| 1 | Has `SELECT proname, pronargs FROM pg_proc WHERE proname = 'roam'` been run on production to confirm the overload conflict? |
| 2 | Does `background.ts`'s inline `normalizeUrl()` intentionally diverge from `_shared/normalise.ts` in Edge Functions, or is it a duplication? |
| 3 | The Android app passes `subcategory_id` to `repo.roam()` — is subcategory-level roaming in Android intentionally unimplemented at the Edge Function layer? |
| 4 | Is `scripts/validate-env.mjs` run as a pre-commit hook or only manually? |
| 5 | The v11 `user_domain_cooldowns` table grows unboundedly — is cleanup tracked anywhere? |

---

*Preceded by documentation-only audit in [AUDIT_2026-05-03_DOCS.md](AUDIT_2026-05-03_DOCS.md).*
