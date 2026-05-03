/**
 * seed-smithsonian.mjs — Smithsonian Open Access seeder
 *
 * Pulls collection objects from the Smithsonian Institution's Open Access API.
 * Covers 19 Smithsonian museums and the National Zoo — 4.7M+ digitized objects.
 * Uses the native /category/:cat/search endpoint with sort=random so every run
 * discovers a different slice of the collection across all 4.7M objects.
 *
 * API docs:  https://edan.si.edu/openaccess/apidocs/
 * Free key:  https://api.data.gov/signup/  (instant, 1,000 req/day free tier)
 * Add to .env: SMITHSONIAN_API_KEY=your_key
 *
 * Run from repo root:
 *   node scripts/seed-smithsonian.mjs
 *   node scripts/seed-smithsonian.mjs --no-cache
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { config as dotenvConfig } from 'dotenv';
import { upsertUrls, CATEGORY, fetchWithRetry } from './lib/seed.js';
import { createCache } from './lib/cache.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../.env') });

const NO_CACHE = process.argv.includes('--no-cache');
// Cache is used for supplemental (non-random) queries only
const cache = createCache('smithsonian', { noCache: NO_CACHE });

const DELAY_MS = 1200;
const BASE     = 'https://api.si.edu/openaccess/api/v1.0';
const HEADERS  = { 'User-Agent': 'Roam-Seeder/1.0 (+https://roamtheweb.app)' };
const sleep    = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Phase 1: category-endpoint passes (sort=random, 1000 rows each) ───────────
// The SI API exposes 3 native categories. rows=1000 is the API maximum per
// request. sort=random means each run pulls a different slice of the 4.7M pool.
const CAT_PASSES = [
  { cat: 'art_design',         roamCat: CATEGORY.ARTS_CULTURE  },
  { cat: 'history_culture',    roamCat: CATEGORY.HISTORY_IDEAS },
  { cat: 'science_technology', roamCat: CATEGORY.SCIENCE       },
];

// ── Phase 2: supplemental topic queries (relevancy sort, cached) ──────────────
// Covers Roam categories not well-represented by the three native SI categories.
const SUPPLEMENTAL = [
  { q: 'zoo animal wildlife',   rows: 400, cat: CATEGORY.GAMES_HOBBIES  },
  { q: 'geographic survey map', rows: 400, cat: CATEGORY.PEOPLE_PLACES  },
  { q: 'folk culture people',   rows: 400, cat: CATEGORY.PEOPLE_PLACES  },
  { q: 'invention patent',      rows: 400, cat: CATEGORY.TECHNOLOGY     },
  { q: 'musical instrument',    rows: 400, cat: CATEGORY.ARTS_CULTURE   },
];

// ── Parse raw API rows into seed records ──────────────────────────────────────
function parseItems(rows) {
  return rows.map((item) => {
    const content = item.content ?? {};
    const dnr     = content.descriptiveNonRepeating ?? {};
    const title   = dnr.title?.content ?? null;

    // Description: prefer freetext notes, fall back to indexed structured notes
    const rawDesc =
      content.freetext?.notes?.[0]?.content
      ?? content.indexedStructured?.notes?.[0]
      ?? null;
    const description = rawDesc ? String(rawDesc).trim().slice(0, 500) : null;

    const og_image_url = dnr.online_media?.media?.[0]?.thumbnail ?? null;

    // Prefer explicit record_link; fall back to constructing from id
    const id   = item.id ?? dnr.record_ID;
    const link = dnr.record_link
      ?? (id ? `https://collections.si.edu/search/detail/${id}` : null);

    if (!link || !title) return null;
    return { url: link, title, description, og_image_url, source: 'smithsonian' };
  }).filter(Boolean);
}

// ── Fetch from /category/:cat/search (sort=random, single large request) ──────
async function fetchCategoryPage(apiKey, cat) {
  const params = new URLSearchParams({
    q:       '*',
    rows:    '1000',     // API maximum
    sort:    'random',
    api_key: apiKey,
  });
  const url = `${BASE}/category/${cat}/search?${params}`;
  const res = await fetchWithRetry(url, { headers: HEADERS });
  if (!res.ok) {
    console.warn(`[smithsonian] HTTP ${res.status} for category "${cat}"`);
    return [];
  }
  let data;
  try { data = await res.json(); } catch { return []; }
  return parseItems(data?.response?.rows ?? []);
}

// ── Fetch from /search (paginated, relevancy sort, cached) ───────────────────
async function fetchSearchPages(apiKey, q, maxRows) {
  const PAGE_SIZE = 100;
  const results   = [];
  let start       = 0;

  while (results.length < maxRows) {
    const batchSize = Math.min(PAGE_SIZE, maxRows - results.length);
    const cacheKey  = `q:${q}:${start}`;
    let items = cache.get(cacheKey);

    if (!items) {
      const params = new URLSearchParams({
        q,
        start:   String(start),
        rows:    String(batchSize),
        sort:    'relevancy',
        api_key: apiKey,
      });
      const url = `${BASE}/search?${params}`;
      const res = await fetchWithRetry(url, { headers: HEADERS });
      if (!res.ok) {
        console.warn(`[smithsonian] HTTP ${res.status} for query "${q}"`);
        break;
      }
      let data;
      try { data = await res.json(); } catch { break; }
      items = parseItems(data?.response?.rows ?? []);
      cache.set(cacheKey, items);
    }

    if (items.length === 0) break;
    results.push(...items);
    start += items.length;
    if (items.length < batchSize) break;
    await sleep(DELAY_MS);
  }

  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Smithsonian Open Access seeder ===');

  const apiKey = process.env.SMITHSONIAN_API_KEY;
  if (!apiKey) {
    console.error('[smithsonian] SMITHSONIAN_API_KEY not set in .env');
    console.error('[smithsonian] Get a free key at: https://api.data.gov/signup/');
    process.exit(1);
  }

  const seen    = new Set();
  const allRows = [];

  const addRows = (items, roamCat) => {
    for (const item of items) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      allRows.push({ ...item, category_id: roamCat });
    }
  };

  // Phase 1: category passes (random sort — fresh objects every run)
  console.log('\n[smithsonian] Phase 1: category passes (sort=random, 1000 per category)...');
  for (let i = 0; i < CAT_PASSES.length; i++) {
    const { cat, roamCat } = CAT_PASSES[i];
    process.stdout.write(`\r  [${i + 1}/${CAT_PASSES.length}] ${cat}...`);
    const items = await fetchCategoryPage(apiKey, cat);
    addRows(items, roamCat);
    process.stdout.write(`  ${items.length} fetched  total=${allRows.length}   `);
    if (i < CAT_PASSES.length - 1) await sleep(DELAY_MS);
  }

  // Phase 2: supplemental topic queries (cached, fills coverage gaps)
  console.log('\n\n[smithsonian] Phase 2: supplemental topic queries...');
  for (let i = 0; i < SUPPLEMENTAL.length; i++) {
    const { q, rows, cat } = SUPPLEMENTAL[i];
    process.stdout.write(`\r  [${i + 1}/${SUPPLEMENTAL.length}] "${q}"...`);
    const items = await fetchSearchPages(apiKey, q, rows);
    addRows(items, cat);
    process.stdout.write(`  ${items.length} fetched  total=${allRows.length}   `);
    if (i < SUPPLEMENTAL.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\n\n[smithsonian] Total unique collection pages: ${allRows.length}`);
  const result = await upsertUrls(allRows, { fetchOg: false, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => { console.error(err); process.exit(1); });
