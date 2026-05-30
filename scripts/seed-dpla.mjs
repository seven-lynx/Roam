/**
 * seed-dpla.mjs — Digital Public Library of America seeder
 *
 * DPLA aggregates 50M+ digitised items from US museums, libraries, archives and
 * universities. Complements Europeana with American collections.
 *
 * API docs: https://pro.dp.la/developers/api-codex
 * Key:      POST https://api.dp.la/v2/api_key/YOUR_EMAIL — key arrives by email
 * Add to .env: DPLA_API_KEY=your_32_char_key
 *
 * Strategy: query by subject/type, keep isShownAt (link to originating
 * institution's page) as the canonical URL. Filter to English items only.
 * Pagination: page_size=500, page 1–100 max per query (50k items/query cap).
 *
 * Run from repo root:
 *   node scripts/seed-dpla.mjs
 *   node scripts/seed-dpla.mjs --no-cache
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { config as dotenvConfig } from 'dotenv';
import { upsertUrls, CATEGORY, fetchWithRetry } from './lib/seed.js';
import { createCache } from './lib/cache.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../.env') });

const NO_CACHE  = process.argv.includes('--no-cache');
const cache     = createCache('dpla', { noCache: NO_CACHE });

const PAGE_SIZE = 500;   // max allowed by DPLA
const MAX_PAGE  = 100;   // DPLA hard cap — page parameter max
const DELAY_MS  = 400;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Topic queries → Roam categories ──────────────────────────────────────────
// sourceResource.type values: image, text, sound, moving image, physical object
// Max pages per query capped to keep seeder reasonable (500 * maxPages = items)
const QUERIES = [
  // Arts & Culture
  { q: 'painting',                type: 'image', maxPages: 10, cat: CATEGORY.ARTS_CULTURE },
  { q: 'photography portrait',    type: 'image', maxPages: 10, cat: CATEGORY.ARTS_CULTURE },
  { q: 'illustration print',      type: 'image', maxPages: 10, cat: CATEGORY.ARTS_CULTURE },
  { q: 'poster design',           type: 'image', maxPages:  8, cat: CATEGORY.ARTS_CULTURE },
  { q: 'textile costume fashion', type: 'image', maxPages:  6, cat: CATEGORY.ARTS_CULTURE },
  // History & Ideas
  { q: 'civil war photograph',    type: 'image', maxPages: 10, cat: CATEGORY.HISTORY_IDEAS },
  { q: 'map cartography survey',  type: 'image', maxPages:  8, cat: CATEGORY.HISTORY_IDEAS },
  { q: 'newspaper archive',       type: 'text',  maxPages:  8, cat: CATEGORY.HISTORY_IDEAS },
  { q: 'letter diary manuscript', type: 'text',  maxPages:  6, cat: CATEGORY.HISTORY_IDEAS },
  { q: 'immigration ellis island',type: 'image', maxPages:  6, cat: CATEGORY.HISTORY_IDEAS },
  // Science
  { q: 'botanical illustration',  type: 'image', maxPages:  8, cat: CATEGORY.SCIENCE },
  { q: 'natural history specimen',type: 'image', maxPages:  6, cat: CATEGORY.SCIENCE },
  { q: 'astronomy telescope',     type: 'image', maxPages:  6, cat: CATEGORY.SCIENCE },
  { q: 'scientific instrument',   type: 'image', maxPages:  4, cat: CATEGORY.SCIENCE },
  // Technology
  { q: 'railroad industrial machine', type: 'image', maxPages: 6, cat: CATEGORY.TECHNOLOGY },
  { q: 'aviation aircraft',           type: 'image', maxPages: 6, cat: CATEGORY.TECHNOLOGY },
  // People & Places
  { q: 'architecture building historic', type: 'image', maxPages: 8, cat: CATEGORY.PEOPLE_PLACES },
  { q: 'folk culture community',         type: 'image', maxPages: 6, cat: CATEGORY.PEOPLE_PLACES },
  { q: 'landscape panorama',             type: 'image', maxPages: 6, cat: CATEGORY.PEOPLE_PLACES },
  // Weird & Wonderful
  { q: 'curiosity collection oddity', type: 'image', maxPages: 4, cat: CATEGORY.WEIRD_WONDERFUL },
  { q: 'circus performance spectacle', type: 'image', maxPages: 4, cat: CATEGORY.WEIRD_WONDERFUL },
];

// ── Fetch one page ────────────────────────────────────────────────────────────
async function fetchPage(apiKey, q, type, page) {
  const params = new URLSearchParams({
    q:                        q,
    'sourceResource.type':    type,
    'sourceResource.language.name': 'English',
    page_size:                String(PAGE_SIZE),
    page:                     String(page),
    fields:                   'isShownAt,sourceResource.title,sourceResource.description,object,dataProvider',
    api_key:                  apiKey,
  });
  const url = `https://api.dp.la/v2/items?${params}`;

  let res;
  try {
    res = await fetchWithRetry(url, {
      headers: { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)' },
    });
  } catch (err) {
    console.warn(`[dpla] Fetch error: ${err.message}`);
    return { docs: [], count: 0 };
  }

  let data;
  try { data = await res.json(); } catch { return { docs: [], count: 0 }; }

  if (data?.message) {
    console.warn(`[dpla] API message: ${data.message}`);
    return { docs: [], count: 0 };
  }

  return { docs: data?.docs ?? [], count: data?.count ?? 0 };
}

// ── Map DPLA doc → Roam row ───────────────────────────────────────────────────
// When the `fields` param is used, DPLA returns a flat object with dot-notation
// keys like "sourceResource.title" rather than a nested sourceResource object.
function mapDoc(doc) {
  const link = doc.isShownAt;
  if (!link || !link.startsWith('http')) return null;

  // Support both flat (fields-param response) and nested (full response)
  const sr    = doc.sourceResource ?? {};
  const rawTitle = doc['sourceResource.title'] ?? sr.title;
  const rawDesc  = doc['sourceResource.description'] ?? sr.description;
  const title = Array.isArray(rawTitle) ? rawTitle[0] : rawTitle;
  const desc  = Array.isArray(rawDesc)  ? rawDesc[0]  : rawDesc;
  const img   = doc.object ?? null;

  return {
    url:          link,
    title:        title ? String(title).trim().slice(0, 300) : null,
    description:  desc  ? String(desc).trim().slice(0, 500) : null,
    og_image_url: img   ? String(img).trim() : null,
    source:       'dpla',
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function fetchDpla() {
  const apiKey = process.env.DPLA_API_KEY;
  if (!apiKey) {
    console.error('[dpla] DPLA_API_KEY not set in .env');
    console.error('[dpla] Request a key: curl -XPOST https://api.dp.la/v2/api_key/YOUR_EMAIL');
    process.exit(1);
  }

  const allRows = [];
  const seen    = new Set();

  for (let qi = 0; qi < QUERIES.length; qi++) {
    const { q, type, maxPages, cat } = QUERIES[qi];

    for (let page = 1; page <= Math.min(maxPages, MAX_PAGE); page++) {
      const cacheKey = `${q}|${type}|p${page}`;
      let result = cache.get(cacheKey);
      if (!result) {
        result = await fetchPage(apiKey, q, type, page);
        cache.set(cacheKey, result);
      }

      const { docs, count } = result;
      if (docs.length === 0) break;

      for (const doc of docs) {
        const row = mapDoc(doc);
        if (!row || seen.has(row.url)) continue;
        seen.add(row.url);
        allRows.push({ ...row, category_id: cat });
      }

      // Stop early if we've exhausted the result set
      if (page * PAGE_SIZE >= count || docs.length < PAGE_SIZE) break;

      await sleep(DELAY_MS);
    }

    process.stdout.write(`\r[dpla] ${qi + 1}/${QUERIES.length} queries  total=${allRows.length}  `);
    await sleep(DELAY_MS);
  }

  console.log(`\n\n[dpla] Total unique records: ${allRows.length}`);
  return allRows;
}

async function main() {
  console.log('=== DPLA seeder ===');

  const rows = await fetchDpla();
  console.log(`\n[dpla] Total: ${rows.length} — upserting...`);
  const result = await upsertUrls(rows, { fetchOg: false, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => { console.error(err); process.exit(1); });
