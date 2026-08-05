# Badge System Architecture

Last updated: 2026-08-04

## Overview

The badge system awards badges to users based on their activity (roaming, saving, curating, contributing, social engagement, and streaks). Each badge grants XP, which contributes to the user's level.

---

## Data Flow

```
User Action (roam, save, follow, submit, etc.)
         │
         ▼
Edge Function (roam, save-url, follow, submit-url, etc.)
         │
         ├──► xp_log INSERT (XP awarded for the action itself)
         │
         └──► evaluate-badges edge function (fire-and-forget)
                    │
                    ├──► user_badges UPSERT (newly earned badges)
                    ├──► xp_log INSERT (badge XP rewards)
                    ├──► profiles.xp_total UPDATE (SUM of all xp_log entries)
                    ├──► profiles.level UPDATE (derived from xp_total)
                    └──► profiles.badge_count SYNC
```

---

## Core Tables

| Table | Purpose | Key Columns |
|---|---|---|
| `profiles` | User profiles with derived stats | `xp_total`, `level`, `badge_count`, `streak_days` |
| `xp_log` | **Single source of truth** for XP | `user_id`, `action`, `xp_awarded`, `metadata` |
| `badges` | Badge definitions | `slug`, `name`, `xp_reward`, `category`, `required_count`, `parent_badge_slug` |
| `user_badges` | Which badges each user has | `user_id`, `badge_id`, `unlocked_at`, `progress_current` |

### Derived Fields

- **`profiles.xp_total`** = `SUM(xp_log.xp_awarded)` for that user — **not independently maintained**
- **`profiles.level`** = `FLOOR(SQRT(xp_total / 100)) + 1`
- **`profiles.badge_count`** = `COUNT(user_badges)` where `unlocked_at IS NOT NULL`

The SQL function `public.calculate_level(xp BIGINT)` implements the level formula:
```sql
FLOOR(SQRT(p_xp::NUMERIC / 100))::INT + 1
```

---

## XP Economy

| Action | XP Awarded |
|---|---|
| Roam (view URL) | 10 XP |
| Save URL | 15 XP |
| Submit URL (approved) | 25 XP |
| Badge earned | Varies (set in `badges.xp_reward`) |
| Level up bonus | 50 × new_level |

XP is **idempotent** — the `xp_log` table has a unique constraint on `(user_id, action, metadata->>url_id, date_trunc('day', created_at))` to prevent double-counting.

---

## Badge Evaluation

### Canonical Evaluator: Edge Function

**File:** `supabase/functions/evaluate-badges/index.ts`

This is the **single authoritative badge evaluator**. It runs:
- **Real-time:** Fired asynchronously by other edge functions after user actions
- **Batch repair:** Called for every user via `scripts/repair-badges-comprehensive.mjs`

It handles ~150 badges across these categories:
- **Exploration** — roam count, session badges, time-of-day badges
- **Collecting** — save count, category diversity, save streaks
- **Curating** — collection count, public collections, collection favorites
- **Contributing** — submissions, approval rate, submission streaks
- **Social** — followers, following, mutual connections, profile completion
- **Streaks** — daily streak milestones
- **Milestones** — level-based badges, total XP badges
- **Engagement** — URL ratings
- **Secret** — special conditions (error-404, etc.)

### Legacy Evaluator: SQL RPC

**File:** `supabase/migrations/20260730000006_fix_ambiguous_columns.sql`

The SQL `evaluate_badges(p_user_id UUID)` function exists but is **less complete** — it evaluates ~60 badges and is missing dozens of edge-function-only badges (rating badges, session badges, time-based badges, tagger badges, etc.). It also hardcodes `rater-*` and several other badges to `v_count := 0`.

**Prefer the edge function** for all badge evaluation. The SQL RPC is retained for reference but should not be used for new badge logic.

---

## Repair Tools

### Primary: `scripts/repair-badges-comprehensive.mjs`

```bash
# Dry-run (no changes)
node scripts/repair-badges-comprehensive.mjs --dry-run

# Live repair
node scripts/repair-badges-comprehensive.mjs
```

**Phases:**
1. **Clean Wipe** (Management API SQL) — atomic `DO $$` block: backs up gift badges, wipes all non-gift badge data, cleans `badge_rewards` XP entries, recalculates `xp_total` and `level` from remaining `xp_log` entries
2. **Badge Rebuild** (HTTP) — calls the `evaluate-badges` edge function for every user in batches of 5
3. **Verify & Sync** (Management API SQL) — fixes badge counts, verifies XP ↔ `xp_log` consistency, realigns levels

### Audit: `scripts/audit-badges-full.mjs`

```bash
node scripts/audit-badges-full.mjs
```

Generates per-badge unlock counts and statistics.

### Superseded Tools

| Tool | Status | Replaced By |
|---|---|---|
| `scripts/repair-badges-v3.mjs` | Superseded | `scripts/repair-badges-comprehensive.mjs` |
| `scripts/rebuild-badges.mjs` | Broken (depends on SQL RPC) | `scripts/repair-badges-comprehensive.mjs` |
| `scripts/repair-badges-v2.mjs` | Superseded | `scripts/repair-badges-comprehensive.mjs` |
| `scripts/rebuild-badges-client-side.mjs` | Had critical bugs | `scripts/repair-badges-comprehensive.mjs` |

---

## Gift Badges

Badges with `is_gift_only = TRUE` are **never auto-awarded**. They are hand-granted by admins and are always preserved during clean wipes. The repair scripts back up gift badge assignments before wiping, then restore them afterward.

---

## Streaks

Streaks are managed by:
- **`profiles.streak_days`** — incremented daily when a user has activity
- **`public.reset_stale_streaks()`** — resets streaks to 0 for users whose last activity was >24 hours ago
- **`supabase/functions/cron-streak-cleanup/`** — scheduled edge function that calls `reset_stale_streaks()`

The `profile` edge function computes `effectiveStreak` via `get_effective_streak()` RPC, which checks if the user's last activity is within 24 hours before returning the streak count.

---

## Connection Methods

### Management API (for SQL when direct pg is unavailable)

Each call to `https://api.supabase.com/v1/projects/{ref}/database/query` is an **independent transaction**. Multi-step SQL must be wrapped in a `DO $$ ... END $$` block to maintain atomicity.

Requires `SUPABASE_ACCESS_TOKEN` (Personal Access Token from Supabase dashboard).

### Edge Functions

Called via HTTPS: `https://{projectRef}.supabase.co/functions/v1/{name}` with the service role key in the `Authorization` header.

### Direct PostgreSQL

```js
const PG_CONN = `postgresql://postgres.{projectRef}:{service_role_key}@db.{projectRef}.supabase.co:5432/postgres`;
```

Only works when DNS can resolve Supabase's direct database hostname. Falls back to Management API otherwise.

---

## Key Migrations

| Migration | Purpose |
|---|---|
| `20260613000000_badges_gamification.sql` | Initial badge system: tables, `calculate_level()`, `evaluate_badges()`, `grant_badge()`, `xp_log` |
| `20260715000000_add_xp_idempotency.sql` | Added unique constraint to `xp_log` to prevent duplicate XP |
| `20260728000000_effective_streak.sql` | Added `get_effective_streak()` RPC |
| `20260730000000_clean_wipe_and_rebuild_badges.sql` | Clean wipe migration for badge repair |
| `20260730000006_fix_ambiguous_columns.sql` | Latest SQL `evaluate_badges()` with column fixes |

## Quick Reference

```bash
# Full badge repair
node scripts/repair-badges-comprehensive.mjs

# Dry-run first
node scripts/repair-badges-comprehensive.mjs --dry-run

# Audit badge distribution
node scripts/audit-badges-full.mjs

# Deploy edge function
npx supabase functions deploy evaluate-badges