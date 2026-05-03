/**
 * seed-loc.mjs — Library of Congress seeder
 *
 * Pulls items from the Library of Congress public API (loc.gov/api).
 * Covers historical photographs, manuscripts, newspapers, maps, audio,
 * and digital collections — primary sources unavailable anywhere else.
 *
 * No API key required.
 * API docs: https://www.loc.gov/apis/json-and-yaml/requests/
 *
 * Run from repo root:
 *   node scripts/seed-loc.mjs
 *   node scripts/seed-loc.mjs --no-cache
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { config as dotenvConfig } from 'dotenv';
import { upsertUrls, CATEGORY, fetchWithRetry } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../.env') });

const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'loc.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const DELAY_MS   = 1000; // LoC asks for polite crawling
const PAGE_SIZE  = 100;  // max per request
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Collections to query ──────────────────────────────────────────────────────
// Each entry specifies a search query + format filter + Roam category.
// LoC format values: photo, map, manuscript, newspaper, audio, video, web page
const QUERIES = [
  // ── History & Ideas ────────────────────────────────────────────────────────
  { q: 'american history',       fa: 'online-format:web+page',        pages: 5, categoryId: CATEGORY.HISTORY_IDEAS },
  { q: 'civil war',              fa: 'online-format:web+page',        pages: 3, categoryId: CATEGORY.HISTORY_IDEAS },
  { q: 'world war',              fa: 'online-format:web+page',        pages: 3, categoryId: CATEGORY.HISTORY_IDEAS },
  { q: 'suffrage women rights',  fa: 'online-format:web+page',        pages: 2, categoryId: CATEGORY.HISTORY_IDEAS },
  { q: 'constitution democracy', fa: 'online-format:web+page',        pages: 2, categoryId: CATEGORY.HISTORY_IDEAS },

  // ── Science ────────────────────────────────────────────────────────────────
  { q: 'science invention',      fa: 'online-format:web+page',        pages: 3, categoryId: CATEGORY.SCIENCE },
  { q: 'astronomy space',        fa: 'online-format:web+page',        pages: 2, categoryId: CATEGORY.SCIENCE },
  { q: 'nature wildlife',        fa: 'online-format:web+page',        pages: 2, categoryId: CATEGORY.SCIENCE },

  // ── Arts & Culture ─────────────────────────────────────────────────────────
  { q: 'music american',         fa: 'online-format:web+page',        pages: 3, categoryId: CATEGORY.ARTS_CULTURE },
  { q: 'folk art craft',         fa: 'online-format:web+page',        pages: 2, categoryId: CATEGORY.ARTS_CULTURE },
  { q: 'literature poetry',      fa: 'online-format:web+page',        pages: 2, categoryId: CATEGORY.ARTS_CULTURE },
  { q: 'architecture buildings', fa: 'online-format:web+page',        pages: 2, categoryId: CATEGORY.ARTS_CULTURE },

  // ── People & Places ────────────────────────────────────────────────────────
  { q: 'immigration culture',    fa: 'online-format:web+page',        pages: 3, categoryId: CATEGORY.PEOPLE_PLACES },
  { q: 'maps geography',         fa: 'online-format:web+page',        pages: 3, categoryId: CATEGORY.PEOPLE_PLACES },

  // ── Weird & Wonderful ──────────────────────────────────────────────────────
  { q: 'curiosities unusual rare', fa: 'online-format:web+page',      pages: 2, categoryId: CATEGORY.WEIRD_WONDERFUL },
];

// ── Fetch one page of results ─────────────────────────────────────────────────
async function fetchPage(q, fa, page) {
  const params = new URLSearchParams({
    q,
    fo:  'json',
    c:   String(PAGE_SIZE),
    sp:  String(page),
    ...(fa ? { fa } : {}),
  });

  const url = `https://www.loc.gov/search/?${params}`;
  const res = await fetchWithRetry(url, {
    headers: { 'User-Agent': 'Roam-Seeder/1.0 (+https://roamtheweb.app)' },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

// ── Extract rows from LoC search result ──────────────────────────────────────
function extractRows(data, categoryId) {
  const results = data?.results ?? [];
  const rows = [];

  for (const item of results) {
    // Use the item's own URL (its LoC page, not a raw asset URL)
    const url = item.id
      ? `https://www.loc.gov${item.id}`.replace(/\/$/, '') // strip trailing slash
      : null;
    if (!url || !url.startsWith('https://www.loc.gov')) continue;

    // Skip non-browseable types (raw image files, PDFs, etc.)
    if (url.match(/\.(jpg|jpeg|png|gif|tif|tiff|pdf|mp3|mp4|wav|mpeg)$/i)) continue;

    const title = typeof item.title === 'string'
      ? item.title.trim()
      : (Array.isArray(item.title) ? item.title[0]?.trim() : null);
    if (!title) continue;

    const description = item.description
      ? (Array.isArray(item.description) ? item.description[0] : item.description)
          .slice(0, 500)
      : null;

    const ogImage = item.image_url
      ? (Array.isArray(item.image_url) ? item.image_url[0] : item.image_url)
      : null;

    rows.push({
      url,
      title,
      description,
      og_image_url: typeof ogImage === 'string' ? ogImage : null,
      category_id:  categoryId,
      source:       'loc',
    });
  }

  return rows;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Library of Congress seeder ===\n');

  let all;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    all = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[loc] Loaded ${all.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    all = [];
    const seen = new Set();

    for (const { q, fa, pages, categoryId } of QUERIES) {
      console.log(`[loc] Query: "${q}"  (${pages} pages)`);

      for (let page = 1; page <= pages; page++) {
        let data;
        try {
          data = await fetchPage(q, fa, page);
        } catch (err) {
          console.warn(`[loc]   page ${page}: ${err.message}`);
          break;
        }

        const rows = extractRows(data, categoryId);
        let added = 0;
        for (const row of rows) {
          if (!seen.has(row.url)) {
            seen.add(row.url);
            all.push(row);
            added++;
          }
        }

        process.stdout.write(`\r[loc]   page ${page}/${pages}  added=${added}  total=${all.length}  `);
        await sleep(DELAY_MS);
      }
      console.log('');
    }

    console.log(`\n[loc] Total collected: ${all.length}`);
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(all));
  }

  console.log(`\n[loc] Total: ${all.length} — upserting...`);
  const result = await upsertUrls(all, { fetchOg: false, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
