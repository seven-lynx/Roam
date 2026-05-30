# Roam Seeding Scripts

Data seeding pipeline for populating the Roam discovery pool from free, human-curated sources. Runs independently to fetch content, normalize URLs, extract metadata, and insert into the `urls` table.

## Overview

The seeding system is designed to:
- Pull content from diverse, free sources (Wikipedia, Hacker News, NASA, etc.)
- Normalize URLs and extract metadata (title, description, category)
- Detect and skip duplicates
- Insert only valid URLs with meaningful content
- Track the source of each URL for analytics

All sources are free public APIs or datasets — no scraping, no paywalled content, no LLM-generated data.

## Data Sources

| Script | Source | API Key | Rows | Status |
|--------|--------|---------|------|--------|
| `seed-wikipedia.js` | Wikipedia REST API | none | 2,559 | ✅ Live |
| `seed-hackernews.js` | Algolia HN Search | none | 1,058 | ✅ Live |
| `seed-nasa.js` | NASA APOD API | `NASA_API_KEY` | 9,123 | ✅ Live |
| `seed-openlibrary.js` | Open Library Subjects | none | 59,514 | ✅ Live |
| `seed-arxiv.js` | arXiv Atom Feed | none | 5,872 | ✅ Live |
| `seed-awesome.js` | GitHub Awesome Lists | none | 9,610 | ✅ Live |
| `seed-wiby.js` | wiby.me Directory | none | 1,827 | ✅ Live |
| `seed-lobsters.js` | Lobsters JSON API | none | 50 | ✅ Live |
| `seed-semanticscholar.js` | Semantic Scholar API | optional | 1,114 | ✅ Live |
| `seed-nyt.js` | NYT Archive API (5 yrs) | `NYT_API_KEY` | 590 | ✅ Live |
| `seed-guardian.js` | Guardian Content API | `GUARDIAN_API_KEY` | 32,794 | ✅ Live |
| `seed-propublica.js` | ProPublica Sitemaps (all-time) | none | 126 | ✅ Live |
| `seed-npr.js` | NPR RSS Feeds (33 feeds) | none | 152 | ✅ Live |
| `seed-wikivoyage.js` | MediaWiki API | none | 67,657 | ✅ Live |
| `seed-internetarchive.js` | Internet Archive API | none | 50,966 | ✅ Live |
| `seed-curlie.js` | Curlie Directory | none | 2,744,100 | ✅ Complete |
| `seed-gutenberg.js` | Gutendex (Project Gutenberg) | none | 510 | ✅ Live |
| `seed-pubmed.js` | NCBI Entrez API | none | 40,154 | ✅ Live |
| `seed-reddit.js` | Reddit JSON API | none | 685 | ⚠️ Broken (API now 403) |
| `seed-ted.js` | TED Talks Sitemap | none | 7,466 | ✅ Live |
| `seed-metmuseum.js` | Met Museum / Wikidata | none | 55,346 | ✅ Complete |
| `seed-boardgamegeek.js` | BoardGameGeek XML API (search-based) | none | 0 | ⚠️ Broken (API now 401) |
| `seed-librivox.js` | LibriVox API | none | 18,747 | ✅ Complete |
| `seed-github.js` | GitHub Search API | optional `GITHUB_TOKEN` | 5,802 | ✅ Live |
| `seed-itchio.js` | Itch.io Browse API | none | 13,328 | ✅ Complete |
| `seed-bandcamp.js` | Bandcamp Internal API | none | 9,634 | ✅ Complete |
| `seed-substack.js` | Substack Category API | none | 14,847 | ✅ Complete |

| `seed-pinboard.mjs` | Pinboard popular bookmarks | none | 69 | ✅ Live |
| `seed-kagisweb.mjs` | Kagi Small Web | none | 179 | ✅ Live |
| `seed-smithsonian.mjs` | Smithsonian Open Access | `SMITHSONIAN_API_KEY` | 350 | ✅ Live |
| `seed-podcastindex.mjs` | Podcast Index | `PODCAST_INDEX_API_KEY` + `PODCAST_INDEX_API_SECRET` | 0 | 🔑 Needs API key |
| `seed-europeana.mjs` | Europeana cultural heritage | `EUROPEANA_API_KEY` | 8,151 | ✅ Live |
| `seed-marginalia.mjs` | Marginalia Search (indie web) | none | 4,916 | ✅ Live |
| `seed-loc.mjs` | Library of Congress public API | none | 3,351 | ✅ Live |
| `seed-kottke.mjs` | Kottke.org RSS (linked articles) | none | 60 | ✅ Live |
| `seed-lesswrong.mjs` | LessWrong GraphQL API | none | 1,000 | ✅ Live |
| `seed-mastodon.mjs` | Mastodon trending links (3 instances) | none | 79 | ✅ Live |
| `seed-longform.mjs` | Long-form publications RSS (Aeon, Quanta, etc.) | none | 766 | ✅ Live |
| `seed-sep.mjs` | Stanford Encyclopedia of Philosophy (contents page) | none | 1,861 | ✅ Live |
| `seed-hn-discussions.mjs` | Ask HN threads (points > 200, comments > 100) | none | 882 | ✅ Live |
| `seed-atlantic-newyorker.mjs` | The Atlantic + The New Yorker RSS | none | 312 | ✅ Live |
| `seed-flickr-commons.mjs` | Flickr: The Commons (public-domain institutional photos) | none | 460 | ✅ Live |

**Total: ~3.2M URLs across 34+ active sources** *(as of May 2026)*

## Setup

### Prerequisites
- Node.js 20+ with npm or pnpm
- `.env` file in the `scripts/` directory (see Environment Variables below)
- Supabase project running (development or production)

### Environment Variables

Create `.env` in the `scripts/` directory:

```
SUPABASE_URL=https://yrhckctwtdjowulfuaqc.supabase.co
SUPABASE_ANON_KEY=sb_publishable_HNqqRWeISKlQ6TRvOvsAAQ_MqEbP5ak

# Optional API keys (only if running those seeders):
NASA_API_KEY=your_nasa_api_key
NYT_API_KEY=your_nyt_api_key
GUARDIAN_API_KEY=your_guardian_api_key
GITHUB_TOKEN=your_github_token
SEMANTIC_SCHOLAR_API_KEY=your_semantic_scholar_key

# New sources (2026):
SMITHSONIAN_API_KEY=your_smithsonian_key
PODCAST_INDEX_API_KEY=your_podcast_index_key
PODCAST_INDEX_API_SECRET=your_podcast_index_secret
EUROPEANA_API_KEY=your_europeana_key
```

Get API keys from:
- **NASA**: https://api.nasa.gov/
- **NYT**: https://developer.nytimes.com/
- **Guardian**: https://open-platform.theguardian.com/
- **GitHub**: https://github.com/settings/tokens
- **Semantic Scholar**: https://www.semanticscholar.org/product/api
- **Smithsonian**: https://api.si.edu/openaccess/api/v1.0/auth
- **Podcast Index**: https://api.podcastindex.org/
- **Europeana**: https://pro.europeana.eu/pages/get-api

### Install Dependencies

```bash
cd scripts
pnpm install
```

## Running Seeders

### Run All Seeders (Sequential)
```bash
# Run all scripts one by one (slow, safe)
pnpm run seed:all
```

### Run Individual Seeders
```bash
# Single source
node seed-wikipedia.js
node seed-nasa.js
node seed-github.js
# ... etc
```

### Run Multiple Seeders (Parallel)
```bash
# Using pnpm (runs up to 4 in parallel)
pnpm run seed:all --parallel=4
```

### Test a Seeder (No Database Insert)
Most seeders support a `--dry-run` flag to preview what would be inserted:

```bash
node seed-wikipedia.js --dry-run
```

## Shared Utilities (`lib/`)

All seeders import from `scripts/lib/` instead of reimplementing common patterns.

### `lib/seed.js` — core seeding utilities

| Export | Purpose |
|--------|---------|
| `upsertUrls(rows, opts)` | Normalise → dedup → optional OG fetch → batch upsert |
| `normaliseUrl(raw)` | HTTPS, strip www, strip tracking params, remove fragment |
| `fetchOgImage(url)` | Fetch `og:image` / `twitter:image` from a page |
| `fetchOgMeta(url)` | Fetch both `og:image` and `og:description` |
| `fetchWithRetry(url, opts, retryOpts)` | `fetch()` with exponential backoff and `Retry-After` support |
| `createThrottle(opts)` | AutoThrottle — adapts inter-request delay based on server latency |
| `CATEGORY` | Frozen object mapping category names to Supabase UUIDs |
| `getSubcategoryId(name)` | DB lookup for a subcategory UUID by name |

**`fetchWithRetry` options:**
```javascript
import { fetchWithRetry } from './lib/seed.js';

const res = await fetchWithRetry(url, fetchOptions, {
  retries: 3,    // max retry attempts (default 3)
  base: 2000,    // base delay ms for exponential backoff (default 2000)
});
// Handles 429 with Retry-After header automatically
```

**`createThrottle` options:**
```javascript
import { createThrottle } from './lib/seed.js';

const throttle = createThrottle({ target: 500, min: 100, max: 15_000 });
const t0 = Date.now();
const res = await fetchWithRetry(url);
await throttle(Date.now() - t0); // adapts and waits
```

---

### `lib/cache.js` — per-page TTL cache with partial resume

Replaces the all-or-nothing `JSON.stringify(allRows)` dump pattern. Persists individual entries so an interrupted seeder resumes mid-run rather than restarting entirely.

```javascript
import { createCache } from './lib/cache.js';

const cache = createCache('nyt', { noCache: process.argv.includes('--no-cache') });
// TTL defaults to 7 days. Pass { ttl: ms } to override.

const cached = cache.get('2024-03');        // null if missing or expired
cache.set('2024-03', articles);             // persists immediately
cache.clear();                              // wipe all entries
console.log(cache.active);                 // false when --no-cache was passed
console.log(cache.size);                   // count of live (non-expired) entries
```

Cache files live at `scripts/.cache/<name>.json` (gitignored).

---

## Seeder Structure

Each seeder follows the same pattern:

```javascript
// 1. Fetch data from API/source
const response = await fetch('https://api.example.com/content');
const data = await response.json();

// 2. Normalize URLs and extract metadata
const urls = data.map(item => ({
  original_url: item.url,
  title: item.title || null,
  description: item.description || null,
  category: 'News',  // Tag with category
  source: 'example'  // Track data source
}));

// 3. Insert into Supabase (skips duplicates)
const { data: inserted, error } = await supabase
  .from('urls')
  .upsert(urls, { onConflict: 'original_url' });
```

## Common Patterns

### Retrying Failed Requests
Use `fetchWithRetry` from `lib/seed.js` — do not write bespoke retry loops:

```javascript
import { fetchWithRetry } from './lib/seed.js';

const res = await fetchWithRetry(url, { headers }, { retries: 3, base: 2000 });
if (!res.ok) return [];
const data = await res.json();
```

Handles 429 (with `Retry-After`), network errors, and exponential backoff automatically.

### Fetching with Pagination
```javascript
let page = 1;
let hasMore = true;

while (hasMore) {
  const response = await fetch(`https://api.example.com/items?page=${page}`);
  const data = await response.json();
  
  if (data.items.length === 0) hasMore = false;
  
  // Process data...
  page++;
}
```

### Batching Inserts
```javascript
// Insert in chunks of 1000 to avoid timeouts
const batchSize = 1000;
for (let i = 0; i < urls.length; i += batchSize) {
  const batch = urls.slice(i, i + batchSize);
  const { error } = await supabase.from('urls').upsert(batch);
  if (error) console.error(error);
  console.log(`Inserted batch ${i / batchSize + 1}/${Math.ceil(urls.length / batchSize)}`);
}
```

### Fetching Open Graph Metadata
```javascript
import cheerio from 'cheerio';

async function fetchOpenGraph(url) {
  const html = await fetch(url).then(r => r.text());
  const $ = cheerio.load(html);
  
  return {
    title: $('meta[property="og:title"]').attr('content') || $('title').text(),
    description: $('meta[property="og:description"]').attr('content'),
    image: $('meta[property="og:image"]').attr('content')
  };
}
```

## Database Schema

The `urls` table has this structure:

```sql
CREATE TABLE urls (
  id UUID PRIMARY KEY,
  original_url TEXT UNIQUE NOT NULL,
  normalized_url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  category TEXT,
  source TEXT,  -- Track where URL came from
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Troubleshooting

### "Cannot find module 'lib/seed.js'"
Make sure you're running from the `scripts/` directory:
```bash
cd scripts
node seed-wikipedia.js
```

### "SUPABASE_URL is not set"
Create a `.env` file with Supabase credentials (see Environment Variables above).

### "401 Unauthorized" from API
- Check your API key is correct in `.env`
- Verify the API key hasn't expired
- Some APIs (GitHub, NYT) require specific scopes — check their docs

### "TypeError: data.map is not a function"
The API response format may have changed. Check the API documentation and update the seeder to match the new response structure.

### Seeder is slow
- API rate limits — add delays between requests with `await new Promise(r => setTimeout(r, 100))`
- Network latency — run from a location closer to API servers
- Supabase inserts — batch inserts in chunks of 1000 instead of 1 at a time

### Duplicate URLs skipped
This is normal! The `upsert` operation with `onConflict: 'original_url'` skips URLs already in the database. Check the console output for "skipped X duplicates".

## Maintenance

### Updating a Seeder
1. Check the source API documentation for changes
2. Update the fetch logic if response format changed
3. Test with `--dry-run` before running on production
4. Commit changes with explanation of what changed

### Adding a New Seeder
1. Create `seed-{source}.js` in this directory
2. Follow the same pattern as existing seeders
3. Add to the table above
4. Add to `package.json` if you want it in `seed:all`
5. Document the API key requirement if needed

### Scheduling Regular Updates
Use a cron job or CI/CD system to run seeders periodically:

```bash
# Crontab example (run every Sunday at 2 AM)
0 2 * * 0 cd /path/to/roam/scripts && node seed-all.js
```

## Performance Notes

- Large seeders (Curlie, WikiVoyage, Internet Archive) take 10-30 minutes each
- Run them serially to avoid overwhelming APIs or Supabase
- Monitor your API rate limits — many free tiers allow 1000-10000 requests/day
- Batch inserts reduce database queries from N to N/1000

## Further Reading

- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
- [Open Graph Protocol](https://ogp.me/)
- [Cheerio HTML Parser](https://cheerio.js.org/)
