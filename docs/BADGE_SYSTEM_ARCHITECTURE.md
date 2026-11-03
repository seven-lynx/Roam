# Badge System Architecture

Last updated: 2026-11-03

## Overview

The badge system awards badges based on user activity (roaming, saving, curating, contributing, social, streaks, curiosity, and games). Every awardable action funnels XP through a single unified primitive, `apply_xp()`, and the canonical `evaluate-badges` edge function grants any newly earned badges. Badges and actions all feed the same Roam XP economy — there is no separate "game XP" or per-category ledger.

---

## Data Flow

```
User Action (roam, save, follow, submit, share, rate, collect, game, …)
         │
         ▼
Edge Function (save-url, follow, submit-url, share-url, rate, collection, game-action, …)
         │
         ├──► apply_xp()            ← the ONLY XP writer (service role)
         │      ├──► xp_log INSERT (idempotent, action string)
         │      ├──► user_daily_activity UPSERT
         │      └──► profiles.xp_total = SUM(xp_log)  +  profiles.level recalc
         │
         └──► evaluate-badges edge function (fire-and-forget)
                ├──► user_badges UPSERT (newly earned badges)
                ├──► apply_xp('badge_rewards', …) (badge XP)
                ├──► sync_profile_badge_count()
                └──► challenge completion check → apply_xp('challenge_reward', …)
```

---

## Core Tables

| Table | Purpose | Key Columns |
|---|---|---|
| `profiles` | User profiles with derived stats | `xp_total`, `level`, `badge_count`, `streak_days` |
| `xp_log` | **Single source of truth** for XP | `user_id`, `action`, `xp_awarded`, `metadata`, `idempotency_key` |
| `xp_actions` | Fixed per-action XP lookups | `action`, `xp`, `description` |
| `badges` | Badge definitions | `slug`, `name`, `xp_reward`, `category`, `required_count`, `parent_badge_slug` |
| `user_badges` | Which badges each user has | `user_id`, `badge_id`, `unlocked_at`, `progress_current` |
| `user_actions` | Audit trail + challenge progress | `user_id`, `action_type`, `metadata` |
| `user_daily_activity` | Per-day counts + XP for streak/session badges | `user_id`, `date`, `roam_count`, `save_count`, `xp_earned` |

### Derived Fields

- **`profiles.xp_total`** = `SUM(xp_log.xp_awarded)` for that user — **re-derived on every `apply_xp()` call**, never independently maintained
- **`profiles.level`** = `FLOOR(SQRT(xp_total / 100)) + 1`
- **`profiles.badge_count`** = `COUNT(user_badges)` where `unlocked_at IS NOT NULL`

The SQL function `public.calculate_level(xp BIGINT)` implements the level formula:
```sql
FLOOR(SQRT(p_xp::NUMERIC / 100))::INT + 1
```

---

## XP Economy

### `apply_xp()` — the single XP writer

**Signature:** `public.apply_xp(p_user_id UUID, p_action TEXT, p_xp INT, p_metadata JSONB, p_idempotency_key TEXT)`

- **Service-role only** (`REVOKE … FROM PUBLIC, anon, authenticated`, `GRANT … TO service_role`). Clients cannot call it directly.
- **Idempotent** via `p_idempotency_key` (1-hour dedupe window) — retries/restarts can't double-award.
- **Self-healing** — every award recomputes `xp_total = SUM(xp_log)` and `level = calculate_level(xp_total)`, so drift can't accumulate.
- **Clamped** to `[1, 1000]` XP per call so a runaway score can't mint unbounded XP.
- **Side effects** — upserts `user_daily_activity.xp_earned` and emits a `level_up` notification when the level increases.

### `award_xp()` — fixed-lookup wrapper

`public.award_xp(p_user_id, p_action, p_metadata, p_idempotency_key)` looks the action's XP up in `xp_actions` and delegates to `apply_xp()`. Exposed to `authenticated` + `service_role`; used by the primary-action edge functions.

### `game-action` — game XP entry point

The `game-action` edge function is the single entry for in-OS game XP. It records a `user_actions` row (`action_type = 'game'`) and calls `apply_xp()` with an action string `game:<id>:<kind>` — ordinary Roam XP, no separate economy.

### Fixed XP (`xp_actions`)

| Action | XP |
|---|---|
| `roam` (view URL) | 10 |
| `save_url` | 5 |
| `submit_url` | 25 |
| `submit_approved` (bonus) | 50 |
| `create_collection` | 20 |
| `add_to_collection` | 5 |
| `follow_user` | 5 |
| `gain_follower` | 10 |
| `share_url` | 5 |
| `rate_url` | 3 |
| `profile_complete` | 100 |
| `daily_roam_streak` | 15 |
| `collection_favorited` | 15 |

### Variable XP (via `apply_xp` directly)

| Event | XP |
|---|---|
| Game level clear (`game:<id>:level`) | 10 |
| Game win (`game:<id>:win`) | 100 |
| Game over bonus (`game:<id>:over`) | `min(500, floor(score / 10))`, only past level 100 |
| Badge earned (`badge_rewards`) | `badges.xp_reward` (varies) |
| Badge gifted (`badge_gifted`) | `badges.xp_reward` (varies) |
| Challenge complete (`challenge_reward`) | `challenges.xp_reward` (varies, default 50) |

### Arcade "win" definition

The four arcade games (RELAY / COMPILER / DEBRIS / FIREWALK) are endless, so a **win** is defined as clearing **level 10** (`WIN_LEVEL` in `web/src/lib/game-xp.ts`), which is near each game's difficulty cap. The text adventures (UNDERWEB / SUBSTRATE) emit `win` on completing the adventure. BOTFIELD (minesweeper) is not yet built, so `win-botfield` is seeded but not earnable.

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
- **Curiosity** — URL ratings (formerly `engagement`)
- **Games** — per-game win badges (`win-*`) and score milestones
- **Milestones** — level-based badges, total XP badges
- **Secret** — special conditions (error-404, etc.)

### Category taxonomy

`badges.category` is constrained to: `exploration`, `collecting`, `curating`, `social`, `streaks`, `contributing`, `curiosity`, `games`, `secret`, `milestone`, `gift`.

### Legacy SQL evaluator (removed)

The old SQL `public.evaluate_badges(UUID)` RPC was incomplete and buggy (hardcoded several badges to `0`, missing dozens of edge-function-only badges). It is **dropped** by migration `20261103000002_unify_xp_badges.sql`. The edge function is the only evaluator.

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

### Retired tools (deleted)

The following repair/rebuild scripts were superseded by `scripts/repair-badges-comprehensive.mjs` and have been **deleted**:

| Tool | Why removed |
|---|---|
| `repair-badges-v3.mjs` | Superseded by `repair-badges-comprehensive.mjs` |
| `rebuild-badges.mjs` | Broken (depended on the now-dropped SQL RPC) |
| `repair-badges-v2.mjs` | Superseded by `repair-badges-comprehensive.mjs` |
| `rebuild-badges-client-side.mjs` | Had critical bugs |

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
| `20260613000000_badges_gamification.sql` | Initial badge system: tables, `calculate_level()`, `award_xp()`, `grant_badge()`, `xp_log`, `xp_actions` seed |
| `20260715000000_add_xp_idempotency.sql` | Idempotency for XP awards |
| `20260728000000_effective_streak.sql` | `get_effective_streak()` RPC |
| `20260730000000_clean_wipe_and_rebuild_badges.sql` | Clean-wipe migration for badge repair |
| `20261009000000_challenge_reward_fixes.sql` | Challenge completion trigger + `completed_xp_awarded` flag |
| `20261103000000_award_game_xp.sql` | Variable game XP (retired by `_unify_xp_badges`) |
| `20261103000001_roll_badges.sql` | Cyberdeck Roll gallery badges (`roll-wallpaper`, `roll-rate-5`) |
| `20261103000002_unify_xp_badges.sql` | **Unified XP economy:** `apply_xp()`, `award_xp()` wrapper, `game` user_actions, game-win badge seeds, drops legacy SQL evaluator |

## Quick Reference

```bash
# Full badge repair (dry-run first)
node scripts/repair-badges-comprehensive.mjs --dry-run
node scripts/repair-badges-comprehensive.mjs

# Audit badge distribution
node scripts/audit-badges-full.mjs

# Deploy edge functions
npx supabase functions deploy evaluate-badges
npx supabase functions deploy game-action
```