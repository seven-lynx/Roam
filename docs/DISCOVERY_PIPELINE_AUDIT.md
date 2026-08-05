# Roam Discovery Pipeline — Performance Audit

**Date:** May 5, 2026  
**Scope:** Supabase `roam()` RPC (v13), Android prefetch pipeline, browser extension queue

---

## Executive Summary

The core problem is **architectural**: the database algorithm uses `TABLESAMPLE BERNOULLI(10)` as a randomization strategy, but the query also applies 6+ correlated subquery filters. These two approaches fight each other — TABLESAMPLE is designed to sample rows cheaply from the *whole table*, but the moment you add heavy WHERE predicates, the effective yield from the sample collapses, triggering an expensive full-scan fallback that the timeout ceiling (now 35 seconds) was raised twice to accommodate. The client-side HEAD validation on Android compounds the problem with up to 10 additional seconds per URL.

---

## Issue 1 — TABLESAMPLE is Incompatible with Heavy Filtering (Critical)

`TABLESAMPLE BERNOULLI(10)` randomly selects ~10% of physical pages first, *then* applies all WHERE filters. At 3.15M rows the sample is ~315k rows. But the effective post-filter yield depends on how many qualifying rows exist in that sample after all of the following are applied:

- `approved = TRUE`
- `language = ANY(v_langs)`
- `subcategory_id = ANY(v_allowed_subcat_ids)` (user category prefs)
- `NOT EXISTS seen_urls` (grows with usage)
- `NOT EXISTS user_domain_cooldowns` (up to 30+ domains)
- `NOT EXISTS user_suppressed_domains`
- `skip_paywall` check
- `exclude_domain` exclusion
- `p_category_id` / `v_effective_subcat_id` filters

For any user with 200+ seen URLs and 3+ active domain cooldowns using niche categories, the Phase 1 yield is regularly zero. Phase 2 then runs — a full `ORDER BY (wilson_score + 0.3·seeder_score) DESC LIMIT 100` scan on 3.15M rows. This is why the timeout was pushed to 35s. **The TABLESAMPLE "optimization" is not actually preventing the expensive fallback path in practice.**

---

## Issue 2 — Three Correlated `NOT EXISTS` Subqueries Run Per Row (Critical)

Inside the TABLESAMPLE block (up to 315k iterations), the planner executes three separate correlated NOT EXISTS checks per row:

```sql
-- 1. seen_urls — O(1) per index hit but 315k hits total
AND NOT EXISTS (SELECT 1 FROM seen_urls su WHERE su.user_id = p_user_id AND su.url_id = u.id)

-- 2. domain_cooldowns — same pattern
AND NOT EXISTS (SELECT 1 FROM user_domain_cooldowns udc WHERE udc.user_id = p_user_id AND udc.domain = u.domain AND udc.cooldown_until > NOW())

-- 3. suppressed domains — same pattern
AND NOT EXISTS (SELECT 1 FROM user_suppressed_domains usd WHERE usd.user_id = p_user_id AND usd.domain = u.domain AND usd.suppressed_until > NOW())
```

Even with perfect indexes these are 315k × 3 = ~945k individual index lookups per call. As a user's `seen_urls` grows (active users easily accumulate 500–2000 rows), the anti-join cost grows and the TABLESAMPLE yield drops simultaneously — a double worsening.

---

## Issue 3 — Paywalled Domains Uses a Non-Indexable LIKE Pattern (High)

```sql
AND (NOT v_skip_paywall OR NOT EXISTS (
  SELECT 1 FROM paywalled_domains pd
  WHERE pd.domain = u.domain OR u.domain LIKE ('%.' || pd.domain)  -- ← non-indexable
))
```

`u.domain LIKE ('%.' || pd.domain)` is a prefix wildcard — it cannot use a B-tree index. This forces a sequential scan of the entire `paywalled_domains` table for every sampled row where `v_skip_paywall = TRUE`. This runs inside the 315k-row loop.

---

## Issue 4 — Category Expansion Runs as a Nested NOT IN Every Call (High)

```sql
SELECT array_agg(DISTINCT sc.id) INTO v_allowed_subcat_ids
FROM subcategories sc
WHERE sc.id IN (SELECT uc.subcategory_id FROM user_categories uc WHERE uc.user_id = p_user_id ...)
   OR sc.category_id IN (
     SELECT uc.category_id FROM user_categories uc WHERE uc.user_id = p_user_id
       AND uc.subcategory_id IS NULL
       AND uc.category_id NOT IN (   -- ← correlated NOT IN inside NOT IN
         SELECT uc2.category_id FROM user_categories uc2
         WHERE uc2.user_id = p_user_id AND uc2.subcategory_id IS NOT NULL
       )
   );
```

This nested NOT IN with a correlated inner query runs on **every single `roam()` invocation**, even though a user's categories change at most once per session. The result (`v_allowed_subcat_ids`) is never cached.

---

## Issue 5 — `user_interest_scores` LEFT JOIN on Every TABLESAMPLE Row (High)

```sql
LEFT JOIN user_interest_scores uis
  ON uis.user_id = p_user_id AND uis.subcategory_id = u.subcategory_id
```

This join computes the personalization weight for every one of the ~315k sampled rows. Since most URLs will share a subcategory_id with several other sampled rows, and `user_interest_scores` has one row per user per subcategory, this join is highly repetitive. The full score map for a user could be pre-loaded into a local variable at function start.

---

## Issue 6 — Massive SQL Code Duplication (Medium)

There are **4 near-identical query blocks** in the function: collection Phase 1, collection Phase 2, standard Phase 1, standard Phase 2. The full scoring expression:

```sql
(wilson_score + 0.3*seeder_score + exploration_bonus) × calibrated_weight × freshness_decay
```

is copy-pasted 4 times with no abstraction. Every scoring change requires 4 edits, and the query planner cannot share execution plans across the branches.

---

## Issue 7 — Android: HEAD Validation is Redundant and Adds ~10s Per URL (High)

```kotlin
val conn = URL(url).openConnection() as HttpURLConnection
conn.requestMethod = "HEAD"
conn.connectTimeout = 5_000  // 5s
conn.readTimeout    = 5_000  // 5s
```

Every URL in the warm queue is HEAD-checked before being promoted to hot. This:

1. **Is redundant** — URLs in the DB are seeded, approved, and have a broken-link reporting mechanism for post-hoc cleanup.
2. **Is expensive** — up to 10s per URL × 3 hot slots = up to 30s to fill a cold hot queue.
3. **Is at the wrong abstraction layer** — link health is a server-side concern.
4. **Blocks the prefetch pipeline** — the loop cannot proceed to the next URL until the HEAD check completes or times out.
5. **Uses `java.net.HttpURLConnection`** (not OkHttp/Ktor), bypassing all existing HTTP client configuration and certificate handling.

---

## Issue 8 — Android: 300ms Inter-Fetch Delay is a Symptom, Not a Fix (Medium)

```kotlin
delay(300)  // ROAM-ANDROID-4: prevents 60s timeout hammering
```

This delay exists because rapid sequential API calls were triggering database timeouts. The fix addressed the *symptom* (hammering) rather than the root cause (slow DB queries). With 5 warm slots and 300ms delay each, minimum warm fill time is **1.5 seconds from a cold start**, before any HEAD validation has even begun.

---

## Issue 9 — Android: Queue Full-Reset on Filter Change (Medium)

When the user changes category or collection filter:

```kotlin
prefetchJob?.cancel()
prefetchMutex.withLock {
    hotQueue.clear()
    warmQueue.clear()
}
```

All buffered URLs are discarded and the pipeline cold-starts. If the user switches categories and back, they wait for the entire warm + hot pipeline to rebuild.

---

## Issue 10 — Extension: Single URL Cache with No Retry on Miss (Medium)

The extension keeps exactly 1 prefetched URL with a 5-minute TTL. On cache miss: one live call, no retry. If that call fails (503 timeout, network error), the user sees a spinner and must click again. There is no fallback and no failure indicator.

---

## Issue 11 — seen_urls Table Has No Automated Pruning (Medium)

The `seen_urls` table applies a 30-day window in the `NOT EXISTS` WHERE clause but rows older than 30 days are never actually deleted unless a `pg_cron` job runs. If that job is missing or fails, `seen_urls` grows without bound, making every future NOT EXISTS check progressively slower.

---

## Issue 12 — supabase-kt Bug: 503 Triggers Session Refresh on Android (Low)

```
// RoamRepository.kt comment:
// supabase-kt 3.0.2 bug: parseErrorResponse's else-branch throws
// UnauthorizedRestException for ALL non-2xx responses from functions.invoke(),
// including 500 and 503.
```

When the DB times out (503), the Android client incorrectly interprets it as an auth failure and attempts a session refresh before propagating the error. This adds 1–2s of latency to every timeout event — worst case (slow DB → client waits → session refresh → shows error) can take 37+ seconds.

---

## Summary Table

| # | Issue | Layer | Severity | Impact |
|---|-------|-------|----------|--------|
| 1 | TABLESAMPLE + heavy filters = Phase 2 runs frequently | DB | **Critical** | Primary cause of 35s timeouts |
| 2 | 3× correlated NOT EXISTS on 315k rows per call | DB | **Critical** | Grows worse with usage |
| 3 | Non-indexable LIKE in paywall check | DB | High | Per-row full table scan |
| 4 | Category expansion nested NOT IN runs every call | DB | High | Wasted work per call |
| 5 | user_interest_scores JOIN on full TABLESAMPLE | DB | High | 315k repetitive joins |
| 6 | 4× duplicated scoring SQL blocks | DB | Medium | Maintenance + plan fragmentation |
| 7 | Android HEAD validation: redundant, 10s/URL | Android | High | Primary UX latency on mobile |
| 8 | 300ms inter-fetch delay (symptom workaround) | Android | Medium | 1.5s min warm fill time |
| 9 | Queue full-reset on filter change | Android | Medium | Cold-start UX on every filter toggle |
| 10 | Extension: 1 URL cache, no retry on miss | Extension | Medium | Visible latency on every miss |
| 11 | seen_urls grows unbounded (no pruning) | DB | Medium | Long-term performance degradation |
| 12 | supabase-kt bug: 503 → spurious session refresh | Android | Low | Adds ~2s to every timeout event |

---

## Root Cause in One Sentence

The roam function was designed for a small URL pool and has been patched incrementally as the pool grew to 3.15M rows, but the fundamental query structure — correlated subqueries inside a TABLESAMPLE that doesn't account for post-filter yield — means it gets slower the more a user actually uses the product.
