# Incident — "You've exhausted all URLs" shown to every user

**Date:** 2026-08-04 · **Status:** Resolved (service restored) · **Severity:** Total discovery outage

The core feature of the app returned nothing for every user, while the pool held
**1,577,693 approved URLs**. The app reported this as "you've seen everything"
rather than as an error, so nothing paged and Sentry stayed quiet.

---

## Root causes — there were two, and both had to be fixed

### Cause 1 — `roam()` threw `42P01` on every call

`roam_v31` (shipped 2026-08-03) added a CTE containing:

```sql
array_agg(u.subcategory_id)   -- alias "u" only exists inside a subquery aliased "t"
```

PL/pgSQL does not plan embedded SQL at `CREATE FUNCTION` time, so the migration
applied cleanly and then raised
`42P01: missing FROM-clause entry for table "u"` on **every invocation, for every
user**. A green migration was mistaken for a working function.

**Fix:** `20260804000000_roam_v32_fix_recent_subcats_alias.sql` — rewrites the
aggregate to the in-scope alias across all `roam()` overloads.

### Cause 2 — `roam()` took 15–18s against an 8s ceiling

Fixing the alias was not enough. Measured, not assumed:

```sql
SELECT rolconfig FROM pg_roles WHERE rolname='authenticated';
-- statement_timeout=8s        (anon: 3s)
```

Against real users, `roam()` ran **15.4s / 16.6s / 17.9s**. Every logged-in call
would have aborted with `57014` even with correct SQL — the same user-visible
symptom, a different cause.

This was nearly missed because the admin/Management-API session runs with
`statement_timeout=2min`, so the function "passed" on a path no user can take.
**A verification harness that does not enforce the caller's real timeout is not
verifying anything.**

**Fix:** `20260804000002_roam_v34_shrink_sample.sql` — narrows the primary
candidate sample to `TABLESAMPLE SYSTEM(2)`. All three probed users now return a
URL in **~3.9s**, comfortably inside 8s.

---

## A wrong turn worth recording

`20260804000001_roam_v33_system_sampling.sql` swapped `BERNOULLI(15)` for
`SYSTEM(10)` on the theory that heap-scan I/O dominated. **Latency did not move
(15.4→17.9s).** That falsified the I/O theory and pointed at per-candidate-row
work instead — the `user_suppressed_domains` `LIKE` anti-join, the `seen_urls`
anti-join, and inline scoring. v33 is retained because narrowing the sample
(v34) is what actually worked, and it only works on top of v33's syntax.

Note also that **`approved = TRUE` now has zero selectivity** — all 1,577,693
rows are approved — so any plan relying on it for filtering scans everything.

---

## Why this was invisible

The failure was laundered through two layers into a *reassuring* message:

1. `roam()` raises → the edge function returns **404**.
2. Android maps 404 → **"You've exhausted all URLs"**.

A database exception became a benign end-of-content screen. No Sentry issue, no
alert, no error rate change — only user reports.

---

## Verification

```bash
node scripts/verify-roam-rpc.mjs --limit 3
```

The probe executes `roam()` as real users via `set_config('request.jwt.claims',…)`
inside a `LATERAL` (so the JWT claim is set before `roam()` is called), and fails
on: exception, zero rows, **or** exceeding the 8s authenticated budget. It also
statically rejects the exact `array_agg(u.subcategory_id)` pattern.

Current: `RESULT: PASS` — 3 users, 1 row each, 3829–3965ms.

---

## Follow-ups (not yet done — highest value first)

1. **Never let a DB error render as "exhausted."** In `supabase/functions/roam`,
   return **503** on an RPC exception and reserve 404 strictly for a genuinely
   empty result; capture the `pg` error code to Sentry. In Android
   (`RoamRepository` / `MainViewModel`), show "Exhausted" **only** on an explicit
   marker from the server, and a retryable error otherwise. Until this lands,
   any future `roam()` failure will silently look like normal end-of-content.
2. **Gate deploys on the harness.** Run `verify-roam-rpc.mjs` in
   `.github/workflows/deploy.yml` after migrations, against a dedicated test
   account (each probe consumes a URL for that user).
3. **Alert on the impossible.** "Exhausted" served while
   `count(*) FROM urls WHERE approved` is in the millions should page.
4. **Get `roam()` well under 1s.** 3.9s is a survivable margin, not a good one —
   it is ~50% of the ceiling with no headroom for load. The structural fix is to
   stop doing per-row domain work: hoist the suppressed/paywalled `LIKE` checks
   out of the candidate loop (the array-based `v_cooled_domains` /
   `v_paywalled_domains` path is already the fast pattern) and apply them after
   `LIMIT`.
5. **Test PL/pgSQL by executing it.** `CREATE FUNCTION` success is not a test;
   embedded SQL is only planned on first call.
