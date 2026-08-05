# Gamification Roadmap

**Last updated:** August 4, 2026
**See also:** [Badge System Architecture](BADGE_SYSTEM_ARCHITECTURE.md) | [AI Handoff: Badges](AI_HANDOFF_BADGES.md)

---

## Overview

This document outlines the next phase of Roam's gamification system. It covers seven improvement areas: challenges, XP tuning, reliability hardening, existing gap filling, new badges, UX improvements, and a phased implementation plan.

---

## 1. Challenge System

A new daily/weekly/monthly challenge layer that gives users concrete goals beyond passive badge hunting.

### 1.1 Data Model

```sql
-- Challenge pool (pre-defined catalog)
CREATE TABLE public.challenges (
  id UUID PRIMARY KEY,
  challenge_type TEXT NOT NULL CHECK (challenge_type IN ('daily','weekly','monthly')),
  challenge_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  goal_description TEXT,
  goal_count INT NOT NULL,
  xp_reward INT NOT NULL DEFAULT 50,
  condition_type TEXT NOT NULL,   -- 'roam_count','save_count','category_count','rate_count',
                                    -- 'submit_count','domain_count','subcategory_count',
                                    -- 'follow_count','collection_count','streak_days',
                                    -- 'session_count','share_count','profile_view_count'
  category_filter UUID[] DEFAULT NULL,
  time_restriction TEXT DEFAULT NULL, -- 'morning','afternoon','evening','night','weekend'
  weight INT DEFAULT 1
);

-- Active challenge instances
CREATE TABLE public.challenge_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES public.challenges(id),
  challenge_type TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_global BOOLEAN DEFAULT FALSE,   -- TRUE = same for all users (weekly/monthly)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Per-user progress
CREATE TABLE public.user_challenges (
  user_id UUID REFERENCES public.profiles(id),
  instance_id UUID REFERENCES public.challenge_instances(id),
  progress_current INT DEFAULT 0,
  completed_at TIMESTAMPTZ DEFAULT NULL,
  completed_xp_awarded BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (user_id, instance_id)
);
```

### 1.2 Rotation Mechanics

| Cadence | Assignment | Rotation |
|---|---|---|
| **Daily** | Per-user, randomized at midnight UTC. Each user gets 1-3 challenges from the daily pool. | Weighted random draw, new set each midnight. |
| **Weekly** | One global set picked every Monday 00:00 UTC. All users share the same 3-5 challenges. | Rotates weekly. |
| **Monthly** | One global set picked every 1st of month. All users share the same 4-6 challenges. | Rotates monthly. |

### 1.3 Challenge Pool

#### Daily Challenges (18 — users draw 1-3 per day)

| Key | Goal | XP |
|---|---|---|
| `roam-10` | Roam 10 URLs | 50 |
| `roam-25` | Roam 25 URLs | 100 |
| `save-3` | Save 3 URLs | 60 |
| `category-hop-3` | Explore 3 different categories | 75 |
| `rate-5` | Rate 5 URLs | 40 |
| `morning-roam` | Roam 3 URLs before 10am | 70 |
| `night-roam` | Roam 3 URLs after 10pm | 70 |
| `domain-hop-5` | Visit 5 different domains | 60 |
| `subcategory-scout` | Explore 2 different subcategories | 80 |
| `lunch-roam` | Roam 5 URLs between 12-2pm | 65 |
| `save-variety` | Save from 2 different categories | 70 |
| `feedback-5` | Rate 5 URLs (any rating) | 50 |
| `collection-add` | Add 3 items to any collection | 75 |
| `share-1` | Share 1 URL | 50 |
| `session-stack` | Roam 20+ URLs in a single session | 100 |
| `follow-1` | Follow 1 new person | 60 |
| `submit-1` | Submit 1 URL | 80 |
| `profile-view-3` | View 3 different user profiles | 30 |

#### Weekly Challenges (8 — users draw 3-5, shared globally)

| Key | Goal | XP |
|---|---|---|
| `weekly-roam-50` | Roam 50 URLs | 200 |
| `weekly-save-20` | Save 20 URLs | 250 |
| `weekly-categories-8` | Explore 8 different categories | 300 |
| `weekly-follow-3` | Follow 3 new people | 200 |
| `weekly-submit-3` | Submit 3 URLs | 350 |
| `weekly-rate-25` | Rate 25 URLs | 200 |
| `weekly-subcategories-5` | Explore 5 different subcategories | 350 |
| `weekly-save-streak` | Save 1+ URL for 5 days | 400 |

#### Monthly Challenges (8 — users draw 4-6, shared globally)

| Key | Goal | XP |
|---|---|---|
| `monthly-roam-200` | Roam 200 URLs | 600 |
| `monthly-save-75` | Save 75 URLs | 750 |
| `monthly-categories-all` | Explore every category | 1000 |
| `monthly-followers-5` | Gain 5 new followers | 800 |
| `monthly-submit-10` | Submit 10 URLs | 1000 |
| `monthly-rate-100` | Rate 100 URLs | 700 |
| `monthly-streak-20` | Maintain a 20-day streak | 1200 |
| `monthly-save-diversity` | Save from 10 different categories | 1000 |

### 1.4 Cron Edge Function: `cron-daily-challenges`

Runs daily at 00:00 UTC:
1. **Daily:** For each user, delete expired challenges, draw 1-3 new ones from daily pool using weighted random
2. **Weekly (Monday):** Delete old global weekly challenges, draw 3-5 new ones, create one `challenge_instances` row per challenge with `is_global = true`
3. **Monthly (1st):** Same as weekly but for monthly pool and cadence

### 1.5 Challenge Completion

The existing `evaluate-badges` edge function gains a new section:
- Check `user_challenges` for unexpired, uncompleted challenges
- Compare `progress_current` to `goal_count`
- On completion: set `completed_at`, insert `xp_log` entry (`action = 'challenge_reward'`), set `completed_xp_awarded = true`
- Progress is incremented by the triggering edge function (roam, save-url, follow, etc.) after their primary action completes

### 1.6 Challenge-Related Badges (21 new)

| Slug | Name | Condition |
|---|---|---|
| `first-challenge` | First Challenge | Complete 1 challenge |
| `challenge-accepted` | Challenge Accepted | Complete 50 challenges |
| `challenge-master` | Challenge Master | Complete 250 challenges |
| `challenge-addict` | Challenge Addict | Complete 1000 challenges |
| `daily-devotion` | Daily Devotion | Complete 5 daily challenges |
| `daily-driver` | Daily Driver | Complete 25 daily challenges |
| `daily-dynamo` | Daily Dynamo | Complete 100 daily challenges |
| `weekly-warrior` | Weekly Warrior | Complete 5 weekly challenges |
| `weekly-champion` | Weekly Champion | Complete 25 weekly challenges |
| `weekly-legend` | Weekly Legend | Complete 50 weekly challenges |
| `monthly-mastery` | Monthly Mastery | Complete 3 monthly challenges |
| `monthly-mogul` | Monthly Mogul | Complete 12 monthly challenges |
| `overachiever` | Overachiever | Exceed challenge goal by 50%+ |
| `triple-threat` | Triple Threat | Complete daily + weekly + monthly in same day |
| `perfect-week` | Perfect Week | Complete ALL active weekly challenges |
| `perfect-month` | Perfect Month | Complete ALL active monthly challenges |
| `last-minute-save` | Last Minute Save | Complete challenge in final hour |
| `speed-challenger` | Speed Challenger | Complete daily challenge within 1 hour |
| `streak-challenger` | Streak Challenger | Complete 1+ challenge per day for 7 days |
| `january-grind` | January Grind | Complete 20 daily challenges in January |
| `challenge-hoarder` | Challenge Hoarder | Have 5+ active challenges and complete all |

---

## 2. XP Economy Tuning

### 2.1 Level Curve Adjustment

Current formula: `level = floor(sqrt(xp / 100)) + 1`

| Issue | Detail |
|---|---|
| Top user | Level 16 / ~25,000 XP |
| Level 50 | Requires 240,000 XP — effectively unattainable |
| Level 100 | Requires 980,000 XP |

**Suggestion:** Add a tiered formula that's gentler early and maintains challenge late:

```sql
CREATE OR REPLACE FUNCTION public.calculate_level(p_xp BIGINT) RETURNS INT
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_xp < 5000   THEN FLOOR(SQRT(p_xp::NUMERIC / 50))::INT + 1   -- easier early
    WHEN p_xp < 50000  THEN FLOOR(SQRT(p_xp::NUMERIC / 100))::INT + 1   -- original curve
    ELSE                     FLOOR(SQRT(p_xp::NUMERIC / 150))::INT + 1   -- steeper late
  END;
$$;
```

This makes level 20 reachable at ~18,000 XP instead of 36,000, while keeping level 100+ rare.

### 2.2 Variety Bonus XP

When a user roams a category they haven't visited in the last 24 hours, award +5 bonus XP. This incentivizes exploration breadth. Implementation is straightforward — check `user_daily_activity` for category presence before inserting the XP row.

### 2.3 Streak Protection (Freeze Tokens)

Users lose their entire streak after one missed day. Add "streak freeze" tokens:

- Award 1 freeze token at every 10th level (10, 20, 30, etc.)
- Award 1 freeze token for every 50th badge earned
- A freeze token is consumed when a day passes without activity — the streak stays frozen for 24-48 hours before resetting
- Store in `profiles.streak_freeze_tokens INT DEFAULT 0`
- `reset_stale_streaks()` checks freeze tokens before resetting

### 2.4 Level-Up Bonus

Already exists (50 × new_level XP). Consider scaling it:
- Levels 1-10: 50 × level
- Levels 11-25: 100 × level
- Levels 26+: 200 × level

This makes leveling up feel more impactful at higher levels.

---

## 3. Reliability Improvements

### 3.1 XP Consistency Cron

**Problem:** The recent bug was caused by `profiles.xp_total` drifting from `SUM(xp_log.xp_awarded)`.

**Fix:** A daily cron edge function (`cron-xp-consistency`) that:
1. Finds all profiles where `xp_total != COALESCE(SUM(xp_log.xp_awarded), 0)`
2. Realigns them: `UPDATE profiles SET xp_total = (SELECT SUM(...)), level = calculate_level(...)`
3. Logs to a `consistency_log` table and fires a Sentry alert if any mismatches found

### 3.2 Badge Award Idempotency

**Problem:** The edge function re-evaluates ALL badges on every invocation, doing ~30 parallel queries even for badges the user can't possibly earn.

**Fix:** Either:
- **(A)** Pass `trigger_action` parameter and only evaluate relevant badge categories (roam → exploration badges, save → collecting badges, etc.)
- **(B)** Add early-exit guards: skip streak badges if `streak < 3`, skip rating badges if no ratings exist, skip follower badges if followers = 0

Option B is simpler and can be done incrementally. Expected query reduction: 60-70%.

### 3.3 Deprecate SQL `evaluate_badges()` RPC

**Problem:** Two evaluators create drift risk. The SQL RPC covers ~60 badges and hardcodes many to `v_count := 0`. It's been accidentally invoked by old repair scripts.

**Fix:** After confirming the edge function is fully deployed and stable:
1. Drop the SQL function via migration
2. Delete `scripts/rebuild-badges.mjs` (depends on it)
3. Retire `scripts/repair-badges-v2.mjs` and `v3.mjs` (superseded by `repair-badges-comprehensive.mjs`)

### 3.4 Unified Repair Script

`scripts/repair-badges-comprehensive.mjs` is the single canonical repair tool. It handles all three phases (SQL clean wipe, edge function badge rebuild, verification) in one run with a `--dry-run` option. Future improvements:
- Add `--user <id>` flag to repair a single user
- Add `--badge-only` flag to skip XP/level recalibration
- Add `--resume` flag to continue from a partial run

---

## 4. Filling Existing Badge Gaps

### 4.1 The `qualifies = false` Badges (~18 badges)

These are defined in the DB and edge function but hardcoded to never award:

| Badge | What's Needed |
|---|---|
| `globetrotter-bronze/silver/gold/platinum` | COUNT DISTINCT `urls.domain` from `seen_urls` |
| `daily-double` | 2+ categories roamed in one day |
| `repeat-visitor` | Consecutive roams to same domain (session-based) |
| `domain-hoarder` | COUNT DISTINCT URL IDs saved |
| `pinball-wizard` | Consecutive saves with interleaved categories |
| `jet-setter` | Roam 100+ distinct domains (lifetime) |
| `pack-rat-bronze/silver/gold` | MAX items in any single collection |
| `curators-eye` | Same URL in 3+ different collections |
| `niched-down` | All collections share a category |
| `linker` | Collection with items linked by domain |
| `micro-curator` | Collection with exactly 3 items |
| `mega-collection` | Collection with 100+ items |
| `solo-artist` | Collection no one else has favorited |
| `weekly-publisher` | Create a new collection every week for 4 weeks |
| `collection-streak` | Add items to a collection daily for 14 days |
| `daily-curation` | Curate a collection item daily for 10 days |
| `rate-everything` | Rate a URL in every category |
| `rate-spree` | Rate 25+ URLs in one day |
| `the-completionist-rate` | Rate every URL you've ever roamed (min 50) |

Most are fixable with simple queries. The complex ones (collection analysis, cross-collection) are better suited for batch repair than real-time evaluation.

### 4.2 Badge Progress in UI

**Data exists:** `user_badges.progress_current` tracks progress toward the next threshold.

**What's needed:** A "Badges in Progress" section on the profile page showing:
- Badge icon, name, and "8/10 roams toward Wanderer Bronze"
- A small progress bar
- Sorted by closest to completion first

This drives engagement — users chase what they can see. Implementation requires:
- A new `get_user_badges_in_progress` RPC or API endpoint
- A `BadgeProgressCard` React component
- Adding it to `ProfileClient.tsx` / `YouScreen.kt`

---

## 5. New Badges (58 total — zero overlap with existing catalog)

### 5.1 Domain & Discovery Badges (8)

| Slug | Name | Condition |
|---|---|---|
| `domain-collector-50` | Domain Collector | Save from 50 different domains |
| `domain-collector-100` | Domain Hoarder | Save from 100 different domains |
| `domain-collector-500` | Domain Emperor | Save from 500 different domains |
| `obscure-find` | Obscure Find | Save a URL that no other user has saved |
| `trend-setter` | Trend Setter | Save a URL that 10+ other users later save |
| `around-the-world` | Around the World | Save URLs in 10+ different languages |
| `top-level-tourist` | TLD Tourist | Visit domains with 15+ different TLDs (.com, .org, .io, .edu, etc.) |
| `deep-web-diver` | Deep Web Diver | Roam 10 URLs from domains with fewer than 5 total roams |

### 5.2 Time & Day Badges (5)

| Slug | Name | Condition |
|---|---|---|
| `monday-ritual` | Monday Ritual | Roam every Monday for 8 consecutive weeks |
| `sunday-funday` | Sunday Funday | Roam 20+ URLs on a Sunday |
| `seasonal-roamer` | Seasonal Roamer | Roam on the first day of spring, summer, fall, and winter |
| `leap-day` | Leap Day | Roam on February 29 |
| `midnight-oil` | Midnight Oil | Roam 30+ URLs between midnight and 3am in a single session |

### 5.3 Niche & Deep-Dive Badges (5)

| Slug | Name | Condition |
|---|---|---|
| `submerged` | Submerged | 100+ roams in a single category |
| `double-major` | Double Major | 50+ saves each in 2 different categories |
| `specialist` | Specialist | 80%+ of total saves are in a single category |
| `tab-hoarder` | Tab Hoarder | Save 10 URLs in 10 minutes |
| `mood-reader` | Mood Reader | Roam in 5+ different categories within an hour |

### 5.4 Social Discovery Badges (4)

| Slug | Name | Condition |
|---|---|---|
| `gateway-friend` | Gateway Friend | Get followed by someone who then follows 3+ others within a week |
| `mention-magnet` | Mention Magnet | Have your profile viewed by 50+ unique users |
| `collection-contributor` | Collection Contributor | Add a URL to someone else's public collection that gets 5+ favorites |
| `second-degree` | Second Degree | Save a URL that someone you follow saved earlier that same day |

### 5.5 Strange & Niche Stat Badges (7)

| Slug | Name | Condition |
|---|---|---|
| `equal-opportunity` | Equal Opportunity | Exactly 50% upvotes, 50% downvotes (min 20 ratings) |
| `the-librarian` | The Librarian | Exactly 42 total lifetime saves |
| `lucky-13` | Lucky 13 | Roam exactly 13 URLs in one day |
| `round-number` | Round Number | Land exactly on a multiple of 500 XP |
| `every-letter` | Every Letter | Save from 26 domains starting with different letters (a-z) |
| `centennial` | Centennial | Be the 100th saver of a URL in a particular domain |
| `ghost` | Ghost | No profile picture, no bio, no display name — but 100+ roams |

### 5.6 Streak Recovery Badges (3)

| Slug | Name | Condition |
|---|---|---|
| `streak-revival` | Streak Revival | Lose a 30+ day streak and rebuild to 7+ within 2 weeks |
| `phoenix-rising` | Phoenix Rising | Lose a streak 3+ times and rebuild to 7+ each time |
| `unbreakable` | Unbreakable | Never had a streak reset in 180 days of activity |

### 5.7 Expressive & Quirky Badges (5)

| Slug | Name | Condition |
|---|---|---|
| `one-of-everything` | One of Everything | Roam + save + rate + submit + follow + create collection all in one day |
| `rate-sage` | Rate Sage | Rate exactly 1 URL per day for 10 consecutive days |
| `clean-slate` | Clean Slate | Delete all saved URLs and rebuild to 50+ within 30 days |
| `night-shift` | Night Shift | 80%+ of total roams occur between 10pm and 6am |
| `zero-waste` | Zero Waste | Rate every URL you roamed in a day (no skips) — 10+ URLs |

### 5.8 Challenge Badges

See Section 1.6 above (21 badges already listed).

---

## 6. UX Improvements

### 6.1 Badge Unlock Fun-Factor

Current toast notifications are functional. Suggestions:
- **Confetti animation** on badge unlock (especially milestone/rare badges)
- **Rarity indicator** on badge display: Common / Rare / Epic / Legendary based on `unlock_percentage * xp_reward`
- **"How to earn" tooltip** on locked badges showing progress and conditions

### 6.2 Level-Up Celebration

When a user levels up:
- Show a interstitial animation with the new level number
- Display "XP needed to next level" prominently
- List any newly unlocked milestone badges

### 6.3 Challenge UI

- **Daily challenge widget** on the home screen showing active challenges with progress bars
- **Weekly/monthly challenge tracker** on the profile page
- **"Challenge complete!" toast** with XP earned
- **Challenge history** — a list of recently completed challenges with dates

### 6.4 Leaderboard Enhancements

- **Weekly challenge leaderboard** — who completed the most challenges this week
- **Category-specific leaderboards** — top roamer in Science, Arts, etc.

---

## 7. Implementation Phases

### Phase 1: Foundation & Reliability (1-2 weeks)

| Task | Effort |
|---|---|
| Add XP consistency cron (`cron-xp-consistency`) | Small |
| Add early-exit guards to `evaluate-badges` edge function | Small |
| Fill `qualifies = false` simple badges (globetrotter-*, daily-double, etc.) | Medium |
| Add `--user` and `--badge-only` flags to repair script | Small |
| Deploy and run full repair to award newly-fillable badges | Small |

### Phase 2: Challenge System (2-3 weeks)

| Task | Effort |
|---|---|
| Create `challenges`, `challenge_instances`, `user_challenges` tables (migration) | Small |
| Create challenge pool seed data (migration with 34 INSERTs) | Small |
| Build `cron-daily-challenges` edge function | Medium |
| Add challenge progress tracking to action edge functions (roam, save-url, follow, etc.) | Medium |
| Add challenge completion logic to `evaluate-badges` | Medium |
| Add 21 challenge-related badges to `badges` table | Small |
| Basic challenge UI (daily widget on home screen) | Medium |

### Phase 3: XP Tuning & New Badges (1-2 weeks)

| Task | Effort |
|---|---|
| Implement tiered level curve formula | Small |
| Add variety bonus XP to roam function | Small |
| Add streak freeze tokens (table + cron + edge fn logic) | Medium |
| Insert 37 new non-challenge badges into `badges` table | Small |
| Add evaluation logic for new badges in edge function | Large |
| Run full repair to award new badges | Small |
| Level-up UX improvements (celebration, progress) | Medium |

### Phase 4: Polish & Retention (1-2 weeks)

| Task | Effort |
|---|---|
| Badge progress visibility in UI (progress bars) | Medium |
| Challenge history and stats | Medium |
| Badge unlock confetti / animations | Small |
| Leaderboard enhancements | Medium |
| Deprecate SQL `evaluate_badges()` RPC | Small |
| Clean up old repair scripts | Small |

---

## Summary

| Category | Count |
|---|---|
| Challenge types (total) | 34 |
| Challenge badges | 21 |
| Domain/discovery badges | 8 |
| Time/day badges | 5 |
| Niche/deep-dive badges | 5 |
| Social discovery badges | 4 |
| Strange/niche stat badges | 7 |
| Streak recovery badges | 3 |
| Expressive/quirky badges | 5 |
| Filled existing gaps | ~18 |
| **Total new badges** | **58** |
| **Total badges post-implementation** | **~358** |

The challenge system creates a daily engagement loop independent of badge hunting. Combined with XP tuning that makes progression feel fair and new badges that reward diverse playstyles, this transforms gamification from a passive "numbers go up" system into an active motivator.