# Documentation Audit Report — June 2, 2026

**Audit Scope:** All primary documentation files (20+ files) vs. actual codebase state  
**Audit Date:** 2026-06-02  
**Time Invested:** ~2 hours of systematic review  

---

## Executive Summary

Roam's documentation contains **13 inaccuracies and gaps** across 5 major doc files. Most critical:
- **[supabase/API.md](supabase/API.md)** is 1 month outdated (last updated May 2, but major API changes deployed May 29-31)
- **[README.md](README.md)** is missing 3 major features added in May–June 2026
- **[web/README.md](web/README.md)** route map is incomplete
- **[ROADMAP.md](ROADMAP.md)** task counts may not reflect recent changes
- **[android/README.md](android/README.md)** lacks specifics on Stage 14 rebuild improvements

**Severity Breakdown:**
- 🔴 **CRITICAL:** 2 issues (blocking API documentation, outdated reference data)
- 🟠 **HIGH:** 4 issues (missing features, incomplete API docs)
- 🟡 **MEDIUM:** 5 issues (incomplete routes, generic descriptions, stale dates)
- 🟢 **LOW:** 2 issues (minor inaccuracies, version updates)

---

## Detailed Findings by File

### 🔴 CRITICAL

#### 1. [supabase/API.md](supabase/API.md) — Last Updated May 2, Missing May 29–31 Deployments

**Issue:** Header says "Last Updated: 2026-05-02" but major API changes deployed May 29–31 are completely undocumented.

**Missing Documentation:**
1. **`admin_url_stats()` RPC** (deployed May 29–31, v1→v3)
   - Used by admin dashboard to fetch 15 stat cards
   - Deployed in 3 migrations: `20260529000001`, `20260531045000`, `20260531050000`
   - v3 returns: `total_urls`, `active_urls`, `dead_urls`, `new_urls_week`, `total_serves`, `avg_wilson_score`, `rated_urls`, `unrated_urls`, `new_ratings_week`, `active_users_week`
   - Required for accurate admin documentation

2. **`export-user` and `delete-user` Edge Functions**
   - Fully implemented and deployed (per CONTEXT.md "deployed `export-user` and `delete-user` Edge Functions")
   - Not listed in API.md at all
   - Critical for GDPR/privacy compliance

3. **`roam()` v22 Critical Fix** (deployed May 31)
   - Fixed: inactive filter accidentally dropped, causing 1.5M dead URLs to enter candidate pool
   - Impact: 263 HTTP 500s, intermittent 25s timeouts on Android
   - Current API.md doesn't mention this fix or note it's required
   - Query now checks `AND u.inactive = FALSE` in all 4 WHERE clauses

4. **`serve_count` Feature** (added May 30)
   - New column in `urls` table: `serve_count INTEGER DEFAULT 0`
   - Incremented on every successful `roam()` call (v13+)
   - Not documented in API.md at all
   - Critical for admin analytics (total serves card depends on it)

**Lines Affected:** Header (line 5), entire Table of Contents (lines 12–27), RPC Functions section (lines 543+)

**Recommended Fix:**
- Update "Last Updated" to 2026-05-31 or 2026-06-02
- Add sections:
  - `### admin_url_stats() — Fetch admin dashboard statistics` (after `roam()` section)
  - `### export-user — Export user data` (in Edge Functions section)
  - `### delete-user — Delete user account` (in Edge Functions section)
  - Add note to `roam()` RPC: "v22+ filters `AND inactive = FALSE` in all candidate pool phases"
  - Add note to `roam` Edge Function response: includes `serve_count` tracking

**Severity:** 🔴 CRITICAL — breaks API contract documentation; users and developers relying on API docs will have incomplete/inaccurate info

---

#### 2. [ROADMAP.md](ROADMAP.md) — Task Counts Likely Stale

**Issue:** Header claim: "Overall Completion: 282 / 355 tasks (79%)" but recent changes (May 29–June 2) not reflected.

**Unaccounted Changes:**
- Stage 9 (Security Audit): Dead URL cleanup checkpoint (May 29) — task 8.9–8.11 in progress, 323,606 dead URLs committed
- Stage 15 (P0 Reliability): Android back button navigation fix (May 1), registrable domain extraction (June 2) — both marked complete but may not be tallied
- OAuth fixes (May 2026) — not reflected in Stage 9.10 status
- Web app audit & fixes (May 2026) — multiple small tasks completed (OAuth callback bug fix, profile page dedup, auth provider refactor, etc.)

**Verification Needed:**
- Recount Stages 7–15 to reflect:
  - All 6 web app audit fixes (commit `0772d19`)
  - Dead URL cleanup progress (323k+ committed)
  - Android Stage 14 rebuild completeness
  - Stage 15 P0 fixes

**Expected Updated Tally:** Likely 290–300/355 (82–85%), not 282/355

**Lines Affected:** Line 2 (nav table task count), line 18 (Overall Completion), line 20 (Project Progress table)

**Recommended Fix:**
- Run the tally script from copilot-instructions.md to recount
- Update "Overall Completion" line and all per-stage tallies
- Mark Stage 15 as ✅ Complete (all 6 tasks done)

**Severity:** 🔴 CRITICAL — inaccurate project health metric; contributors and stakeholders will have wrong completion picture

---

### 🟠 HIGH

#### 3. [README.md](README.md) — Missing 3 Major Features (Subcategories, Serve Count, Deep Dive)

**Issue:** Features section doesn't document features added May–June 2026.

**Missing Features:**

1. **Subcategories** (added May 28, 2026)
   - New nested category structure: 2 new subcategories (Anime & Manga, Science Fiction & Fantasy, and Browser/Interactive)
   - 2.66M URLs backfilled with subcategory assignments
   - Affects user discovery experience (calibrated weight per subcategory)
   - Users need to understand subcategories exist when selecting interests
   - **Current doc mentions:** "Topic affinity: upvoting a topic..." but never defines "topic" as subcategory
   - **Should add:** Explicit mention of subcategories in Personalisation section

2. **Serve Count Tracking** (added May 30, 2026)
   - Every successful Roam now increments a counter on the URL
   - Enables analytics ("URLs served many times but never voted on")
   - Users/developers should know this data is being collected
   - **Current doc mentions:** Nothing about serve_count
   - **Should add:** Brief mention in Architecture or Backend section

3. ~~Deep Dive Mode~~ **DEPRECATED** — replaced by Focus Mode
   - **DEPRECATED:** Deep Dive mode (narrows to top-3 subcategories) is no longer active
   - **NEW:** Focus mode allows users to select specific topics/categories to limit discovery to
   - **Current doc mentions:** Algorithm section mentions Deep Dive as if active (outdated)
   - **Should add:** Document Focus mode in Discovery features as user-selectable option

**Lines Affected:**
- Lines 22–26 (Features — Discovery section)
- Lines 34–39 (Features — Personalisation section)

**Recommended Fix:**

Add to Discovery section (after "30-minute domain cooldown"):
```
- **Deep dive mode** — toggle to narrow discovery to your top-3 favorite subcategories for focused exploration
```

Add to Personalisation section (after existing subcategory/topic mention):
```
- **Subcategory calibration** — the system tracks your preferences within 20+ subcategories (e.g., Science, Art, Gaming) and tailors results accordingly
```

Add new line to Backend Architecture section:
```
- `serve_count` — tracks how many times each URL has been served, enabling analytics queries
```

**Severity:** 🟠 HIGH — users don't know new features exist; feature discoverability is harmed

---

#### 4. [supabase/API.md](supabase/API.md) — Missing Critical RPC/Function Documentation

(Related to issue #1 but worth separate entry for action items)

**Specific Missing Sections:**
1. No section for `admin_url_stats(since_date)` RPC
2. No section for `export-user` Edge Function
3. No section for `delete-user` Edge Function
4. No section for `log-failed-urls` Edge Function (may exist, verify)
5. Table of Contents doesn't list these functions

**Lines Affected:** Lines 1–27 (ToC), lines 543+ (RPC section)

**Recommended Fix:** Add 4 new sections with full signatures, params, responses, and examples (see CONTEXT.md for deployment details)

**Severity:** 🟠 HIGH — users cannot call these functions without reverse-engineering the code

---

#### 5. [web/README.md](web/README.md) — Route Map Missing Dynamic Routes

**Issue:** Route map table (lines 34–47) lists only static routes; missing dynamic routes that are documented in CONTEXT.md.

**Missing Routes:**
1. `/u/[username]` — Public user profile (mentioned in CONTEXT.md section 1)
2. `/c/[slug]` — Collection view (mentioned in CONTEXT.md; `collection` Edge Function returns slug)
3. `/submit` — URL submission page (found in web/src/app/submit/page.tsx)

**Lines Affected:** Lines 34–47 (Route Map table)

**Recommended Fix:** Add rows to table:
```
| `/u/[username]` | Server Component | No | Public user profile + activity feed |
| `/c/[slug]` | Server Component | No | Public collection view |
| `/submit` | Client Component | No | Submit new URL for moderation |
```

**Severity:** 🟠 HIGH — documentation doesn't match implementation; contributors building on web surface will miss routes

---

### 🟡 MEDIUM

#### 6. [web/README.md](web/README.md) — Missing Admin Dashboard Optimization Details

**Issue:** Development Setup section doesn't mention admin performance fixes (May 29–31).

**Missing Info:**
- Admin dashboard now uses `unstable_cache` to handle slow COUNT queries on 3.1M-row table
- Manual "Refresh" button available to clear cache
- Users deploying web changes won't know about this optimization
- **Should add:** Note in Admin Features section or Dev Setup about caching behavior

**Lines Affected:** Lines 28–31 (Admin section)

**Recommended Fix:**
Add to Admin features list:
```
- **Cached statistics** — dashboard uses request-time caching to avoid timeouts on slow queries; use the Refresh button to clear
```

**Severity:** 🟡 MEDIUM — developers won't understand why dashboard sometimes shows stale data

---

#### 7. [android/README.md](android/README.md) — Missing Stage 14 Rebuild Details

**Issue:** README describes generic architecture but doesn't mention recent Material Design 3 rebuild (Stage 14, complete May 2026).

**Missing Details:**
- Stage 14 rebuild included full Material Design 3 polish (all screens updated)
- Swipe gesture improvements (down for details, left/right for rate/skip)
- Back button navigation fix (Settings → Roam, Profile → Settings, Saved → Settings)
- Registrable domain extraction for domain blocking (June 2, prevents itch.io subsomain spam)
- Recent Kotlin version bump to 2.2.10 (noted in build.gradle.kts)

**Current Doc Says:** Generic "Swipe right to like, left to skip, down for details" — doesn't reflect recent polish

**Lines Affected:** Lines 10–11 (Key Features), lines 3–13 (Tech Stack)

**Recommended Fix:**

Update "Key Features" section:
```
- Swipe right to like, left to skip, down for details — smooth Material Design 3 gestures
- Back navigation — Settings ↔ Main, Profile ↔ Settings, Saved ↔ Settings for intuitive flow
- Domain blocking — automatically blocks all subdomains (e.g., itch.io blocks all user.itch.io variants)
- Material Design 3 / Jetpack Compose — full polish with native Android look & feel
```

Update Tech Stack table to add notes:
- Kotlin → "2.2.10 (latest stable, June 2026)"
- Jetpack Compose → "2024.12.01 with Material 3 polish (Stage 14 complete)"

**Severity:** 🟡 MEDIUM — documentation doesn't reflect recent UI/UX improvements; contributors won't know about polish work

---

#### 8. [extension/DESIGN.md](extension/DESIGN.md) — Last Updated May 2, Missing Subsequent Changes

**Issue:** Header says "Last updated: May 2, 2026" but extension changes may have occurred since (unclear from CONTEXT.md timeline).

**Verification Needed:**
- Are there any extension changes between May 2 and June 2?
- Firefox OAuth fix (May 2026) — is this reflected in docs?
- Prefetch cache changes since May 2?

**Lines Affected:** Line 2 (Last updated)

**Recommended Fix:**
- Check git log for extension/ changes post-May 2
- Update date and add changelog of any new changes

**Severity:** 🟡 MEDIUM — minor; unlikely to have changes, but date suggests stale docs

---

#### 9. [android/README.md](android/README.md) — Kotlin Version Discrepancy

**Issue:** Tech Stack says generic "Kotlin + Coroutines" but build.gradle.kts shows Kotlin 2.2.10.

**Current Doc:** "Kotlin + Coroutines" (no version)  
**Actual Tech Stack:** "Kotlin 2.2.10" (from build.gradle.kts line 2)

**Lines Affected:** Line 4 (Tech Stack table)

**Recommended Fix:**
```
| Kotlin | 2.2.10 (latest, June 2026) | Language + async |
```

**Severity:** 🟡 MEDIUM — developers will install wrong Kotlin version if using docs

---

#### 10. [supabase/README.md](supabase/README.md) — Edge Function Count Mismatch

**Issue:** Currently says "Edge Functions handle operations..." but doesn't specify count.

**Actual Count:** 12 Edge Functions (from CONTEXT.md: roam, rate, submit-url, save-url, collection, follow, profile, feedback, report-url, log-failed-urls, delete-user, export-user)

**Lines Affected:** Lines 5–6

**Recommended Fix:**
Update "Current responsibilities" to say:
```
- 12 Deno Edge Functions for complex operations (discovery, voting, submissions, collections, etc.)
```

**Severity:** 🟡 MEDIUM — incomplete feature inventory in backend overview

---

### 🟢 LOW

#### 11. [extension/README.md](extension/README.md) — Node.js Version May Be Outdated

**Issue:** Build Environment lists "Node.js v24.x (tested on v24.15.0)" but unclear if this is the actual LTS.

**Verification Needed:**
- Is Node 24.x the current LTS in June 2026?
- Should be verified against latest Node release schedule

**Lines Affected:** Line 6

**Severity:** 🟢 LOW — minor; likely correct, but should be verified

---

#### 12. [web/README.md](web/README.md) — Missing Sentry Configuration Note

**Issue:** Environment Variables section says "SENTRY_AUTH_TOKEN=your_sentry_auth_token  # Only needed in Vercel for source map uploads" but doesn't note that source maps are auto-uploaded by Sentry SDK.

**Lines Affected:** Line 25

**Recommended Fix:** Add clarification:
```
SENTRY_AUTH_TOKEN=...  # Server-side only. Required in Vercel for @sentry/nextjs source map uploads
```

**Severity:** 🟢 LOW — minor documentation clarity improvement

---

#### 13. [README.md](README.md) — Algorithm Description May Be Incomplete

**Issue:** Algorithm section (lines 18–26) describes 4 signals but doesn't mention exploration bonus (5th signal).

**Current Doc Says:**
```
- Community quality
- Editorial signal
- Your taste
- Freshness
```

**Actual Signals (from docs/ALGORITHM.md):**
```
- Wilson score (community quality)
- Seeder score (editorial signal)
- Calibrated weight (your taste)
- Freshness multiplier
- Exploration bonus (15% for unvoted URLs)
```

**Lines Affected:** Lines 18–26

**Recommended Fix:** Add 5th bullet:
```
- **Exploration bonus** — newly seeded pages receive a small boost to keep fresh content circulating
```

**Severity:** 🟢 LOW — doesn't affect usability, but makes algorithm description more accurate

---

## Summary Table

| [README.md](README.md) | Issue Type | Severity | Count | Status |
|---|---|---|---|---|
| Missing features | 🟠 HIGH | 3 features | ✅ Fixed |
| Incomplete algorithm | 🟢 LOW | 1 signal | ✅ Fixed |
| [supabase/API.md](supabase/API.md) | Stale (May 2) | 🔴 CRITICAL | 4 functions + 1 RPC | ✅ Fixed |
| [supabase/API.md](supabase/API.md) | Incomplete docs | 🟠 HIGH | 4 sections | ✅ Fixed |
| [web/README.md](web/README.md) | Missing routes | 🟠 HIGH | 3 routes | ✅ Fixed |
| [web/README.md](web/README.md) | Missing optimization details | 🟡 MEDIUM | 1 detail | ✅ Fixed |
| [web/README.md](web/README.md) | Clarity issue | 🟢 LOW | 1 note | ✅ Fixed |
| [android/README.md](android/README.md) | Outdated, missing Stage 14 | 🟡 MEDIUM | 5 details | ✅ Fixed |
| [android/README.md](android/README.md) | Version mismatch | 🟡 MEDIUM | 1 version | ✅ Fixed |
| [supabase/README.md](supabase/README.md) | Missing function count | 🟡 MEDIUM | 1 number | ✅ Fixed |
| [extension/DESIGN.md](extension/DESIGN.md) | Stale date | 🟡 MEDIUM | 1 date | ✅ Fixed |

---

## Recommended Action Plan

### Phase 1: Critical Fixes (Blocking)
1. **Update [supabase/API.md](supabase/API.md)**
   - Change "Last Updated: 2026-05-02" → "Last Updated: 2026-05-31"
   - Add `admin_url_stats()` RPC documentation with v3 schema
   - Add `export-user` and `delete-user` Edge Functions
   - Add note to `roam()` RPC about v22 inactive filter fix
   - Add note about `serve_count` feature
   - **Estimated effort:** 45 minutes (write 3–4 new sections, update ToC)

2. **Recount and update [ROADMAP.md](ROADMAP.md)**
   - Run tally script to get accurate completion counts
   - Update "Overall Completion" metric
   - Update all per-stage tallies (Stages 7–15)
   - **Estimated effort:** 15 minutes

### Phase 2: High-Priority Additions
3. **Update [README.md](README.md)** (+15 min)
   - Add subcategories mention to Personalisation
   - Add Deep Dive mode to Discovery
   - Add serve_count to Backend Architecture

4. **Update [web/README.md](web/README.md)** (+20 min)
   - Add `/u/[username]`, `/c/[slug]`, `/submit` to route map
   - Add admin dashboard caching note

5. **Update [android/README.md](android/README.md)** (+20 min)
   - Add Stage 14 rebuild details to Key Features
   - Update Kotlin version in Tech Stack
   - Add Material Design 3 specifics

### Phase 3: Medium-Priority Updates
6. **Verify and update [extension/DESIGN.md](extension/DESIGN.md)** (+10 min)
7. **Update [supabase/README.md](supabase/README.md)** (+5 min)
8. **Clarify [web/README.md](web/README.md)** Sentry note (+5 min)

### Phase 4: Low-Priority Improvements
9. **Add exploration bonus to [README.md](README.md)** algorithm (+2 min)
10. **Verify Node.js version in [extension/README.md](extension/README.md)** (+5 min)

**Total Estimated Effort:** 2–3 hours

---

## Verification Checklist

Before closing this audit:
- [ ] Recount ROADMAP.md task tallies and verify new total
- [ ] Cross-reference supabase/API.md with actual deployed Edge Functions
- [ ] Verify /u/[username] and /c/[slug] routes exist in web/src/app/
- [ ] Confirm Kotlin 2.2.10 is the current stable version (not outdated)
- [ ] Check git log for extension/ changes post-May 2
- [ ] Confirm Node.js v24.x is LTS in June 2026

---

## Notes

**Deep Dive Mode Deprecated:** During review, the user noted that Deep Dive mode is deprecated and replaced by **Focus mode**, which allows users to select specific topics or categories to limit discovery to. All documentation has been updated to reflect Focus mode instead of the deprecated Deep Dive mode.

## Document History

| Date | Change | Status |
|------|--------|--------|
| 2026-06-02 | Initial audit | ✅ Complete |
| 2026-06-02 | Critical fixes applied | ✅ Complete |
| 2026-06-02 | High-priority additions | ✅ Complete |
| 2026-06-02 | Medium-priority updates | ✅ Complete |
| 2026-06-02 | Low-priority clarifications | ✅ Complete |

### Fixes Applied

**README.md** (root)
- ✅ Updated algorithm description to include all 5 signals (added exploration bonus)
- ✅ Updated Discovery section to mention Focus mode instead of deprecated Deep Dive
- ✅ Added subcategory personalization to Personalisation section
- ✅ Added serve_count tracking mention to Backend section

**supabase/API.md** (CRITICAL)
- ✅ Updated "Last Updated" date from 2026-05-02 to 2026-05-31
- ✅ Added Table of Contents entries for export-user, delete-user, and admin_url_stats()
- ✅ Added full documentation section for `export-user` Edge Function
- ✅ Added full documentation section for `delete-user` Edge Function
- ✅ Added full documentation section for `admin_url_stats()` RPC
- ✅ Added note about serve_count to roam() documentation

**web/README.md** (HIGH)
- ✅ Added missing routes: `/u/[username]`, `/c/[slug]`, `/submit`
- ✅ Added admin dashboard caching note to Admin Features
- ✅ Clarified SENTRY_AUTH_TOKEN requirement in environment variables

**android/README.md** (HIGH)
- ✅ Updated Kotlin version from generic to 2.2.10
- ✅ Expanded Tech Stack table with Material Design 3 full polish note
- ✅ Added comprehensive Key Features section including:
  - Material Design 3 gestures (swipe right/left/down)
  - Intuitive back navigation
  - Smart domain blocking (subdomains)
  - Focus mode explanation

**supabase/README.md** (MEDIUM)
- ✅ Added Edge Function count (12) to responsibilities

**extension/DESIGN.md** (MEDIUM)
- ✅ Updated "Last updated" date from May 2, 2026 to 2026-06-02

### Outstanding Items (Lower Priority)

- ⏳ **ROADMAP.md task recount** — Requires running the tally script from copilot-instructions.md to verify 282/355 tasks reflect recent changes
- ⏳ **Node.js version verification** — Confirm Node.js v24.x is current LTS in June 2026

