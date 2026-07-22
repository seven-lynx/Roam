# Seeder Creation Guide

Complete reference for building Roam URL seeders. Covers shared discovery functions,
the `upsertUrls()` import pipeline with concurrency + checkpointing, and custom seeder
patterns.

## Table of Contents

- [Quick Decision: Which Function?](#quick-decision)
- [Automatic Discovery Chain](#discovery-chain)
- [Shared Seeder Functions](#shared-functions)
  - [`seedRssWithFallbacks(config)`](#seedrsswithfallbacks)
  - [`seedWaybackCdx(config)`](#seedwaybackcdx)
- [Custom Seeders with `upsertUrls()`](#custom-upsert)
- [Pipeline Features (all seeders)](#pipeline-features)
- [Metadata Extraction Priority](#metadata-priority)
- [Path Filtering Rules](#path-filtering)
- [Category/Subcategory Constants](#categories)
- [Custom Subcategory Discovery (awesome-lists, etc.)](#custom-subcategory)
- [Quality Checklist](#checklist)

---

## Quick Decision: Which Function Should I Use? {#quick-decision}

| Scenario | Use | Notes |
|---|---|---|
| Site has a known RSS/Atom feed | `seedRssWithFallbacks` | Feed metadata is richest (title + description + date in one request) |
| Site blocks scrapers (CloudFront, Cloudflare, JS-only) | `seedWaybackCdx` | Queries Wayback Machine CDX API instead of live site |
| Need total control (custom parsing, rate limiting, multi-source dedup) | Direct `upsertUrls()` | See [Custom Seeders](#custom-upsert) |
| Importing a bulk curated list (JSON, CSV, scraped data) | `upsertUrls()` with `checkLive: true` | Pre-extract into JSON, batch-import through the pipeline |

---

## Automatic Discovery Chain (all tiers — shared by both functions) {#discovery-chain}

Every seeder built from `seed.js` runs these methods in priority order, stopping at the
first tier that returns **≥10 URLs**. Each tier fails silently and passes to the next.

| Tier | Method | Details |
|------|--------|---------|
| 1 | **RSS/Atom** | Configured `feedUrl` |
| 2 | **RSS common paths** | `/feed/`, `/rss/`, `/atom.xml`, `/feed.xml`, `/index.xml`, `/rss.xml` |
| 3 | **JSON Feed** | `/feed.json`, `/feed/index.json` |
| 4 | **robots.txt + Sitemap** | Parses `Sitemap:` directives from `/robots.txt`, then tries 9 hardcoded sitemap paths |
| 5 | **WordPress REST API** | `/wp-json/wp/v2/posts?per_page=100` |
| 6 | **Wayback CDX API** | `web.archive.org/cdx/search/cdx` |
| 7 | **HTTP Link + HTML `<link>` RSS autodiscovery** | Scans homepage headers and HTML for feed references |
| 8 | **Archive page scraping** | `/blog/`, `/news/`, `/articles/`, `/posts/`, `/latest/`, `/archive/` (paginated) |
| 9 | **Headless browser crawl** | Crawlee + Playwright (last resort, enabled by default) |

---

## Shared Seeder Functions {#shared-functions}

### `seedRssWithFallbacks(config)` — RECOMMENDED DEFAULT {#seedrsswithfallbacks}

Use this for any site with an RSS feed (95% of cases). The RSS tier provides the
richest metadata: titles, descriptions, and publish dates directly from the feed
— no need to fetch individual article pages.

```js
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  // ── Required ──
  siteDomain: "example.com",                          // no protocol, no www
  cacheFileName: "example.json",                     // saved to scripts/.cache/
  displayName: "Example Site",                       // used in audit logs
  articlePathRegex: /\/(articles|news|features)\/[a-z0-9-]/i,  // 2+ path segments
  siteSuffixRegex: /\s*[\|\-]\s*Example\s*$/i,       // strips " | Example" from titles
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.COOKING_FOOD,
  source: "example",                                 // lowercase, hyphens, unique

  // ── Optional ──
  feedUrl: "https://example.com/feed/",              // omit to auto-discover
  seeder_score: 0.7,                                 // default 0.7
  maxArticles: 2000,                                 // default 2000
  maxPages: 20,                                      // Wayback CDX pages (default 20)
  sitemapPaths: ["/sitemap.xml"],                    // override default paths
  skipPaths: [/\/scoreboard\//, /\/standings\//],    // extra path exclusions
});
```

### `seedWaybackCdx(config)` — for bot-protected sites {#seedwaybackcdx}

Use when the live site blocks scrapers but is available in the Wayback Machine.
Queries CDX API for historical snapshots instead of hitting the live server.

```js
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "bot-protected.com",
  cacheFileName: "bot-protected.json",
  displayName: "Bot Protected Site",
  articlePathRegex: /\/(articles|news)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*\|\s*Bot Protected Site\s*$/i,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.SPACE_ASTRONOMY,
  source: "bot-protected",
  seeder_score: 0.7,
  maxPages: 40,
  skipPaths: [/\/scoreboard\//, /\/standings\//],
});
```

### When to start at which tier

| Function | Starts at | Primary use case |
|---|---|---|
| `seedRssWithFallbacks` | Tier 1 (RSS feed) | Sites with RSS feeds |
| `seedWaybackCdx` | Tier 6 (CDX API) | Bot-protected sites |

---

## Custom Seeders with `upsertUrls()` {#custom-upsert}

When the shared functions don't fit (custom parsing, multi-source aggregation,
bulk curated lists), use `upsertUrls()` directly. Every seeder ultimately feeds
through this pipeline.

### Basic template

```js
import { upsertUrls, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

const rows = [
  {
    url: "https://example.com/article-1",
    title: "Interesting Article Title",    // required (or OG-fetched)
    description: "Article description",    // optional (OG-fetched if missing)
    category_id: CATEGORY.SCIENCE,
    subcategory_id: SUBCATEGORY.MEDICINE_HEALTH_SCIENCE,
    source: "my-custom-source",
    seeder_score: 0.7,
  },
  // ... more rows
];

const result = await upsertUrls(rows, {
  fetchOg: true,          // fetch og:image + description for rows missing them
  checkLive: true,        // HEAD-check each URL; skip 4xx/5xx
  requireTitle: true,     // skip rows that still have no title after OG fetch
  verbose: true,          // log progress
  maxPerDomain: 20,       // optional: cap insertions per domain
  checkpointId: undefined,// auto-derived from script name — override if needed
});

console.log(`Inserted: ${result.inserted}, Skipped: ${result.skipped}, Dead: ${result.dead}`);
```

### Complete row shape

```js
{
  url: string,               // required
  title: string,             // required (or OG-fetched)
  description: string,       // optional
  category_id: string,       // UUID from CATEGORY constant
  subcategory_id: string,    // UUID from SUBCATEGORY constant
  source: string,            // unique lowercase-hyphens label
  og_image_url: string,      // optional (fetched if missing)
  language: string,          // optional ('en', 'fr', etc.)
  seeder_score: number,      // 0.0–1.0, default 0
  published_at: string,      // ISO 8601, optional
}
```

### Custom parse loop with ETA

If you write your own discovery/parse loop, add ETA logging for visibility:

```js
const total = urlsToParse.length;
const startTime = Date.now();
let done = 0;

for (const url of urlsToParse) {
  const row = await parseOne(url);
  if (row) rows.push(row);
  done++;
  if (done % 100 === 0 || done === total) {
    const elapsed = (Date.now() - startTime) / 1000;
    const pct = ((done / total) * 100).toFixed(1);
    const rate = done / elapsed;
    const eta = rate > 0 ? Math.floor((total - done) / rate) : 0;
    const etaStr = eta > 60 ? `${Math.floor(eta/60)}m ${eta%60}s` : `${eta}s`;
    console.log(`  parsed ${done}/${total} (${pct}%) — ETA: ${etaStr}`);
  }
}
```

---

## Pipeline Features (all seeders get these for free) {#pipeline-features}

Every call to `upsertUrls()` runs through this pipeline. No per-seeder
configuration needed — it's all automatic.

### 1. URL Normalization
- Enforces `https://`
- Strips `www.` prefix
- Lowercases hostname
- Removes tracking params (`utm_*`, `fbclid`, `gclid`, etc.)
- Removes trailing slashes (unless path is just `/`)
- Drops unparseable URLs

### 2. Domain Filters
- Rejects local-business/retail storefronts (Shopify, Square, ToastTab)
- Warns on unrecognized `category_id` values

### 3. Per-Domain Capping (opt-in)
Pass `maxPerDomain: 20` to limit insertions per hostname. Deterministic
sampling ensures consistent results across re-runs.

### 4. DB Dedup
Batch-checks normalized URLs against the existing `urls` table. Already-seeded
URLs are skipped automatically.

### 5. Liveness Check (15× concurrent HEAD, ETA, checkpoint/resume)
- **15 concurrent** HEAD requests with 5-second timeout
- **ETA logging**: `liveness 1500/50000 (3.0%) — alive: 1350 dead: 150 — ETA: 1h 23m`
- **Checkpoint file** written every 500 URLs to `scripts/.cache/liveness-{id}.json`
- On crash/restart, auto-detects checkpoint file and resumes where it left off
- Checkpoint ID auto-derived from script filename (e.g., `seed-kotaku.mjs` → `liveness-seed-kotaku.json`)
- Two seeders running simultaneously never interfere — each has its own checkpoint
- Checkpoint is deleted on successful completion
- To force a fresh start, delete the checkpoint file or use `--no-cache`

### 6. OG Metadata Fetch (8× concurrent, ETA)
- **8 concurrent** GET requests with 8-second timeout
- Fetches `og:image`, `og:description`, `<html lang>`, `<link rel="canonical">`
- Canonical URL rewriting with cross-domain/same-domain homepage guards
- JSON-LD enrichment: author, datePublished, headline extraction
- **ETA logging**: `og-meta 45/200 (22.5%) — ETA: 3m 12s`

### 7. Title Quality Gate
- Rows with no title (even after OG fetch) are skipped
- Protects against garbage entries

### 8. Batch Upsert (500 rows at a time)
- **Progress logging**: `Batch 3/10: upserted 500 rows (1500 total)`
- Graceful degradation: if `published_at`/`seeder_score` columns don't exist,
  retries without them (supports older DB schemas)
- `ON CONFLICT url DO NOTHING` — automatically skips duplicates

### 9. Automatic Seeding Run Log
After each run, a log entry is written locally (`scripts/.cache/seeding-runs.jsonl`)
and can be synced to Supabase via `node scripts/sync-seeding-logs.mjs`.

---

## Metadata Extraction Priority {#metadata-priority}

When `fetchOg: true`, metadata is extracted from the live page in this order:

1. `<title>` tag → strip `siteSuffixRegex` → use as title
2. `og:title` → fallback title
3. `<h1>` → last resort title
4. `og:description` → primary description (truncated to 500 chars)
5. `meta[name=description]` → fallback description
6. `og:image` → primary image
7. `twitter:image` → fallback image
8. `<html lang="">` → language detection (BCP-47 → base code)
9. `<link rel="canonical">` → rewrites URL if valid (guards against homepage/x-domain squatters)
10. JSON-LD → author, datePublished, headline enrichment

---

## Path Filtering Rules {#path-filtering}

These patterns are **always skipped** (built into `SKIP_STRS` in `seed.js`):

- `/tag/`, `/author/`, `/about`, `/search`, `/category/`, `/page/`
- `/subscribe`, `/login`, `/register`, `/account`, `/members`
- `/shop`, `/store`, `/cart`, `/checkout`, `/classifieds`
- `/video`, `/gallery`, `/podcast`, `/videos`, `/photos`
- `/share`, `/embed`, `/amp/`
- `/feed`, `/rss`, `/atom`
- `/scoreboard`, `/standings`, `/stats`, `/watch`, `/fantasy`
- `/markets`, `/quote`, `/bidding`

Always require **2+ path segments** for article URLs. Use the `skipPaths` regex
array for site-specific exclusions (e.g., `[/\/scoreboard\//, /\/standings\//]`).

---

## Category/Subcategory Constants {#categories}

Import from `scripts/lib/seed.js`:

```js
import { CATEGORY, SUBCATEGORY } from "./lib/seed.js";
```

### 8 Pillars (CATEGORY)
| Constant | UUID | Description |
|---|---|---|
| `CATEGORY.SCIENCE` | `c100...001` | Science & Nature |
| `CATEGORY.TECHNOLOGY` | `c100...002` | Technology |
| `CATEGORY.ARTS_CULTURE` | `c100...003` | Arts & Culture |
| `CATEGORY.HISTORY_IDEAS` | `c100...004` | History & Ideas |
| `CATEGORY.GAMES_HOBBIES` | `c100...005` | Games & Hobbies |
| `CATEGORY.WEIRD_WONDERFUL` | `c100...006` | Weird & Wonderful |
| `CATEGORY.PEOPLE_PLACES` | `c100...007` | People & Places |
| `CATEGORY.MIND_BODY` | `c100...008` | Mind & Body |

### 98 Subcategories (SUBCATEGORY)
Full list at `scripts/lib/seed.js` lines ~590-700. Key ones:

```js
// Science
SUBCATEGORY.SPACE_ASTRONOMY, .BIOLOGY_EVOLUTION, .PHYSICS_CHEMISTRY,
  .ENVIRONMENT_CLIMATE, .MEDICINE_HEALTH_SCIENCE, .MATHEMATICS_LOGIC,
  .GEOLOGY_EARTH_SCIENCE, .NEUROSCIENCE_COGNITION, ...

// Technology
SUBCATEGORY.PROGRAMMING_SOFTWARE, .DESIGN_UX, .AI_MACHINE_LEARNING,
  .HARDWARE_ELECTRONICS, .CYBERSECURITY_PRIVACY, .INTERNET_CULTURE,
  .ROBOTICS_AUTOMATION, .EMERGING_TECHNOLOGY, .OPEN_SOURCE,
  .DATABASES_DATA_ENGINEERING, .DEVOPS_INFRASTRUCTURE

// Arts & Culture
SUBCATEGORY.MUSIC, .FILM_TELEVISION, .VISUAL_ART, .COMICS_ILLUSTRATION,
  .LITERATURE_WRITING, .PHOTOGRAPHY, .ARCHITECTURE_URBAN,
  .THEATRE_PERFORMANCE, .FASHION_TEXTILES, .ANIME_MANGA, .SCIFI_FANTASY

// History & Ideas
SUBCATEGORY.ANCIENT_MEDIEVAL_HISTORY, .MODERN_HISTORY, .PHILOSOPHY_ETHICS,
  .POLITICS_GEOPOLITICS, .RELIGION_MYTHOLOGY, .ECONOMICS_HISTORY,
  .MILITARY_HISTORY, .SOCIAL_HISTORY, .EXPLORATION_DISCOVERY, ...

// Games & Hobbies
SUBCATEGORY.VIDEO_GAMES, .BOARD_GAMES_TABLETOP, .SPORTS_ATHLETICS,
  .COOKING_FOOD, .CRAFTS_DIY_MAKING, .COLLECTING, .OUTDOOR_ADVENTURE,
  .GARDENING_HORTICULTURE, .PUZZLES_BRAIN_TEASERS, .BROWSER_INTERACTIVE,
  .PETS, .FISHING, .CARS_AUTOMOTIVE

// Weird & Wonderful
SUBCATEGORY.ODDITIES_CURIOSITIES, .TRUE_CRIME_MYSTERIES,
  .PARANORMAL_UNEXPLAINED, .VINTAGE_INTERNET, .ABSURDIST_HUMOUR,
  .URBAN_LEGENDS_FOLKLORE, .LOST_MEDIA, .UNUSUAL_PLACES, ...

// People & Places
SUBCATEGORY.TRAVEL_EXPLORATION, .CITIES_URBAN_LIFE, .BIOGRAPHIES_PROFILES,
  .LANGUAGES_LINGUISTICS, .MAPS_CARTOGRAPHY, .FESTIVALS_CUSTOMS, ...

// Mind & Body
SUBCATEGORY.PSYCHOLOGY_BEHAVIOUR, .MENTAL_HEALTH, .FITNESS_MOVEMENT,
  .NUTRITION_HEALTH, .MINDFULNESS_MEDITATION, .SLEEP_RECOVERY,
  .PERSONAL_DEVELOPMENT, .RELATIONSHIPS_SOCIAL, .AGING_LONGEVITY, ...
```

---

## Custom Subcategory Discovery {#custom-subcategory}

For bulk curated lists (like awesome-lists) where you need to map external
categories to Roam subcategories, see `scripts/extract-stumbleupon-awesome.mjs`
as a reference. The pattern:

1. Import `{ CATEGORY, SUBCATEGORY }` constants
2. Build a category-to-UUID mapping table with explicit matches + keyword
   fallbacks
3. Write deduplicated JSON to `scripts/.cache/`
4. Feed that JSON into a seeder via `upsertUrls()`

---

## Quality Checklist {#checklist}

Before committing a new seeder:

- [ ] Uses `seedRssWithFallbacks()`, `seedWaybackCdx()`, or `upsertUrls()` directly
- [ ] `feedUrl` is set for `seedRssWithFallbacks` if the site has a known RSS feed
- [ ] `articlePathRegex` has `/[a-z0-9-]` suffix to ensure 2+ path segments
- [ ] `siteSuffixRegex` strips common title suffixes
- [ ] `category_id` and `subcategory_id` use correct UUID constants
- [ ] `maxPages` is reasonable (15–40 depending on site size)
- [ ] `skipPaths` excludes non-article sections
- [ ] Cache file name is unique per seeder
- [ ] Source label is unique, lowercase, hyphenated
- [ ] No custom scraping logic — lets the shared chain handle fallbacks
- [ ] Checkpoint isolation works: runs side-by-side with other seeders without
  checkpoint collisions
- [ ] ETA logging is present in any custom parse/discovery loops