/**
 * seed-europeana.mjs — Europeana cultural heritage seeder
 *
 * Europeana aggregates 50M+ digitised objects from European museums, libraries,
 * archives and galleries. Strong signal for Art, History, and Culture categories.
 *
 * API docs: https://api.europeana.eu/
 * Free key:  https://pro.europeana.eu/pages/get-api  (instant approval)
 * Personal key: add EUROPEANA_API_KEY=your_key to .env in the repo root
 * Project key:  apply at europeana.eu after demonstrating personal key usage
 *
 * Strategy: query by topic/TYPE and aggregate item pages linking to the
 * originating institution's record — these are stable, citable URLs.
 *
 * Run from repo root:
 *   node scripts/seed-europeana.mjs
 *   node scripts/seed-europeana.mjs --no-cache
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
const cache      = createCache('europeana', { noCache: NO_CACHE });

const DELAY_MS   = 600;
const PAGE_SIZE  = 100;
const MAX_PER_QUERY = 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Topic queries → Roam categories ──────────────────────────────────────────
// Europeana supports: DATA_PROVIDER, RIGHTS, TYPE (IMAGE/TEXT/VIDEO/SOUND)
// qf = query filter, reusability = open license
const QUERIES = [
  // Arts & Culture
  { q: 'painting',        qf: 'TYPE:IMAGE',  max: MAX_PER_QUERY, cat: CATEGORY.ARTS_CULTURE },
  { q: 'sculpture',       qf: 'TYPE:IMAGE',  max: MAX_PER_QUERY, cat: CATEGORY.ARTS_CULTURE },
  { q: 'drawing',         qf: 'TYPE:IMAGE',  max: MAX_PER_QUERY, cat: CATEGORY.ARTS_CULTURE },
  { q: 'manuscript',      qf: 'TYPE:TEXT',   max: MAX_PER_QUERY, cat: CATEGORY.ARTS_CULTURE },
  { q: 'photograph',      qf: 'TYPE:IMAGE',  max: MAX_PER_QUERY, cat: CATEGORY.ARTS_CULTURE },
  { q: 'fashion textile', qf: 'TYPE:IMAGE',  max: MAX_PER_QUERY, cat: CATEGORY.ARTS_CULTURE },
  // History & Ideas
  { q: 'world war history', qf: 'TYPE:TEXT', max: MAX_PER_QUERY, cat: CATEGORY.HISTORY_IDEAS },
  { q: 'medieval castle', qf: 'TYPE:IMAGE',  max: MAX_PER_QUERY, cat: CATEGORY.HISTORY_IDEAS },
  { q: 'ancient rome greece', qf: 'TYPE:IMAGE', max: MAX_PER_QUERY, cat: CATEGORY.HISTORY_IDEAS },
  { q: 'newspaper journal', qf: 'TYPE:TEXT', max: MAX_PER_QUERY, cat: CATEGORY.HISTORY_IDEAS },
  { q: 'map cartography', qf: 'TYPE:IMAGE',  max: MAX_PER_QUERY, cat: CATEGORY.HISTORY_IDEAS },
  // Science
  { q: 'natural history specimen', qf: 'TYPE:IMAGE', max: MAX_PER_QUERY, cat: CATEGORY.SCIENCE },
  { q: 'botanical illustration',   qf: 'TYPE:IMAGE', max: MAX_PER_QUERY, cat: CATEGORY.SCIENCE },
  { q: 'scientific instrument',    qf: 'TYPE:IMAGE', max: MAX_PER_QUERY, cat: CATEGORY.SCIENCE },
  // Technology
  { q: 'industrial revolution machine', qf: 'TYPE:IMAGE', max: MAX_PER_QUERY, cat: CATEGORY.TECHNOLOGY },
  // People & Places
  { q: 'folk culture tradition', qf: 'TYPE:IMAGE', max: MAX_PER_QUERY, cat: CATEGORY.PEOPLE_PLACES },
  { q: 'architecture building',  qf: 'TYPE:IMAGE', max: MAX_PER_QUERY, cat: CATEGORY.PEOPLE_PLACES },
  // Weird & Wonderful
  { q: 'curiosity cabinet wonder', qf: 'TYPE:IMAGE', max: MAX_PER_QUERY, cat: CATEGORY.WEIRD_WONDERFUL },
];

// ── Fetch one page ────────────────────────────────────────────────────────────
// Uses cursor-based pagination — pass cursor='*' for the first page, then
// pass the nextCursor value from each response to advance. Returns
// { items, nextCursor } where nextCursor is null when the set is exhausted.
async function fetchPage(apiKey, q, qf, cursor) {
  const params = new URLSearchParams({
    query:        q,
    cursor:       cursor,
    rows:         String(PAGE_SIZE),
    profile:      'standard',
    reusability:  'open',
  });
  params.append('qf', qf);           // TYPE filter (IMAGE/TEXT/etc.)
  params.append('qf', 'LANGUAGE:en'); // English-language items only
  const url = `https://api.europeana.eu/record/v2/search.json?${params}`;

  let res;
  try {
    res = await fetchWithRetry(url, {
      headers: {
        'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)',
        'X-Api-Key':  apiKey,
      },
    });
  } catch (err) {
    console.warn(`[europeana] Fetch error: ${err.message}`);
    return { items: [], nextCursor: null };
  }

  let data;
  try { data = await res.json(); } catch { return { items: [], nextCursor: null }; }

  const items = (data?.items ?? [])
    .filter((item) => item.edmIsShownAt || item.guid)
    .map((item) => {
      // Prefer the original institution's record page over Europeana's own page
      const link = (Array.isArray(item.edmIsShownAt)
        ? item.edmIsShownAt[0] : item.edmIsShownAt)
        ?? item.guid;
      if (!link || !link.startsWith('http')) return null;

      const title = Array.isArray(item.title) ? item.title[0] : item.title;
      const desc  = Array.isArray(item.dcDescription) ? item.dcDescription[0] : item.dcDescription;
      const img   = Array.isArray(item.edmPreview) ? item.edmPreview[0] : item.edmPreview;

      return {
        url:         link,
        title:       title ?? null,
        description: desc ? String(desc).trim().slice(0, 500) : null,
        og_image_url: img ?? null,
        source:      'europeana',
      };
    }).filter(Boolean);

  return { items, nextCursor: data?.nextCursor ?? null };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function fetchEuropeana() {
  const apiKey = process.env.EUROPEANA_API_KEY;
  if (!apiKey) {
    console.error('[europeana] EUROPEANA_API_KEY not set in .env');
    console.error('[europeana] Get a free key at: https://pro.europeana.eu/pages/get-api');
    process.exit(1);
  }

  const allRows = [];
  const seen    = new Set();

  for (let qi = 0; qi < QUERIES.length; qi++) {
    const { q, qf, max, cat } = QUERIES[qi];
    let cursor  = '*';  // '*' = first page; subsequent pages use nextCursor from response
    let fetched = 0;

    while (fetched < max) {
      const cacheKey = `${q}|${qf}|cursor:${cursor}`;
      let cached = cache.get(cacheKey);
      if (!cached) {
        cached = await fetchPage(apiKey, q, qf, cursor);
        cache.set(cacheKey, cached);
      }
      const { items, nextCursor } = cached;
      if (items.length === 0) break;

      for (const item of items) {
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        allRows.push({ ...item, category_id: cat });
      }

      fetched += items.length;
      if (!nextCursor || items.length < PAGE_SIZE) break;
      cursor = nextCursor;
      await sleep(DELAY_MS);
    }

    process.stdout.write(`\r[europeana] ${qi + 1}/${QUERIES.length} queries  total=${allRows.length}  `);
    await sleep(DELAY_MS);
  }

  console.log(`\n\n[europeana] Total unique records: ${allRows.length}`);
  return allRows;
}

async function main() {
  console.log('=== Europeana seeder ===');

  const rows = await fetchEuropeana();
  console.log(`\n[europeana] Total: ${rows.length} — upserting...`);
  const result = await upsertUrls(rows, { fetchOg: false, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => { console.error(err); process.exit(1); });
