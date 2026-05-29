/**
 * seed-podcastindex.mjs — Podcast Index seeder
 *
 * Podcast Index (podcastindex.org) is an open podcast directory with 4M+ shows.
 * Seeds podcast homepage URLs, organised by category.
 * Complements the existing LibriVox seeder with contemporary shows.
 *
 * API docs:  https://podcastindex-org.github.io/docs-api/
 * Free keys: https://api.podcastindex.org/  (instant, register once)
 * Add to .env:
 *   PODCAST_INDEX_API_KEY=your_key
 *   PODCAST_INDEX_API_SECRET=your_secret
 *
 * Auth: SHA-1(key + secret + unix_timestamp) passed as X-Auth-Header
 *
 * Run from repo root:
 *   node scripts/seed-podcastindex.mjs
 *   node scripts/seed-podcastindex.mjs --no-cache
 */

import fetch from 'node-fetch';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { config as dotenvConfig } from 'dotenv';
import { upsertUrls, CATEGORY, SUBCATEGORY, fetchWithRetry } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../.env') });

const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'podcastindex.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const DELAY_MS  = 500;   // Podcast Index is generous; 2 req/s is safe
const PAGE_MAX  = 1000;  // Items per category query (their max is 1000)
const sleep  = (ms) => new Promise((r) => setTimeout(r, ms));
const fmtEta = (done, total, startMs) => {
  if (done === 0) return '?';
  const s = Math.round(((Date.now() - startMs) / done) * (total - done) / 1000);
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
};

// ── Auth header builder ───────────────────────────────────────────────────────
function buildAuthHeaders(apiKey, apiSecret) {
  const now    = Math.floor(Date.now() / 1000);
  const hash   = createHash('sha1').update(`${apiKey}${apiSecret}${now}`).digest('hex');
  return {
    'X-Auth-Key':    apiKey,
    'X-Auth-Date':   String(now),
    'Authorization': hash,
    'User-Agent':    'Roam-Seeder/1.0 (https://roamtheweb.app)',
  };
}

// ── Podcast Index category IDs → Roam categories ─────────────────────────────
// Full list: GET /api/1.0/categories/list
// These are the podcast category IDs from Apple/standard taxonomy
const CATEGORY_MAP = [
  // Science
  { piCat: 'Science',                        rows: PAGE_MAX, cat: CATEGORY.SCIENCE,        subcat: SUBCATEGORY.PHYSICS_CHEMISTRY },
  { piCat: 'Science%3ANature',               rows: PAGE_MAX, cat: CATEGORY.SCIENCE,        subcat: SUBCATEGORY.BIOLOGY_EVOLUTION },
  { piCat: 'Science%3AAstronomy',            rows: PAGE_MAX, cat: CATEGORY.SCIENCE,        subcat: SUBCATEGORY.SPACE_ASTRONOMY },
  { piCat: 'Science%3AEarth+Sciences',       rows: PAGE_MAX, cat: CATEGORY.SCIENCE,        subcat: SUBCATEGORY.GEOLOGY_EARTH_SCIENCE },
  // Technology
  { piCat: 'Technology',                     rows: PAGE_MAX, cat: CATEGORY.TECHNOLOGY,     subcat: SUBCATEGORY.PROGRAMMING_SOFTWARE },
  // Arts & Culture
  { piCat: 'Arts',                           rows: PAGE_MAX, cat: CATEGORY.ARTS_CULTURE,   subcat: SUBCATEGORY.VISUAL_ART },
  { piCat: 'Arts%3ABooks',                   rows: PAGE_MAX, cat: CATEGORY.ARTS_CULTURE,   subcat: SUBCATEGORY.LITERATURE_WRITING },
  { piCat: 'Music',                          rows: PAGE_MAX, cat: CATEGORY.ARTS_CULTURE,   subcat: SUBCATEGORY.MUSIC },
  { piCat: 'Arts%3AVisual+Arts',             rows: PAGE_MAX, cat: CATEGORY.ARTS_CULTURE,   subcat: SUBCATEGORY.VISUAL_ART },
  // History & Ideas
  { piCat: 'History',                        rows: PAGE_MAX, cat: CATEGORY.HISTORY_IDEAS,  subcat: SUBCATEGORY.MODERN_HISTORY },
  { piCat: 'Society+%26+Culture%3AHistory',  rows: PAGE_MAX, cat: CATEGORY.HISTORY_IDEAS,  subcat: SUBCATEGORY.MODERN_HISTORY },
  { piCat: 'Philosophy',                     rows: PAGE_MAX, cat: CATEGORY.HISTORY_IDEAS,  subcat: SUBCATEGORY.PHILOSOPHY_ETHICS },
  { piCat: 'News',                           rows: PAGE_MAX, cat: CATEGORY.HISTORY_IDEAS,  subcat: SUBCATEGORY.POLITICS_GEOPOLITICS },
  // Mind & Body
  { piCat: 'Health+%26+Fitness',             rows: PAGE_MAX, cat: CATEGORY.MIND_BODY,      subcat: SUBCATEGORY.NUTRITION_HEALTH },
  { piCat: 'Health+%26+Fitness%3AMental+Health', rows: PAGE_MAX, cat: CATEGORY.MIND_BODY,  subcat: SUBCATEGORY.MENTAL_HEALTH },
  // Games & Hobbies
  { piCat: 'Sports',                         rows: PAGE_MAX, cat: CATEGORY.GAMES_HOBBIES,  subcat: SUBCATEGORY.SPORTS_ATHLETICS },
  { piCat: 'Leisure%3AGames',                rows: PAGE_MAX, cat: CATEGORY.GAMES_HOBBIES,  subcat: SUBCATEGORY.VIDEO_GAMES },
  { piCat: 'Leisure%3AFood',                 rows: PAGE_MAX, cat: CATEGORY.GAMES_HOBBIES,  subcat: SUBCATEGORY.COOKING_FOOD },
  { piCat: 'Leisure%3AHobbies',              rows: PAGE_MAX, cat: CATEGORY.GAMES_HOBBIES,  subcat: null },
  // People & Places
  { piCat: 'Society+%26+Culture%3APlaces+%26+Travel', rows: PAGE_MAX, cat: CATEGORY.PEOPLE_PLACES, subcat: SUBCATEGORY.TRAVEL_EXPLORATION },
  { piCat: 'Education',                      rows: PAGE_MAX, cat: CATEGORY.PEOPLE_PLACES,  subcat: null },
  // Weird & Wonderful
  { piCat: 'Comedy',                         rows: PAGE_MAX, cat: CATEGORY.WEIRD_WONDERFUL, subcat: SUBCATEGORY.ABSURDIST_HUMOUR },
  { piCat: 'True+Crime',                     rows: PAGE_MAX, cat: CATEGORY.WEIRD_WONDERFUL, subcat: SUBCATEGORY.TRUE_CRIME_MYSTERIES },
  { piCat: 'Society+%26+Culture',            rows: PAGE_MAX, cat: CATEGORY.WEIRD_WONDERFUL, subcat: null },
];

// ── Fetch one category ────────────────────────────────────────────────────────
async function fetchCategory(apiKey, apiSecret, piCat, max) {
  const url = `https://api.podcastindex.org/api/1.0/podcasts/bycategory?cat=${piCat}&max=${max}&lang=en`;
  let res;
  try {
    res = await fetchWithRetry(url, { headers: buildAuthHeaders(apiKey, apiSecret) });
  } catch (err) {
    console.warn(`[podcastindex] Fetch error: ${err.message}`);
    return [];
  }

  let data;
  try { data = await res.json(); } catch { return []; }

  const feeds = data?.feeds ?? [];
  return feeds
    .filter((f) => f.link && f.link.startsWith('http'))
    .map((f) => ({
      url:          f.link,
      title:        f.title ?? null,
      description:  f.description?.trim().slice(0, 500) ?? null,
      og_image_url: f.artwork ?? f.image ?? null,
      source:       'podcastindex',
    }));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function fetchPodcastIndex() {
  const apiKey    = process.env.PODCAST_INDEX_API_KEY;
  const apiSecret = process.env.PODCAST_INDEX_API_SECRET;
  if (!apiKey || !apiSecret) {
    console.error('[podcastindex] PODCAST_INDEX_API_KEY and PODCAST_INDEX_API_SECRET must be set in .env');
    console.error('[podcastindex] Register free at: https://api.podcastindex.org/');
    process.exit(1);
  }

  const allRows = [];
  const seen    = new Set();
  const startMs = Date.now();

  for (let i = 0; i < CATEGORY_MAP.length; i++) {
    const { piCat, rows: max, cat, subcat } = CATEGORY_MAP[i];
    const items = await fetchCategory(apiKey, apiSecret, piCat, max);

    for (const item of items) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      allRows.push({ ...item, category_id: cat, subcategory_id: subcat ?? null });
    }

    process.stdout.write(`\r[podcastindex] ${i + 1}/${CATEGORY_MAP.length} categories  total=${allRows.length}  eta=${fmtEta(i + 1, CATEGORY_MAP.length, startMs)}  `);
    await sleep(DELAY_MS);
  }

  console.log(`\n\n[podcastindex] Total unique podcast homepages: ${allRows.length}`);
  return allRows;
}

async function main() {
  console.log('=== Podcast Index seeder ===');

  let rows;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[podcastindex] Loaded ${rows.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    rows = await fetchPodcastIndex();
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(rows));
    console.log(`[podcastindex] Cached ${rows.length} rows to ${CACHE_FILE}`);
  }

  console.log(`\n[podcastindex] Total: ${rows.length} — upserting...`);
  const result = await upsertUrls(rows, { fetchOg: false, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => { console.error(err); process.exit(1); });
