/**
 * seed-smithsonian.mjs — Smithsonian Open Access seeder
 *
 * Pulls collection objects from the Smithsonian Institution's Open Access API.
 * Covers 19 Smithsonian museums and the National Zoo — 4.7M+ digitized objects.
 * Stable si.edu collection page URLs, strong cultural heritage signal.
 *
 * API docs: https://edan.si.edu/openaccess/apidocs/
 * Free API key: https://api.si.edu/openaccess/api/v1.0/auth  (instant)
 * Add to .env: SMITHSONIAN_API_KEY=your_key
 *
 * Rate limits: free tier = 1,000 req/day; use a reasonable delay.
 *
 * Run from repo root:
 *   node scripts/seed-smithsonian.mjs
 *   node scripts/seed-smithsonian.mjs --no-cache
 */

import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { config as dotenvConfig } from 'dotenv';
import { upsertUrls, CATEGORY, fetchWithRetry } from './lib/seed.js';
import { createCache } from './lib/cache.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../.env') });

const NO_CACHE   = process.argv.includes('--no-cache');
const cache      = createCache('smithsonian', { noCache: NO_CACHE });

const DELAY_MS = 1200;
const PAGE_SIZE = 100;     // Max rows per request
const MAX_PER_QUERY = 500; // Keep within free-tier daily budget
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Topic queries → Roam categories ──────────────────────────────────────────
const QUERIES = [
  // Science
  { q: 'natural history specimen',  rows: MAX_PER_QUERY, cat: CATEGORY.SCIENCE },
  { q: 'astronomy telescope',       rows: MAX_PER_QUERY, cat: CATEGORY.SCIENCE },
  { q: 'dinosaur fossil',           rows: MAX_PER_QUERY, cat: CATEGORY.SCIENCE },
  { q: 'marine biology ocean',      rows: MAX_PER_QUERY, cat: CATEGORY.SCIENCE },
  // Arts & Culture
  { q: 'painting artwork',          rows: MAX_PER_QUERY, cat: CATEGORY.ARTS_CULTURE },
  { q: 'sculpture artifact',        rows: MAX_PER_QUERY, cat: CATEGORY.ARTS_CULTURE },
  { q: 'photography collection',    rows: MAX_PER_QUERY, cat: CATEGORY.ARTS_CULTURE },
  { q: 'american history museum',   rows: MAX_PER_QUERY, cat: CATEGORY.ARTS_CULTURE },
  // History & Ideas
  { q: 'presidential history',      rows: MAX_PER_QUERY, cat: CATEGORY.HISTORY_IDEAS },
  { q: 'native american culture',   rows: MAX_PER_QUERY, cat: CATEGORY.HISTORY_IDEAS },
  { q: 'civil war military',        rows: MAX_PER_QUERY, cat: CATEGORY.HISTORY_IDEAS },
  { q: 'african american history',  rows: MAX_PER_QUERY, cat: CATEGORY.HISTORY_IDEAS },
  // Technology
  { q: 'invention patent machine',  rows: MAX_PER_QUERY, cat: CATEGORY.TECHNOLOGY },
  { q: 'space flight nasa',         rows: MAX_PER_QUERY, cat: CATEGORY.SCIENCE },
  // People & Places
  { q: 'folk culture anthropology', rows: MAX_PER_QUERY, cat: CATEGORY.PEOPLE_PLACES },
  { q: 'geographic survey map',     rows: MAX_PER_QUERY, cat: CATEGORY.PEOPLE_PLACES },
  // Games & Hobbies
  { q: 'musical instrument',        rows: MAX_PER_QUERY, cat: CATEGORY.ARTS_CULTURE },
  { q: 'zoo animal wildlife',       rows: MAX_PER_QUERY, cat: CATEGORY.GAMES_HOBBIES },
];

// ── Fetch one page of results ─────────────────────────────────────────────────
async function fetchPage(apiKey, q, start, rows) {
  const params = new URLSearchParams({
    q,
    start: String(start),
    rows: String(rows),
    api_key: apiKey,
  });
  const url = `https://api.si.edu/openaccess/api/v1.0/search?${params}`;

  let res;
  let attempts = 0;
  while (attempts < 3) {
    try {
      res = await fetch(url, {
        headers: { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)' },
      });
      if (res.status === 429) {
        console.warn('[smithsonian] Rate limited — waiting 60s...');
        await sleep(60_000);
        continue;
      }
      if (!res.ok) {
        console.warn(`[smithsonian] HTTP ${res.status} for query "${q}"`);
        return [];
      }
      break;
    } catch (err) {
      attempts++;
      console.warn(`[smithsonian] Fetch error: ${err.message} — retry ${attempts}/3`);
      await sleep(5_000 * attempts);
    }
  }
  if (!res?.ok) return [];

  let data;
  try { data = await res.json(); } catch { return []; }

  const items = data?.response?.rows ?? [];
  return items.map((item) => {
    const content = item.content ?? {};
    const desc    = content.indexedStructured?.notes?.[0]
      ?? content.freetext?.notes?.[0]?.content
      ?? content.descriptiveNonRepeating?.title?.content
      ?? null;
    const img     = content.descriptiveNonRepeating?.online_media?.media?.[0]?.thumbnail ?? null;

    // Build collection page URL
    const id  = item.id ?? item.content?.descriptiveNonRepeating?.record_ID;
    const link = item.content?.descriptiveNonRepeating?.record_link
      ?? (id ? `https://collections.si.edu/search/detail/${id}` : null);
    if (!link) return null;

    return {
      url:         link,
      title:       content.descriptiveNonRepeating?.title?.content ?? null,
      description: desc ? String(desc).trim().slice(0, 500) : null,
      og_image_url: img ?? null,
      source:      'smithsonian',
    };
  }).filter(Boolean);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function fetchSmithsonian() {
  const apiKey = process.env.SMITHSONIAN_API_KEY;
  if (!apiKey) {
    console.error('[smithsonian] SMITHSONIAN_API_KEY not set in .env');
    console.error('[smithsonian] Get a free key at: https://api.si.edu/openaccess/api/v1.0/auth');
    process.exit(1);
  }

  const allRows = [];
  const seen    = new Set();

  for (let qi = 0; qi < QUERIES.length; qi++) {
    const { q, rows: maxRows, cat } = QUERIES[qi];
    let start = 0;
    let fetched = 0;

    while (fetched < maxRows) {
      const batchSize = Math.min(PAGE_SIZE, maxRows - fetched);
      const cacheKey  = `${q}:${start}`;
      let items = cache.get(cacheKey);
      if (!items) {
        items = await fetchPage(apiKey, q, start, batchSize);
        cache.set(cacheKey, items);
      }
      if (items.length === 0) break;

      for (const item of items) {
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        allRows.push({ ...item, category_id: cat });
      }

      fetched += items.length;
      start   += items.length;
      if (items.length < batchSize) break;
      await sleep(DELAY_MS);
    }

    process.stdout.write(`\r[smithsonian] ${qi + 1}/${QUERIES.length} queries  total=${allRows.length}  `);
    await sleep(DELAY_MS);
  }

  console.log(`\n\n[smithsonian] Total unique collection pages: ${allRows.length}`);
  return allRows;
}

async function main() {
  console.log('=== Smithsonian Open Access seeder ===');

  const rows = await fetchSmithsonian();
  console.log(`\n[smithsonian] Total: ${rows.length} — upserting...`);
  const result = await upsertUrls(rows, { fetchOg: false, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => { console.error(err); process.exit(1); });
