/**
 * seed-metmuseum.js — Metropolitan Museum of Art seeder (via Wikidata SPARQL)
 *
 * Uses Wikidata's free SPARQL endpoint to fetch Met Museum artworks.
 * Items are identified by Wikidata property P3634 (The Met object ID).
 * Museum URL is constructed as https://www.metmuseum.org/art/collection/search/{metId}
 *
 * Avoids the Met's Incapsula WAF that blocks programmatic API access.
 * Wikidata has ~30K+ Met items with English labels, ~12K with images.
 *
 * Strategy:
 *  1. Query Wikidata SPARQL, paginated at 5000 items per page
 *  2. Build rows with optional Wikimedia image thumbnails
 *  3. Upsert to Supabase
 *
 * Run from repo root:
 *   node scripts/seed-metmuseum.js
 *   node scripts/seed-metmuseum.js --reset    # clear checkpoint and restart
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY } from './lib/seed.js';

const __dirname      = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR      = resolve(__dirname, '.cache');
const PROGRESS_FILE  = resolve(CACHE_DIR, 'metmuseum-progress.json');
const RESET          = process.argv.includes('--reset');

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const PAGE_SIZE       = 5000;
const UPSERT_BATCH    = 500;
const DELAY_MS        = 2000; // 2s between SPARQL pages — be polite to Wikidata

const sleep = ms => new Promise(r => setTimeout(r, ms));

mkdirSync(CACHE_DIR, { recursive: true });

// ── Wikidata image → Wikimedia thumbnail URL ──────────────────────────────────
// Wikidata P18 values: "http://commons.wikimedia.org/wiki/Special:FilePath/Foo.jpg"
function wikimediaThumb(wikidataImageUrl) {
  if (!wikidataImageUrl) return null;
  const filename = wikidataImageUrl.replace(/.*Special:FilePath\//, '');
  if (!filename) return null;
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${filename}?width=400`;
}

// ── SPARQL query (paginated) ──────────────────────────────────────────────────
function buildQuery(offset) {
  return `
SELECT DISTINCT ?metId ?title ?image ?artistName ?date WHERE {
  ?item wdt:P3634 ?metId .
  ?item rdfs:label ?title FILTER(LANG(?title) = "en") .
  OPTIONAL { ?item wdt:P18 ?image }
  OPTIONAL {
    ?item wdt:P170 ?artist .
    ?artist rdfs:label ?artistName FILTER(LANG(?artistName) = "en")
  }
  OPTIONAL { ?item wdt:P571 ?date }
}
LIMIT ${PAGE_SIZE}
OFFSET ${offset}
`.trim();
}

// ── Run a SPARQL query with retries ──────────────────────────────────────────
async function runSparql(offset, attempt = 0) {
  const query = buildQuery(offset);
  const url   = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'RoamSeeder/1.0 (https://roamtheweb.app)',
      'Accept':     'application/sparql-results+json',
    },
  });

  if (res.status === 429 || res.status === 502 || res.status === 503) {
    if (attempt >= 3) throw new Error(`SPARQL ${res.status} after 3 retries`);
    const wait = (attempt + 1) * 10000;
    console.warn(`[met] SPARQL ${res.status} — waiting ${wait / 1000}s before retry...`);
    await sleep(wait);
    return runSparql(offset, attempt + 1);
  }

  if (!res.ok) throw new Error(`SPARQL HTTP ${res.status}`);
  const data = await res.json();
  return data.results.bindings;
}

// ── Convert a Wikidata SPARQL binding row → Roam row ─────────────────────────
function bindingToRow(b) {
  const metId = b.metId?.value;
  if (!metId) return null;

  const title = b.title?.value?.slice(0, 255) ?? null;
  if (!title) return null;

  const parts = [];
  if (b.artistName?.value) parts.push(b.artistName.value);
  if (b.date?.value) {
    // ISO date from Wikidata — extract year only
    const year = b.date.value.replace(/^\+?(\d{1,4}).*/, '$1');
    if (year) parts.push(year);
  }
  const description = parts.join(' · ').slice(0, 500) || null;

  return {
    url:          `https://www.metmuseum.org/art/collection/search/${metId}`,
    title,
    description,
    og_image_url: wikimediaThumb(b.image?.value),
    category_id:  CATEGORY.ARTS_CULTURE,
    source:       'metmuseum',
  };
}

// ── Load / save checkpoint ─────────────────────────────────────────────────────
function loadProgress() {
  if (RESET || !existsSync(PROGRESS_FILE)) return { offset: 0, totalRows: 0 };
  try {
    return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8'));
  } catch {
    return { offset: 0, totalRows: 0 };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n========== Met Museum Seeder (Wikidata) ==========\n');

  const { offset: startOffset, totalRows: startTotal } = loadProgress();
  if (startOffset > 0) {
    console.log(`[met] Resuming from offset ${startOffset} (${startTotal} rows already upserted)`);
  }

  let offset    = startOffset;
  let totalRows = startTotal;
  let pageNum   = Math.floor(offset / PAGE_SIZE) + 1;

  while (true) {
    console.log(`[met] SPARQL page ${pageNum} (offset ${offset})...`);
    const bindings = await runSparql(offset);

    if (bindings.length === 0) {
      console.log('[met] No more results — done fetching.');
      break;
    }

    const rows = bindings.map(bindingToRow).filter(Boolean);
    console.log(`[met]   ${bindings.length} results → ${rows.length} valid rows`);

    if (rows.length > 0) {
      for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
        await upsertUrls(rows.slice(i, i + UPSERT_BATCH), { fetchOg: false, verbose: false });
      }
      totalRows += rows.length;
    }

    offset  += PAGE_SIZE;
    pageNum += 1;
    writeFileSync(PROGRESS_FILE, JSON.stringify({ offset, totalRows }));
    console.log(`[met]   cumulative upserted: ${totalRows}`);

    if (bindings.length < PAGE_SIZE) {
      console.log('[met] Last page reached.');
      break;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n[met] Complete — ${totalRows} total rows upserted`);
  writeFileSync(PROGRESS_FILE, JSON.stringify({ complete: true, totalRows }));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
