# Discovery Pipeline — Improvement Plan

**Date:** May 5, 2026  
**Prerequisite reading:** [DISCOVERY_PIPELINE_AUDIT.md](DISCOVERY_PIPELINE_AUDIT.md)  
**Goal:** Reduce typical `roam()` latency from 2–8s (with occasional 35s timeouts) to 200–600ms in the common case, and sub-100ms at scale.

---

## Don't Rebuild the Database

The schema is sound. The `urls` table, RLS policies, migrations, and Edge Function wrapper are all correct. What needs surgery is the `roam()` PL/pgSQL function internals and a few supporting structures. The fixes below are surgical and backwards-compatible — no data migration required for any of them except Fix 8.

---

## Tier 1 — Quick Wins (~1–2 days, ~70% latency improvement)

### Fix 1: Pre-load exclusion sets as arrays

**Problem (Issues 2, 3 from audit):** Three correlated `NOT EXISTS` subqueries run inside the TABLESAMPLE loop — up to 315k × 3 ≈ 945k index lookups per call. This is the single biggest cost driver and gets worse the more a user roams.

**Fix:** Load the user's exclusion sets once at function start, then use `!= ALL(array)` in the query.

```sql
-- Load once at the top of roam()
SELECT array_agg(url_id) INTO v_seen_ids
  FROM seen_urls WHERE user_id = p_user_id;

SELECT array_agg(domain) INTO v_cooled_domains
  FROM user_domain_cooldowns
  WHERE user_id = p_user_id AND cooldown_until > NOW();

SELECT array_agg(domain) INTO v_suppressed_domains
  FROM user_suppressed_domains
  WHERE user_id = p_user_id AND suppressed_until > NOW();

-- Replace all NOT EXISTS (...) clauses in the query with:
AND (v_seen_ids IS NULL        OR u.id     != ALL(v_seen_ids))
AND (v_cooled_domains IS NULL  OR u.domain != ALL(v_cooled_domains))
AND (v_suppressed_domains IS NULL OR u.domain != ALL(v_suppressed_domains))
```

PostgreSQL evaluates `!= ALL(array)` as a single vectorized pass — not 315k separate index lookups. For a user with 500 seen URLs and 5 domain cooldowns, this goes from ~945k index hits to 3 sequential reads.

---

### Fix 2: Pre-load user interest scores as a local map

**Problem (Issue 5 from audit):** `user_interest_scores` is LEFT JOINed on every one of the ~315k TABLESAMPLE rows. Most URLs share subcategory IDs, so the same join key is resolved thousands of times.

**Fix:** Load the user's weight map into parallel arrays at function start, then use `array_position()` inline.

```sql
SELECT array_agg(subcategory_id ORDER BY subcategory_id),
       array_agg(calibrated_weight ORDER BY subcategory_id)
  INTO v_score_subcats, v_score_weights
  FROM user_interest_scores
  WHERE user_id = p_user_id;

-- Replace LEFT JOIN with inline array lookup:
COALESCE(
  v_score_weights[array_position(v_score_subcats, u.subcategory_id)],
  1.0
) AS calibrated_weight
```

One array lookup per row instead of one join per row.

---

### Fix 3: Remove Android HEAD validation entirely

**Problem (Issue 7 from audit):** Every URL is HEAD-checked (5s connect + 5s read timeout) before being served. This adds up to 30s of cold-start latency and is redundant — URLs come from an approved, seeded database with a broken-link report mechanism.

**Fix:** Delete `isUrlReachable()` and the hot/warm promotion loop. The hot queue becomes a straight API prefetch queue. Collapsed queue design:

```
Old: warm queue (5, unvalidated) → HEAD check → hot queue (3, validated)
New: prefetch queue (3, served directly from API)
```

No HEAD checking. If a URL is dead, the user reports it and the database handles cleanup. This is the correct abstraction boundary.

---

### Fix 4: Remove the 300ms inter-fetch delay

**Problem (Issue 8 from audit):** `delay(300)` between warm queue API calls was added to stop hammering the database during timeouts (ROAM-ANDROID-4). With Fixes 1–2 landing, this workaround has no remaining purpose.

**Fix:** Remove the delay. With the prefetch queue collapsed to 3 slots (Fix 3) and fast DB responses, all 3 URLs can be fetched in parallel or in rapid succession without triggering timeouts.

---

## Tier 2 — Medium Effort (~3–5 days, closes the remaining gap)

### Fix 5: Increase TABLESAMPLE percentage to 25%

**Problem (Issue 1 from audit):** TABLESAMPLE BERNOULLI(10) samples ~315k rows and then applies heavy filters, often yielding zero results and triggering the expensive Phase 2 fallback.

**Fix:** With correlated subquery overhead gone (Fixes 1–2), Phase 1 is cheap enough to widen. BERNOULLI(25) samples ~787k rows, making Phase 1 yield qualifying results far more reliably.

```sql
FROM urls u TABLESAMPLE BERNOULLI(25)
```

This directly reduces Phase 2 fallback frequency without requiring an architectural change.

---

### Fix 6: Pre-compute a static `roam_score` column on `urls`

**Problem (Issue 6 from audit):** The scoring expression is computed at runtime for all sampled rows, four times over in the duplicated query blocks. The static component (wilson_score + seeder_score contributions) never changes between votes.

**Fix:** Add a generated/maintained column, updated by a trigger on each vote:

```sql
ALTER TABLE public.urls ADD COLUMN roam_score_static DOUBLE PRECISION
  GENERATED ALWAYS AS (wilson_score + 0.3 * seeder_score) STORED;

CREATE INDEX idx_urls_roam_score_static ON public.urls (roam_score_static DESC)
  WHERE approved = TRUE;
```

The runtime query then only computes the dynamic components (exploration bonus, freshness decay, calibrated weight) against the pre-computed base. This also collapses the 4 duplicated scoring blocks into a shared expression.

---

### Fix 7: Fix the paywall subdomain check

**Problem (Issue 3 from audit):** `u.domain LIKE ('%.' || pd.domain)` is a leading-wildcard pattern — B-tree indexes cannot accelerate it, causing a sequential scan of `paywalled_domains` for every sampled row.

**Fix:** Use a reverse-domain index to make subdomain matching index-scannable:

```sql
CREATE INDEX idx_paywalled_domains_reversed
  ON public.paywalled_domains (reverse(domain));

-- Query replaces LIKE with:
WHERE pd.domain = u.domain
   OR reverse(u.domain) LIKE (reverse(pd.domain) || '.%')
```

A trailing-wildcard LIKE on a reversed string is indexable.

---

## Tier 3 — Architectural Improvement (~1–2 weeks, for scale beyond 10M URLs)

### Fix 8: Subcategory-level candidate pool table

**Problem:** As the URL pool grows beyond 10M rows, even an optimized TABLESAMPLE scan will eventually become expensive. The fundamental issue is that the query selects from the full URL population at read time instead of a pre-filtered subset.

**Fix:** Pre-compute a `roam_candidates` table at write time, maintained by a nightly job or a vote trigger:

```sql
CREATE TABLE public.roam_candidates (
  subcategory_id UUID        NOT NULL,
  url_id         UUID        NOT NULL REFERENCES public.urls(id) ON DELETE CASCADE,
  roam_score     DOUBLE PRECISION NOT NULL,
  PRIMARY KEY (subcategory_id, url_id)
);

CREATE INDEX idx_roam_candidates_score
  ON public.roam_candidates (subcategory_id, roam_score DESC);
```

A nightly `pg_cron` job maintains the top 5,000 URLs per subcategory in this table. The `roam()` function queries this set (at most a few thousand rows) instead of 3.15M. User-specific exclusions (seen, cooled, suppressed) are applied against this tiny pool at query time.

At that point the Phase 1 / Phase 2 TABLESAMPLE architecture becomes unnecessary — a simple `ORDER BY roam_score DESC LIMIT 500` on the candidate pool with `OFFSET floor(random() * 500)` is both deterministic and fast.

This is the design that scales to 100M+ URLs without ever touching the timeout ceiling again.

---

## Recommended Execution Order

| # | Fix | Effort | Expected improvement |
|---|-----|--------|----------------------|
| 1 | Pre-load exclusion arrays (Fix 1) | ~3h SQL | ~60% DB latency reduction |
| 2 | Pre-load interest score map (Fix 2) | ~1h SQL | ~10% DB latency reduction |
| 3 | Remove Android HEAD validation (Fix 3) | ~1h Kotlin | Eliminates 0–30s mobile cold-start |
| 4 | Remove 300ms inter-fetch delay (Fix 4) | ~15m Kotlin | Eliminates 1.5s min warm fill time |
| 5 | TABLESAMPLE 25% (Fix 5) | ~30m SQL | Eliminates most Phase 2 fallbacks |
| 6 | Pre-computed roam_score column (Fix 6) | ~3h SQL | ~15% remaining runtime cost |
| 7 | Paywall subdomain index (Fix 7) | ~1h SQL | Eliminates per-row table scan |
| 8 | Candidate pool table (Fix 8) | ~2 days | Sub-100ms at any URL pool size |

Fixes 1–5 can be shipped in a single sprint. Fixes 6–7 are independent and can follow. Fix 8 is a background project for when the pool grows beyond ~10M rows.

---

## Expected Outcome After Fixes 1–5

| Scenario | Before | After |
|----------|--------|-------|
| Typical cold-start roam (Android) | 2–8s | ~300–600ms |
| Worst-case cold-start (Android, empty hot queue) | up to 35s | ~600ms–1s |
| Phase 2 fallback frequency | ~30–50% of calls | <5% of calls |
| 503 timeout rate | Frequent | Near zero |
| Active user degradation over time | Yes (grows with seen_urls) | No (array load is O(n) once) |
