# AI Handoff: Badge System

**Last updated:** August 4, 2026  
**Project:** Roam (github.com/seven-lynx/Roam)

See also: **[Badge System Architecture](BADGE_SYSTEM_ARCHITECTURE.md)** for full data flow, XP economy, and architecture docs.

---

## Current State

### Data (as of Aug 4, 2026 repair)
- **85 badges** awarded across 9 users (75 new + 10 gift)
- **0 XP/level mismatches**, **0 badge_count drift**
- 27 users, avg XP 2,002, avg level 2.9, max level 16

### Canonical Architecture
- **Edge Function** (`supabase/functions/evaluate-badges/index.ts`) is the **single authoritative badge evaluator**
- **`xp_log` is the single source of truth for XP** — `profiles.xp_total` is derived via `SUM(xp_log.xp_awarded)`
- **Level formula:** `FLOOR(SQRT(xp_total / 100)) + 1`
- The SQL RPC `evaluate_badges()` exists but is less complete and should not be used for new badges

### Tools Built
| File | Purpose |
|------|---------|
| `scripts/repair-badges-comprehensive.mjs` | **Primary repair tool** — 3-phase atomic repair (SQL wipe → edge fn rebuild → verify). Run: `node scripts/repair-badges-comprehensive.mjs [--dry-run]` |
| `scripts/audit-badges-full.mjs` | Audit tool — generates per-badge unlock counts |
| `supabase/functions/evaluate-badges/index.ts` | **Real-time edge function** — canonical badge evaluator (~150 badges) |

### Edge Functions Deployed
- `evaluate-badges` — core engine called by other functions
- `roam` — calls evaluate-badges on boot (fire-and-forget)
- `save-url` — calls evaluate-badges on save
- `follow` — calls evaluate-badges for follower + followed user
- `cron-secret-badges` — scheduled daily for secret/holiday badges

### Tables
- `public.url_ratings (id, user_id, url_id, rating (-1/0/1), created_at)` — RLS + indexes
- `public.collection_favorites (id, user_id, collection_id, created_at)` — RLS + indexes
- `public.log_failed_urls (id, user_id, url, status_code, created_at)` — RLS + index

### Deprecated/Retired
- `scripts/repair-badges-v3.mjs` — superseded by `repair-badges-comprehensive.mjs`
- `scripts/repair-badges-v2.mjs` — superseded
- `scripts/rebuild-badges.mjs` — depends on broken SQL RPC
- `scripts/rebuild-badges-client-side.mjs` — had critical bugs

---

## Remaining Work (Prioritized)

### P1: Rating badges already in edge function
Rating badges (`rater-*`, `critic`, `feedback-loop`, `voting-power`, `the-equalizer`, `non-committal`, `morning-rater`, `rate-streak`, `rate-by-category`, `downer`) are implemented in the edge function but need `url_ratings` data to be populated by users. No code changes needed — just user adoption.

### P2: Complex batch-repair badges (~8 badges)
Badges that need additional logic beyond what the edge function does in real-time:
- `pack-rat-*` — max items in any single collection
- `curators-eye`, `niched-down`, `linker` — cross-collection analysis
- `micro-curator`, `mega-collection`, `solo-artist` — collection stats
- `weekly-publisher`, `collection-streak`, `daily-curation` — time-based curation

### P3: SQL-Aggregatable Badges (~15 badges)
Badges that need batch-only evaluation (too expensive for real-time edge fn):
- `tagger-*`, `tag-master` — COUNT DISTINCT category_id from saved_urls
- `completionist`, `save-streak`, `language-collector`
- `collectors-collector`, `weekly-collector`, `long-term-storage`
- `submission-streak`, `approval-streak`, `weekend-submitter`
- `error-404-explorer`, `domain-hoarder`, `pinball-wizard`, `jet-setter`
- `daily-double`, `repeat-visitor`, `globetrotter-*`, `rate-everything`, `rate-spree`, `the-completionist-rate`

### P4: Share Tracking (12 badges)
Create `share_events` table then add evaluation for: `viral-*`, `first-share`, `broadcaster`, `chatterbox`, `share-happy-hour`.

### P5: Cleanup
Delete failed migration attempts (`20260730000002` through `00005`). Keep `00006` and `00000`.

---

## Key Code Patterns

### How to add a badge to the edge function
```js
case "badge-slug": {
  // Simple count-based:
  // const { count: c } = await sb.from("table").select("*", { count: "exact", head: true }).eq("user_id", user_id);
  // qualifies = (c ?? 0) >= required_count;
  
  // More complex:
  // const { data: d } = await sb.from("table").select("col").eq("user_id", user_id).limit(100);
  // const result = (d || []).filter(r => condition).length;
  // qualifies = result >= threshold;
  
  break;
}
```

### Stats available per user (already collected by edge function)
`roam`, `save`, `submit`, `approved`, `collections`, `followers`, `following`, `publicColls`, `todayRoam`, `todaySave`, `level`, `xp`, `streak`, `bio`, `displayName`, `avatarUrl`, `createdAt`

### How to run repairs
```bash
# Full badge repair (3 phases: wipe, rebuild, verify)
node scripts/repair-badges-comprehensive.mjs

# Dry-run first
node scripts/repair-badges-comprehensive.mjs --dry-run

# Audit badge distribution
node scripts/audit-badges-full.mjs
```

### How to deploy edge functions
```bash
npx supabase functions deploy evaluate-badges
npx supabase functions deploy cron-secret-badges
```

### How to run SQL (Management API — no pg DNS needed)
```bash
node scripts/run-supabase-sql.mjs <sql-file>
```
Requires `SUPABASE_ACCESS_TOKEN` in `.env`.

---

## DB Connection
- URL: `https://yrhckctwtdjowulfuaqc.supabase.co`
- Service key in any script or `.env` as `SUPABASE_SERVICE_ROLE_KEY`
- Management API token in `.env` as `SUPABASE_ACCESS_TOKEN`
- 27 users, avg XP 2,002, 85 badges awarded
