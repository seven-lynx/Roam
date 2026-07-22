# Seeder Quickstart

Operations playbook for creating, running, auditing, and flushing seeders.

## Quick Commands

```bash
# Run a seeder
node scripts/seed-whiskey.mjs
node scripts/seed-whiskey.mjs --no-cache      # Force re-discovery + re-fetch

# Run all CDX seeders in parallel (1 terminal window each)
scripts\.cache\run-seeders.bat

# Run multiple seeders simultaneously (checkpoints are isolated — no collisions)
node scripts/seed-kotaku.mjs &
node scripts/seed-bbq.mjs &
# Each writes to liveness-seed-kotaku.json / liveness-seed-bbq.json

# Audit health
node scripts/audit-seeders.mjs --health        # Color-coded per-seeder health
node scripts/audit-seeders.mjs --worst 10      # Bottom 10 by insertion count
node scripts/audit-seeders.mjs --stale 30      # Not run in 30+ days
node scripts/audit-seeders.mjs --report        # Markdown report

# View logs
node scripts/log-seeding.mjs --stats           # Aggregate stats
node scripts/log-seeding.mjs --list            # Last 7 days
node scripts/log-seeding.mjs --seeder=bbq      # Specific seeder history
node scripts/log-seeding.mjs --tail            # Last 20 runs

# Sync to Supabase (run manually or on cron — NOT during seeding)
node scripts/sync-seeding-logs.mjs
node scripts/sync-seeding-logs.mjs --dry       # Preview what would sync

# Flush seeders (commit dead URLs, delete, reset)
node scripts/flush-seeders.mjs                 # Full flush
node scripts/flush-seeders.mjs --dry-run       # Preview
node scripts/flush-seeders.mjs --step=delete --name=example   # Single step one seeder
```

## Creating a New Seeder

Reference: `docs/SEEDER_CREATION_GUIDE.md` — complete reference with all pipeline
features, the 9-tier discovery chain, and custom seeder patterns.

All seeders get automatic multi-method fallback. Pick the right function:

| Function | Use when | Starts at |
|---|---|---|
| `seedRssWithFallbacks` (recommended) | Site has an RSS feed | Tier 1 (RSS) |
| `seedWaybackCdx` | Site blocks scrapers (CloudFront, Cloudflare) | Tier 6 (CDX) |
| Direct `upsertUrls()` | Custom parsing, bulk curated lists | N/A |

**Template (RSS with fallbacks — recommended default):**
```js
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "example.com",
  cacheFileName: "example.json",
  displayName: "Example",
  feedUrl: "https://example.com/feed/",
  articlePathRegex: /\/(articles|news|features)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*\|\s*Example$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.COOKING_FOOD,
  source: "example",
  seeder_score: 0.7,
});
```

Don't write custom scraping logic — the shared chain handles all fallbacks automatically.

## Pipeline Features (all seeders get these for free)

Every call to `upsertUrls()` runs through a 9-stage pipeline:

| Stage | Details |
|-------|---------|
| **URL normalization** | Enforces `https://`, strips `www.`, removes tracking params |
| **Domain filters** | Rejects Shopify, Square, ToastTab retail storefronts |
| **Per-domain capping** | Opt-in via `maxPerDomain` |
| **DB dedup** | Batch-checks against existing `urls` table |
| **Liveness check** | 15× concurrent HEAD, 5s timeout, ETA, checkpoint/resume |
| **OG metadata fetch** | 8× concurrent GET, ETA, canonical rewriting, JSON-LD enrichment |
| **Title quality gate** | Skips entries missing a title |
| **Batch upsert** | 500 rows per batch, `ON CONFLICT DO NOTHING` |
| **Auto-log** | Logs to `seeding-runs.jsonl` for audit/sync |

### Crash Resilience

If a seeder crashes mid-liveness, just run the same command again. It automatically:
- Detects the checkpoint file (`scripts/.cache/liveness-{seeder-id}.json`)
- Resumes from where it left off
- Deletes the checkpoint on clean completion

To force a fresh start, delete the checkpoint or use `--no-cache`.

### Running Multiple Seeders Simultaneously

Each seeder gets an automatically-isolated checkpoint file derived from its
script name (e.g., `seed-kotaku.mjs` → `liveness-seed-kotaku.json`). Two
seeders can run in parallel without checkpoint collisions. The `run-seeders.bat`
script launches them in separate windows automatically.

### Progress Visibility

All stages log ETA:
```
[seed] Liveness check for 50230 URLs (checkpoint: seed-kotaku)...
[seed]   liveness 1500/50230 (3.0%) — alive: 1350 dead: 150 — ETA: 1h 23m
[seed] Fetching OG metadata for 12000/13500 URLs...
[seed]   og-meta 450/1200 (37.5%) — ETA: 3m 12s
[seed] Batch 3/24: upserted 500 rows (1500 total)
```

## Automatic Fallback Chain

Every seeder inherits this 9-tier chain. Each tier tries, fails silently,
and falls forward:

| Tier | Method | Details |
|------|--------|---------|
| 1 | RSS/Atom | Configured `feedUrl` |
| 2 | RSS common paths | `/feed/`, `/rss/`, `/atom.xml`, etc. |
| 3 | JSON Feed | `/feed.json` |
| 4 | robots.txt + Sitemap | 9 hardcoded paths |
| 5 | WordPress REST API | `/wp-json/wp/v2/posts` |
| 6 | Wayback CDX API | web.archive.org |
| 7 | Homepage RSS autodiscovery | HTTP Link header + HTML `<link>` tags |
| 8 | Archive page scraping | `/blog/`, `/news/`, `/articles/` |
| 9 | Headless browser crawl | Crawlee + Playwright |

Stops at the first tier that returns ≥10 article URLs.

## Troubleshooting

**Seeder hangs during liveness:**
The 15 concurrent HEAD requests with 5-second timeout typically complete
quickly. If it hangs, check your network or kill the process — the
checkpoint saves progress, so just re-run.

**"Warning: unrecognised category_id":**
The rows have invalid UUIDs. Make sure you import `CATEGORY` constants
from `lib/seed.js` and pass UUIDs (not numeric IDs).

**OG fetch too slow:**
The pipeline only fetches OG metadata for rows missing `og_image_url` or
`description`. Pre-populate these fields in your data to skip this stage.

**Checkpoint files accumulating:**
Successful runs delete their checkpoint files. If you see stale files in
`scripts/.cache/liveness-*.json`, delete them manually. They're safe to
remove — the seeder just starts fresh.