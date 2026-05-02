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
| `seed-wikipedia.js` | Wikipedia REST API | none | 2,593 | ✅ Live |
| `seed-hackernews.js` | Algolia HN Search | none | 948 | ✅ Live |
| `seed-nasa.js` | NASA APOD API | `NASA_API_KEY` | 9,123 | ✅ Live |
| `seed-openlibrary.js` | Open Library Subjects | none | 59,514 | ✅ Live |
| `seed-arxiv.js` | arXiv Atom Feed | none | 6,600 | ✅ Live |
| `seed-awesome.js` | GitHub Awesome Lists | none | 9,824 | ✅ Live |
| `seed-wiby.js` | wiby.me Directory | none | 1,747 | ✅ Live |
| `seed-lobsters.js` | Lobsters JSON API | none | ~1,000 | ✅ Live |
| `seed-semanticscholar.js` | Semantic Scholar API | optional | ~50,000 | ✅ Live |
| `seed-nyt.js` | NYT Article Search | `NYT_API_KEY` | 339 | ✅ Live |
| `seed-guardian.js` | Guardian Content API | `GUARDIAN_API_KEY` | 18,000 | ✅ Live |
| `seed-propublica.js` | ProPublica Sitemaps | none | 106 | ✅ Live |
| `seed-npr.js` | NPR RSS Feeds | none | 152 | ✅ Live |
| `seed-wikivoyage.js` | MediaWiki API | none | 67,660 | ✅ Live |
| `seed-internetarchive.js` | Internet Archive API | none | 50,966 | ✅ Live |
| `seed-curlie.js` | Curlie Directory | none | 2,732,344 | ✅ Complete |
| `seed-gutenberg.js` | Gutendex (Project Gutenberg) | none | 510 | ✅ Live |
| `seed-pubmed.js` | NCBI Entrez API | none | 40,154 | ✅ Live |
| `seed-reddit.js` | Reddit JSON API | none | 1,549 | ✅ Live |
| `seed-ted.js` | TED Talks Sitemap | none | ~7,492 | ✅ Complete |
| `seed-metmuseum.js` | Met Museum / Wikidata | none | 73,211 | ✅ Complete |
| `seed-boardgamegeek.js` | BoardGameGeek API | Bearer token | – | ⚠️ Blocked |
| `seed-librivox.js` | LibriVox API | none | 18,752 | ✅ Complete |
| `seed-github.js` | GitHub Search API | optional `GITHUB_TOKEN` | 5,806 | ✅ Live |
| `seed-itchio.js` | Itch.io Browse API | none | 13,329 | ✅ Complete |
| `seed-bandcamp.js` | Bandcamp Internal API | none | 9,634 | ✅ Complete |
| `seed-substack.js` | Substack Category API | none | 14,847 | ✅ Complete |

**Total: ~3.04M+ URLs across all sources**

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
```

Get API keys from:
- **NASA**: https://api.nasa.gov/
- **NYT**: https://developer.nytimes.com/
- **Guardian**: https://open-platform.theguardian.com/
- **GitHub**: https://github.com/settings/tokens
- **Semantic Scholar**: https://www.semanticscholar.org/product/api

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
