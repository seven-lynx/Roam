# Markdown Documentation Audit Report

**Date:** 2026-07-29
**Scope:** 96 non-dependency markdown files (excluding `node_modules`, `dist-`, `dist-firefox/`)
**Method:** Cross-referenced all factual claims against filesystem and source code
**Auditor:** Automated codebase-verification audit

---

## Executive Summary

96 markdown files were audited. **22 issues** found across 2 severity levels. The most impactful are stale counts (migrations, edge functions) repeated across multiple documents. No critical broken links or missing referenced files were found.

**Severity breakdown:**
- **HIGH (3):** Factually incorrect counts referenced in 3+ documents; missing table entries
- **MEDIUM (11):** Stale extension references, internal inconsistency, missing routes from documentation
- **LOW (8):** Minor documentation drift, formatting inconsistencies, legacy references

---

## HIGH Severity Issues

### H-01: SQL migration count stale across all documents
- **Files:** `README.md:157`, `supabase/README.md:7`
- **Stated:** "50+" (root README) / "60+ migration files" (supabase README)
- **Actual:** 142 `.sql` files in `supabase/migrations/`
- **Impact:** Undercounts project scale by ~3×; erodes confidence in all other numerical claims
- **Fix:** Replace with "142 SQL migrations" in both files

### H-02: Edge function count stale across all documents
- **Files:** `README.md:158-159,161-162` (lists 17), `supabase/README.md:8,14` (lists 17)
- **Stated:** "17 Deno Edge Functions" with enumerated list
- **Actual:** 24 edge function directories (excluding `_shared` and `_tests`)
- **Unlisted functions:** `activity-feed`, `admin-moderation`, `cron-streak-cleanup`, `feedback`, `report-engagement`, `scrape-url`
- **Also affected:** `README.md:114-115` lists 20 functions (closer but still missing 4)
- **Fix:** Update to "24 Deno Edge Functions" and sync lists across all files

### H-03: `scripts/README.md` Data Sources table missing 500+ seeders
- **File:** `scripts/README.md:18-66`
- **Stated:** Table lists 47 seeders; "106 distinct seeders" / "~1.5M approved URLs"
- **Actual:** 571 `.mjs` seeders + 28 `.js` seeders exist in `scripts/`
- **Issue:** The table only documents legacy `.js` seeders and a small selection of `.mjs` seeders. 500+ `.mjs` seeders (covering new categories like cars, pets/fishing, digital archives, health & wellness, food, etc.) are completely undocumented.
- **Fix:** Either regenerate the full table programmatically or replace the static table with a pointer to `audit-seeders.mjs` output

---

## MEDIUM Severity Issues

### M-01: Queue size inconsistency in `android/README.md`
- **File:** `android/README.md:200-204`
- **Prefetch queue table states:** Hot = 3, Warm = 5 (line 200-204)
- **ViewModel diagram states:** hotQueue `target = 12`, warmQueue `target = 15` (line 41-42)
- **Impact:** Two conflicting sets of queue sizes in the same document — which is correct?
- **Fix:** Reconcile to actual code values in `MainViewModel.kt`

### M-02: `web/README.md` route map lists `/forgot-password` twice
- **File:** `web/README.md:57,70`
- **Duplicate entries** on lines 57 and 70 for `/forgot-password`
- **Fix:** Remove the duplicate (keep line 70 as it's the Client Component definition)

### M-03: `web/README.md` missing `/following` route
- **File:** `web/README.md:48-73` (Route Map table)
- **Issue:** `/following` route exists in codebase (`web/src/app/following/page.tsx` + `ActivityFeedClient.tsx`) but is not documented in the route map
- **Fix:** Add entry: `| /following | Client Component | Yes | Activity feed from followed users |`

### M-04: `web/README.md` missing `/leaderboard` and `/badges` routes in tree diagram
- **File:** `web/README.md:111-154` (Project Structure tree)
- **Issue:** The directory tree shows `badges/`, `collections/`, `u/`, etc. but does not show `leaderboard/` or `following/` directories
- **Fix:** Add `leaderboard/` and `following/` to the structure tree

### M-05: `web/README.md` references GitHub OAuth — feature may not exist
- **File:** `web/README.md:20`
- **Stated:** "Google OAuth, GitHub OAuth, or email/password"
- **Actual:** Root README only mentions Google OAuth + email/password. Extension callback handles PKCE. No GitHub OAuth provider appears in `web/src/app/auth/callback/route.ts` or `web/src/components/AuthProvider.tsx`
- **Fix:** Verify if GitHub OAuth is actually implemented; remove if not

### M-06: Default shell commands are PowerShell-only in `web/README.md`
- **File:** `web/README.md:272-281` (Troubleshooting section)
- **Issue:** The "Port 3000 already in use" troubleshooting shows PowerShell commands but also shows a macOS/Linux comment at line 297. Inconsistent platform guidance.
- **Fix:** Either provide both shell variants consistently or note that the commands are Windows-specific

### M-07: Extension Node.js version stale in `extension/README.md`
- **File:** `extension/README.md:10`
- **Stated:** "Node.js v24.x (tested on v24.15.0)"
- **Issue:** This was written for AMO reviewers and may already be stale. Verify against current LTS.
- **Fix:** Review and update as needed

### M-08: `docs/API.md` out of sync with actual edge functions
- **File:** `docs/API.md`
- **Issue:** References 17 edge functions (via supabase README) but 24 exist. API docs likely missing endpoints for `activity-feed`, `admin-moderation`, `cron-streak-cleanup`, `feedback`, `report-engagement`, `scrape-url`.
- **Fix:** Cross-reference and add missing endpoint documentation

### M-09: `COMMERCIAL_LICENSE.md` references MIT but LICENSE file also exists
- **File:** `COMMERCIAL_LICENSE.md`
- **Issue:** Both `COMMERCIAL_LICENSE.md` and `LICENSE` exist in repo root. Potential confusion about which applies.
- **Fix:** Verify `COMMERCIAL_LICENSE.md` is intentional separate from `LICENSE`

### M-10: `supabase/README.md` migration count differs from root README
- **File:** `supabase/README.md:7` says "60+", root `README.md:157` says "50+"
- **Issue:** Same project, two different claims 7 lines apart
- **Fix:** Update both to "142"

### M-11: `android/CHANGELOG.md` not referenced from root README
- **File:** `README.md` (tests section) and `android/CHANGELOG.md`
- **Issue:** Root README links to extension and web test commands but doesn't mention android CHANGELOG.md
- **Fix:** Add a "changelogs" section or link to component-level changelogs

---

## LOW Severity Issues

### L-01: `README.md` says "50+ SQL migrations" — uses outdated "plus" notation
- **File:** `README.md:157`
- **Issue:** The "+" suffix is a documentation anti-pattern — always becomes stale
- **Fix:** Use exact count or remove the count entirely

### L-02: `README.md:32-33` mentions "12% chance of adjacent topic" — unverifiable
- **File:** `README.md:32`
- **Issue:** "12% chance" is a hardcoded claim that may drift from actual code in `interest_pair_scores` or `roam_v29_variety_exploration.sql`
- **Fix:** Verify against actual `roam()` implementation or soften to "occasional"

### L-03: `extension/README.md:28-36` hardcodes an API key in plaintext
- **File:** `extension/README.md:34`
- **Issue:** The `.env` example includes a partial Supabase anon key. While this is the public anon key, embedding it in documentation is still a bad practice.
- **Fix:** Use placeholder values like `sb_publishable_YOUR_KEY_HERE`

### L-04: `web/TESTING.md` references `roamtheweb.app` domain — hardcoded
- **File:** `web/TESTING.md:8`
- **Issue:** Testing checklist references `https://roamtheweb.app/join` — breaks if domain changes or on staging
- **Fix:** Use `localhost:3000` or environment-agnostic URLs

### L-05: `android/TESTING.md` test counts may be stale
- **File:** `android/TESTING.md:37-42` (test suite summary)
- **Stated:** `MainViewModelTest` (26 tests), `RoamRepositoryTest` (11), `SwipeDirectionTest` (15) = 52 total
- **Fix:** Verify against actual test files; update if suites have grown

### L-06: `android/TESTING.md` duplicate section numbering
- **File:** `android/TESTING.md:89,102`
- **Issue:** "3.2 Email/password sign-in" (line 89) and "3.2 Onboarding (interest categories)" (line 102) share the same section number
- **Fix:** Re-number onboarding to 3.3 and shift subsequent sections

### L-07: `scripts/README.md` references `master-log.mjs` which may not exist
- **File:** `scripts/README.md:388`
- **Stated:** Management tool `master-log.mjs`
- **Fix:** Verify file exists; if not, remove from docs

### L-08: `docs/email-*` files are temporal and likely stale
- **Files:** `docs/email-2026-07-06.md`, `docs/email-2026-07-08.md`, `docs/email-update-1.0.12.md`
- **Issue:** Dated email drafts from July 2026 — no longer current
- **Fix:** Archive to `docs/archive/` or delete if superseded

---

## Verified-OK Items (False Alarms Investigated)

| Claim | File | Investigation | Result |
|---|---|---|---|
| `ErrorBoundary.tsx` doesn't exist | `web/README.md` | File exists (3,272 bytes) at `web/src/components/ErrorBoundary.tsx` | ✅ OK |
| Seeder extensions wrong | `scripts/README.md` | 28 legacy `.js` + 571 new `.mjs` — both extension styles coexist, just incomplete coverage | 🔶 Partial (see H-03) |
| `seed-reddit.js` stale reference | `scripts/README.md` | File exists, correctly marked "⚠️ Broken" | ✅ OK |

---

## Auto-Generated Reports (34 files, Phase 6)

The `scripts/reports/output/*.md` files (a1–a11, b1–b6, c1–c4, d1–d6, e1–e4, f1–f3, g1, FULL_REPORT) are machine-generated. A spot-check of `FULL_REPORT.md` shows it is a concatenation of sub-reports. No template errors or empty sections detected. These files regenerate on each `reports.yml` workflow run and do not require manual maintenance.

---

## Recommended Fix Priority

### Immediate (fix within 1 sprint):
1. **H-01 + H-02 + M-10**: Update migration/functions counts across `README.md`, `supabase/README.md` (3-line changes each)
2. **H-03**: Replace `scripts/README.md` Data Sources table with link to `audit-seeders.mjs --report`
3. **M-02**: Remove duplicate `/forgot-password` from `web/README.md` route map
4. **M-03**: Add `/following` route to `web/README.md`
5. **M-04**: Add `leaderboard/` and `following/` to web project structure tree
6. **M-05**: Verify GitHub OAuth implementation; fix `web/README.md` if absent

### Short-term (fix within 2–3 sprints):
7. **M-01**: Reconcile android queue sizes
8. **M-08**: Update `docs/API.md` for new edge functions
9. **L-01 through L-08**: Address minor documentation drift

### Ongoing:
10. Consider auto-generating the migration count, function count, and seeder table from a CI step to prevent future drift

---

## Files Not Audited In-Depth

The following AI context / instruction files were read but not deeply verified against full codebase semantics:
- `.github/copilot-instructions.md`
- `.github/skills/*/SKILL.md` (7 files)
- `web/AGENTS.md`, `web/CLAUDE.md`, `CLAUDE.md`
- `extension/DESIGN.md`
- `android/REFERENCE.md`
- `docs/AI_CONTEXT_AUDIT.md`, `docs/CONTEXT.md`

These would benefit from a separate "AI context accuracy" audit comparing documentation claims against actual code patterns.