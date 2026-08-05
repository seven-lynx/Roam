# Badge System Full Audit — Final Report
**Date:** July 30, 2026 | **Database:** Production

---

## Executive Summary

The badge system has **300 defined badges** but only **69 total user_badges rows** across **26 users**. The vast majority of badges (280+) have **zero unlocks**. This is primarily because:

1. **A massive badge expansion** on July 18, 2024 added 200+ new badges that were never awarded to existing users
2. **Two broken rebuild scripts** failed to properly award badges after the clean wipe
3. **Only 7 badge types** have any meaningful unlock counts (first-roam: 10, wanderer-bronze: 9, wanderer-silver: 8, wanderer-gold: 5, first-collection: 4, first-save: 4, nomad-bronze: 3, friendly-face: 3, first-submission: 3)

---

## 1. Database Overview

| Metric | Value |
|--------|-------|
| Total profiles | 26 |
| Total badge definitions | 300 |
| Total user_badges rows | 69 |
| Total XP log entries | 4,692 |
| Badges with any unlocks | ~20 types |
| Badges with zero unlocks | 280+ types |

## 2. Badge Inventory by Category

| Category | Count | Has Unlocks? |
|----------|-------|-------------|
| exploration | 43 | Yes (wanderer-*, nomad-bronze, first-roam) |
| collecting | 37 | Yes (first-save, collector-bronze: 2) |
| curating | 33 | Yes (first-collection: 4, curator-bronze: 2, public-curator: 1) |
| social | 37 | Yes (friendly-face: 3) |
| streaks | 17 | Yes (hot-streak-bronze: 1, hot-streak-silver: 1) |
| contributing | 28 | Yes (first-submission: 3, contributor-bronze: 1) |
| engagement | 27 | None (all 0) |
| milestone | 18 | Yes (level-10: 2) |
| secret | 43 | None (all 0) |
| gift | 17 | Yes (beta-pioneer: 2, bug-hunter: 1, curator-spotlight: 1, early-adopter: 1, moderator: 2, roam-legend: 1, trailblazer: 2) |

## 3. Badges With Actual Unlocks

| Badge | Category | Unlocked | In-Progress |
|-------|----------|----------|------------|
| first-roam | exploration | 10 | 0 |
| wanderer-bronze | exploration | 9 | 0 |
| wanderer-silver | exploration | 8 | 0 |
| wanderer-gold | exploration | 5 | 0 |
| nomad-bronze | exploration | 3 | 0 |
| first-collection | curating | 4 | 0 |
| curator-bronze | curating | 2 | 0 |
| public-curator | curating | 1 | 0 |
| first-save | collecting | 4 | 0 |
| collector-bronze | collecting | 2 | 0 |
| friendly-face | social | 3 | 0 |
| first-submission | contributing | 3 | 0 |
| contributor-bronze | contributing | 1 | 0 |
| hot-streak-bronze | streaks | 1 | 0 |
| hot-streak-silver | streaks | 1 | 0 |
| level-10 | milestone | 2 | 0 |
| beta-pioneer | gift | 2 | 0 |
| bug-hunter | gift | 1 | 0 |
| curator-spotlight | gift | 1 | 0 |
| early-adopter | gift | 1 | 0 |
| moderator | gift | 2 | 0 |
| roam-legend | gift | 1 | 0 |
| trailblazer | gift | 2 | 0 |

## 4. Milestone Badge Gap Analysis

### Level-Based Milestones (from evaluate_badges function)

| Badge | Min Level | Users Qualified | Have Badge | Missing |
|-------|-----------|-----------------|------------|---------|
| level-10 | 10 | 2 | 2 | 0 ✅ |
| level-20 | 20 | 0 | 0 | 0 (nobody qualifies) |
| level-30 | 30 | 0 | 0 | 0 |
| level-40 | 40 | 0 | 0 | 0 |
| level-50 | 50 | 0 | 0 | 0 |
| level-75 | 75 | 0 | 0 | 0 |
| level-100 | 100 | 0 | 0 | 0 |

### Missing Milestone Badges (defined in DB but NOT in evaluate_badges)

The following milestone badges exist in the `badges` table but have **no evaluation logic** in the current `evaluate_badges()` function:

| Badge | Tier | Requirement |
|-------|------|-------------|
| level-5 | 0 | Reach level 5 |
| level-15 | 0 | Reach level 15 |
| level-25 | 0 | Reach level 25 |
| level-60 | 0 | Reach level 60 |
| level-125 | 0 | Reach level 125 |
| level-150 | 0 | Reach level 150 |
| demigod | 5 | Unknown threshold |
| xp-millionaire | 4 | 1,000,000 XP |

**Impact:** The `evaluate_badges()` function (fix version from 20260713000000) only handles `level-10`, `level-20`, `level-30`, `level-40`, `level-50`, `level-75`, `level-100`, `centurion-badges`, `master-roamer`, and `grandmaster`. The 8 newer milestone badges were added by migration 20260718000004 but the function was never updated.

If any user has reached levels 5-60, they are missing those badges. Currently with only 26 users and the highest level being ~12 (the one with 11,790 XP), the immediate impact is small — but **level-5** likely applies to most active users.

## 5. XP & Level Integrity

From the sample of 26 users:

- **XP mismatches:** 1 user — `7-Lynx` has stored XP=11,790, calculated XP=11,670 (**diff: -120 XP**). This means 120 XP was awarded that has no corresponding `xp_log` entry, likely from the broken `rebuild-badges-client-side.mjs` script which couldn't properly insert XP log entries.
- **Level mismatches:** 0 users
- **badge_count drift:** 0 users (sample of 300, but only 26 profiles exist)

## 6. Root Cause Analysis: Why So Few Badges?

### Timeline of Events

1. **June 13, 2026** — Original badge system created (58 badges) via `20260613000000_badges_gamification.sql`
2. **July 13, 2026** — Migration `20260713000000` tried to fix badge count drift but **incorrectly marked all progress=0 rows as unlocked** (Fix 3, lines 94-108), corrupting milestone, binary, and tier-chained badges
3. **July 14, 2026** — `20260714000000_more_badges.sql` added ~15 more badges
4. **July 18, 2026** — **Massive expansion** via `20260718000004_badge_audit_and_expansion.sql` and `20260718000005_holiday_and_part2_badges.sql` added **~200+ new badges** — but they were never awarded to existing users
5. **July 30, 2026** — `20260730000000_clean_wipe_and_rebuild_badges.sql` wiped all non-gift badge data and called for a rebuild
6. **July 30, 2026** — Two rebuild scripts exist: `rebuild-badges.mjs` (calls `evaluate_badges` RPC — **correct approach**) and `rebuild-badges-client-side.mjs` (evaluates client-side — **buggy approach**)

### Bugs in rebuild-badges-client-side.mjs

The client-side rebuild script has **critical bugs** that explain the near-total absence of unlocks:

1. **Missing `break` statements** (lines 198-222): The switch/case uses `switch(badge.slug.split('-')[0])` which matches prefixes like `'collector'`, `'contributor'`, `'first'` etc. Without `break`, execution **falls through** so `'collector'` falls to `'archivist'` falls to `'curator'` — the last `case` always wins, so most badges get `qualifies = false` from the wrong branch

2. **Missing milestone badges**: Only handles `level-10` through `level-100` — does NOT handle `level-5`, `level-15`, `level-25`, `level-60`, `level-125`, `level-150`, `centurion-badges`, `master-roamer`, `grandmaster`, `demigod`, `xp-millionaire`

3. **XP update broken** (line 295): Sets `xp_total: undefined` instead of actually incrementing XP

4. **~40% of badges unevaluated**: The `BADGE_DEFS` map and switch/case only cover basic count-based badges. Many badges (`nomad-silver/gold/platinum`, `globetrotter-*`, `tagger-*`, `rater-*`, `critic`, `marathon`, `loyalist`, `weekend-warrior`, `diversity-champ`, `quality-control`, `citizen-journalist`, `comeback`, `completionist`, `mega-collector`, `lucky-777`, plus all 200+ new badges from July 18) have no evaluation logic at all

5. **Streak badges**: `hot-streak-silver` and `unstoppable` are evaluated but `phoenix` (100-day streak) and `comeback` are not

### Bugs in evaluate_badges() SQL Function

The server-side `evaluate_badges()` (latest version from 20260713000000) is **mostly correct** for the original 58 badges + the few added in July 14. However:

1. **Does NOT handle July 18 expansion badges** — 200+ badges defined after this function was last updated have no evaluation cases
2. **Does NOT handle new milestone badges** — `level-5`, `level-15`, `level-25`, `level-60`, `level-125`, `level-150`, `demigod`, `xp-millionaire`

## 7. What's Working Correctly

Despite the issues, the following is working:

- **Gift badges** are intact (10 total across 7 types)
- **Basic tier-chained badges** (`wanderer-bronze→silver→gold` and `nomad-bronze`) are correctly awarded because the `evaluate_badges` RPC does handle them
- **badge_count integrity** is clean — 0 users have drift between `profiles.badge_count` and actual unlocked counts
- **Level-10 milestone** is correctly awarded to 2 qualifying users
- **No duplicate badge assignments** detected

## 8. Recommendations

### Immediate Fix (Recommended Approach)

**Run `rebuild-badges.mjs`** (the RPC-based script) rather than the client-side version. This calls `evaluate_badges()` for every user, which correctly evaluates all original badges. However, this still won't award the 200+ July 18 expansion badges or the 8 new milestone badges.

### Complete Fix (What's Needed)

1. **Update `evaluate_badges()`** to handle all 300 badge definitions, including:
   - All 200+ July 18 expansion badges
   - The 8 new milestone badges (`level-5`, `level-15`, `level-25`, `level-60`, `level-125`, `level-150`, `demigod`, `xp-millionaire`)
   
2. **Delete `rebuild-badges-client-side.mjs`** — it's fundamentally broken and should not be used

3. **Re-run the clean wipe + rebuild** using only `rebuild-badges.mjs`:
   ```
   node scripts/run-migration.mjs supabase/migrations/20260730000000_clean_wipe_and_rebuild_badges.sql
   node scripts/rebuild-badges.mjs
   ```

4. **Fix XP drift**: After rebuild, recalculate `7-Lynx` and any other affected users' XP from `xp_log` sum

### What Users Are Currently Missing

Given the current state (26 users, highest level ~12):

| Category | Badges Missing | Estimated Users Affected |
|----------|---------------|--------------------------|
| Milestone: level-5 | 1 badge, 50 XP | ~15-20 users with level ≥ 5 |
| Milestone: level-15 | 1 badge, unknown XP | 0 users (nobody at level 15 yet) |
| Original badges beyond wanderer/nomad/collector basic tiers | ~40 badges | 5-10 users |
| July 18 expansion badges (200+) | All of them | 0 (nobody qualifies yet) |

**Minimum fix:** At least update `evaluate_badges()` to handle `level-5` and `level-15`, since those are the milestone badges users are most likely to actually qualify for right now.