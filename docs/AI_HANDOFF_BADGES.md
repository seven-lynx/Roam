# AI Handoff: Badge System Completion

**Date:** July 30, 2026  
**Project:** Roam (github.com/seven-lynx/Roam)  
**Goal:** Make all 300 badges unlockable with real conditions users can meet.

---

## Current State (What's Done)

### Data
- **225 badges** awarded across 26 users (~10,505 XP total)
- **0 XP/level mismatches**, **0 badge_count drift**
- 3 new tables exist in production: `url_ratings`, `collection_favorites`, `log_failed_urls`

### Tools Built
| File | Purpose |
|------|---------|
| `scripts/repair-badges-v3.mjs` | **Primary batch repair tool** — evaluates ~150 badges via REST API. Run: `node scripts/repair-badges-v3.mjs` |
| `scripts/audit-badges-full.mjs` | Audit tool — generates per-badge unlock counts |
| `supabase/functions/evaluate-badges/index.ts` | **Real-time edge function** — evaluates badges on user actions |

### Edge Functions Deployed
- `evaluate-badges` — core engine called by other functions
- `roam` — calls evaluate-badges on boot (fire-and-forget)
- `save-url` — calls evaluate-badges on save
- `follow` — calls evaluate-badges for follower + followed user

### Tables Created
- `public.url_ratings (id, user_id, url_id, rating (-1/0/1), created_at)` — RLS + indexes
- `public.collection_favorites (id, user_id, collection_id, created_at)` — RLS + indexes
- `public.log_failed_urls (id, user_id, url, status_code, created_at)` — RLS + index

### Deprecated/Retired
- `scripts/rebuild-badges.mjs` — depends on broken SQL `evaluate_badges()` RPC
- `scripts/rebuild-badges-client-side.mjs` — had 4 critical bugs, replaced by v3

### Known Limitation
The SQL `evaluate_badges()` function **cannot be deployed remotely** via Management API or SQL Editor. `npx supabase db push` found 14 pending migrations (`20260718000002` through `00006`) that need applying. The function itself is fine in `supabase/migrations/20260730000006_fix_ambiguous_columns.sql` — it just needs `npx supabase db push --include-all` to work, which requires Docker.

---

## Remaining Work (Prioritized)

### P1: Add Rating Badge Evaluation (~16 badges, 30 min)
The `url_ratings` table exists but is empty (no users have rated URLs). Add evaluation logic to the switch/case in both files:
- `scripts/repair-badges-v3.mjs` (around line 150, `evaluateBadge()` function)
- `supabase/functions/evaluate-badges/index.ts` (around line 125, switch statement)

**Badges to add:** `rater-bronze` (25 ratings), `rater-silver` (100), `rater-gold` (500), `critic` (1000), `the-judge` (2000), `feedback-loop` (10 today), `rate-everything` (every category), `rate-spree` (25 today), `the-completionist-rate`, `voting-power` (100), `non-committal` (50 roams + 0 ratings), `morning-rater` (5 before 9am), `rate-streak` (7 consecutive days), `rate-by-category` (3 categories today), `the-equalizer` (equal up/down), `downer` (10 downvotes today)

**Pattern to follow (existing working examples):**
```js
case "rater-bronze": {
  const { count: c } = await sb.from("url_ratings").select("*", { count: "exact", head: true }).eq("user_id", userId);
  q = (c ?? 0) >= 25;
  break;
}
```

### P2: Add Collection Favorites Evaluation (~5 badges, 15 min)
```js
case "favorited-bronze": {
  const { data: d } = await sb.from("collection_favorites").select("collection_id, collections!inner(user_id)").eq("collections.user_id", userId);
  q = (d?.length ?? 0) >= 5;
  break;
}
```

### P3: SQL-Aggregatable Badges (~15 badges, 20 min)
Badges that need additional REST queries (no new tables):
- `tagger-*` — COUNT DISTINCT category_id from saved_urls
- `tag-master`, `completionist`, `save-streak`, `language-collector`
- `collectors-collector`, `weekly-collector`, `long-term-storage`
- `submission-streak`, `approval-streak`, `weekend-submitter`
- `error-404-explorer` — query `log_failed_urls`

### P4: Secret/Holiday Badges (43 badges, 30 min)
Create `supabase/functions/cron-secret-badges/index.ts` — a scheduled edge function that runs daily and checks:
- Date-based badges (holidays, solstices, Pi Day, etc.)
- Time-based badges (`time-traveler`, `midnight-oil`)
- Special condition badges (`lucky-777`, `polyglot`, `lunar-roamer`, `easter-egg`)
Deploy as: `npx supabase functions deploy cron-secret-badges`

### P5: Share Tracking (12 badges, 30 min)
Create `share_events` table then add evaluation for: `viral-*`, `first-share`, `broadcaster`, `chatterbox`, `share-happy-hour`.

### P6: Cleanup
Delete failed migration attempts (`20260730000002` through `00005`). These were 4 attempts that never successfully deployed. Keep `00006` and `00000` (clean wipe).

---

## Key Code Patterns

### How to add a badge to repair-badges-v3.mjs
```js
case "badge-slug": {
  // Simple count-based:
  // const { count: c } = await sb.from("table").select("*", { count: "exact", head: true }).eq("user_id", userId);
  // q = (c ?? 0) >= required_count;
  
  // More complex:
  // const { data: d } = await sb.from("table").select("col").eq("user_id", userId).limit(100);
  // const result = (d || []).filter(r => condition).length;
  // q = result >= threshold;
  
  break;
}
```

### Stats available per user (already collected)
`roam`, `save`, `submit`, `approved`, `collections`, `followers`, `following`, `publicColls`, `todayRoam`, `todaySave`, `level`, `xp`, `streak`, `bio`, `displayName`, `avatarUrl`, `createdAt`

### How to run repairs
```bash
node scripts/repair-badges-v3.mjs   # full batch repair
node scripts/audit-badges-full.mjs # generate audit report
```

### How to deploy edge functions
```bash
npx supabase functions deploy evaluate-badges
npx supabase functions deploy cron-secret-badges
```

### How to push DB migrations
```bash
npx supabase db push --include-all  # requires Docker
```

---

## DB Connection
- URL: `https://yrhckctwtdjowulfuaqc.supabase.co`
- Service key in any script or `.env` as `SUPABASE_SERVICE_ROLE_KEY`
- 26 users, 4,727 XP log entries, ~225 badges awarded