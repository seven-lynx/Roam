/**
 * seed-internetarchive.js — Internet Archive seeder
 *
 * Pulls items from Archive.org's Advanced Search API (no key required).
 * Covers texts, audio, video, and software across all Roam categories.
 *
 * API docs: https://archive.org/advancedsearch.php
 *
 * Run from repo root:
 *   node scripts/seed-internetarchive.js
 *   node scripts/seed-internetarchive.js --no-cache
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'internetarchive.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const PAGE_SIZE = 500;   // max rows per API request
const DELAY_MS  = 1000;  // 1s between requests

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Queries → Roam categories ─────────────────────────────────────────────────
// Each entry runs one search query and assigns all results to a category.
// Using subject: and collection: filters to get focused results.
const QUERY_MAP = [
  // Science
  { q: 'subject:science AND mediatype:texts',            pages: 4, categoryId: CATEGORY.SCIENCE },
  { q: 'subject:astronomy AND mediatype:texts',          pages: 3, categoryId: CATEGORY.SCIENCE },
  { q: 'subject:biology AND mediatype:texts',            pages: 3, categoryId: CATEGORY.SCIENCE },
  { q: 'subject:physics AND mediatype:texts',            pages: 3, categoryId: CATEGORY.SCIENCE },
  { q: 'subject:mathematics AND mediatype:texts',        pages: 3, categoryId: CATEGORY.SCIENCE },
  { q: 'subject:chemistry AND mediatype:texts',          pages: 2, categoryId: CATEGORY.SCIENCE },
  { q: 'collection:nasa AND mediatype:texts',            pages: 2, categoryId: CATEGORY.SCIENCE },

  // Technology
  { q: 'subject:computers AND mediatype:texts',          pages: 4, categoryId: CATEGORY.TECHNOLOGY },
  { q: 'subject:technology AND mediatype:texts',         pages: 3, categoryId: CATEGORY.TECHNOLOGY },
  { q: 'subject:"artificial intelligence" AND mediatype:texts', pages: 2, categoryId: CATEGORY.TECHNOLOGY },
  { q: 'subject:engineering AND mediatype:texts',        pages: 3, categoryId: CATEGORY.TECHNOLOGY },
  { q: 'subject:robotics AND mediatype:texts',           pages: 2, categoryId: CATEGORY.TECHNOLOGY },
  { q: 'collection:softwarelibrary AND mediatype:software', pages: 3, categoryId: CATEGORY.TECHNOLOGY },

  // Arts & Culture
  { q: 'subject:art AND mediatype:texts',                pages: 3, categoryId: CATEGORY.ARTS_CULTURE },
  { q: 'subject:music AND mediatype:audio',              pages: 3, categoryId: CATEGORY.ARTS_CULTURE },
  { q: 'subject:film AND mediatype:movies',              pages: 3, categoryId: CATEGORY.ARTS_CULTURE },
  { q: 'subject:poetry AND mediatype:texts',             pages: 2, categoryId: CATEGORY.ARTS_CULTURE },
  { q: 'subject:literature AND mediatype:texts',         pages: 3, categoryId: CATEGORY.ARTS_CULTURE },
  { q: 'subject:architecture AND mediatype:texts',       pages: 2, categoryId: CATEGORY.ARTS_CULTURE },
  { q: 'subject:photography AND mediatype:texts',        pages: 2, categoryId: CATEGORY.ARTS_CULTURE },

  // History & Ideas
  { q: 'subject:history AND mediatype:texts',            pages: 4, categoryId: CATEGORY.HISTORY_IDEAS },
  { q: 'subject:philosophy AND mediatype:texts',         pages: 3, categoryId: CATEGORY.HISTORY_IDEAS },
  { q: 'subject:economics AND mediatype:texts',          pages: 2, categoryId: CATEGORY.HISTORY_IDEAS },
  { q: 'subject:biography AND mediatype:texts',          pages: 3, categoryId: CATEGORY.HISTORY_IDEAS },
  { q: 'subject:"world war" AND mediatype:texts',        pages: 2, categoryId: CATEGORY.HISTORY_IDEAS },
  { q: 'subject:religion AND mediatype:texts',           pages: 2, categoryId: CATEGORY.HISTORY_IDEAS },
  { q: 'subject:anthropology AND mediatype:texts',       pages: 2, categoryId: CATEGORY.HISTORY_IDEAS },

  // Games & Hobbies
  { q: 'subject:games AND mediatype:texts',              pages: 2, categoryId: CATEGORY.GAMES_HOBBIES },
  { q: 'collection:gamesdonequick AND mediatype:movies', pages: 2, categoryId: CATEGORY.GAMES_HOBBIES },
  { q: 'subject:cooking AND mediatype:texts',            pages: 2, categoryId: CATEGORY.GAMES_HOBBIES },
  { q: 'subject:gardening AND mediatype:texts',          pages: 2, categoryId: CATEGORY.GAMES_HOBBIES },
  { q: 'subject:sports AND mediatype:texts',             pages: 2, categoryId: CATEGORY.GAMES_HOBBIES },
  { q: 'subject:"science fiction" AND mediatype:texts',  pages: 2, categoryId: CATEGORY.GAMES_HOBBIES },

  // Weird & Wonderful
  { q: 'subject:mythology AND mediatype:texts',          pages: 2, categoryId: CATEGORY.WEIRD_WONDERFUL },
  { q: 'subject:folklore AND mediatype:texts',           pages: 2, categoryId: CATEGORY.WEIRD_WONDERFUL },
  { q: 'subject:magic AND mediatype:texts',              pages: 2, categoryId: CATEGORY.WEIRD_WONDERFUL },
  { q: 'subject:occult AND mediatype:texts',             pages: 2, categoryId: CATEGORY.WEIRD_WONDERFUL },
  { q: 'collection:outerspacetv AND mediatype:movies',   pages: 2, categoryId: CATEGORY.WEIRD_WONDERFUL },
  { q: 'subject:curiosities AND mediatype:texts',        pages: 2, categoryId: CATEGORY.WEIRD_WONDERFUL },

  // People & Places
  { q: 'subject:travel AND mediatype:texts',             pages: 3, categoryId: CATEGORY.PEOPLE_PLACES },
  { q: 'subject:geography AND mediatype:texts',          pages: 2, categoryId: CATEGORY.PEOPLE_PLACES },
  { q: 'subject:exploration AND mediatype:texts',        pages: 2, categoryId: CATEGORY.PEOPLE_PLACES },
  { q: 'subject:africa AND mediatype:texts',             pages: 2, categoryId: CATEGORY.PEOPLE_PLACES },
  { q: 'subject:asia AND mediatype:texts',               pages: 2, categoryId: CATEGORY.PEOPLE_PLACES },

  // Mind & Body
  { q: 'subject:psychology AND mediatype:texts',         pages: 3, categoryId: CATEGORY.MIND_BODY },
  { q: 'subject:medicine AND mediatype:texts',           pages: 3, categoryId: CATEGORY.MIND_BODY },
  { q: 'subject:nutrition AND mediatype:texts',          pages: 2, categoryId: CATEGORY.MIND_BODY },
  { q: 'subject:"mental health" AND mediatype:texts',    pages: 2, categoryId: CATEGORY.MIND_BODY },
  { q: 'subject:yoga AND mediatype:texts',               pages: 2, categoryId: CATEGORY.MIND_BODY },
];

// ── Fetch one page of results ─────────────────────────────────────────────────
async function fetchPage(q, page, categoryId) {
  const params = new URLSearchParams({
    q,
    'fl[]': 'identifier,title,description,creator,subject,mediatype',
    rows:   String(PAGE_SIZE),
    page:   String(page),
    output: 'json',
    'sort[]': 'downloads desc',
  });
  const url = `https://archive.org/advancedsearch.php?${params}`;

  let res;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)' },
    });
  } catch (err) {
    console.warn(`[ia]   fetch error: ${err.message}`);
    return [];
  }

  if (!res.ok) {
    console.warn(`[ia]   HTTP ${res.status} for query: ${q.slice(0, 60)}`);
    return [];
  }

  let json;
  try {
    json = await res.json();
  } catch {
    console.warn(`[ia]   JSON parse error for query: ${q.slice(0, 60)}`);
    return [];
  }

  const docs = json?.response?.docs ?? [];

  return docs
    .filter((d) => d.identifier)
    .map((d) => {
      const identifier = d.identifier;
      const mediatype  = d.mediatype ?? 'texts';

      const itemUrl = `https://archive.org/details/${encodeURIComponent(identifier)}`;

      // Cover image — Archive.org serves thumbnails at a predictable URL
      const ogImage = `https://archive.org/services/img/${encodeURIComponent(identifier)}`;

      const rawDesc = Array.isArray(d.description)
        ? d.description[0]
        : (d.description ?? null);
      const description = rawDesc
        ? String(rawDesc).replace(/<[^>]+>/g, '').trim().slice(0, 500)
        : null;

      const title = d.title ? String(d.title).trim() : null;
      if (!title) return null;

      return {
        url:         itemUrl,
        title,
        description,
        og_image_url: ogImage,
        category_id: categoryId,
        source:      'internetarchive',
      };
    })
    .filter(Boolean);
}

// ── Main fetch loop ───────────────────────────────────────────────────────────
async function fetchInternetArchive() {
  const allRows = [];
  const seen    = new Set();

  let totalQueries = QUERY_MAP.reduce((sum, e) => sum + e.pages, 0);
  console.log(`\n[ia] Fetching ${QUERY_MAP.length} query groups (${totalQueries} pages total)...`);

  for (const { q, pages, categoryId } of QUERY_MAP) {
    let groupCount = 0;
    for (let page = 1; page <= pages; page++) {
      const rows = await fetchPage(q, page, categoryId);
      for (const row of rows) {
        if (!seen.has(row.url)) {
          seen.add(row.url);
          allRows.push(row);
          groupCount++;
        }
      }
      await sleep(DELAY_MS);
    }
    console.log(`[ia]   "${q.slice(0, 55)}": ${groupCount} unique`);
  }

  console.log(`\n[ia] Total unique items collected: ${allRows.length}`);
  return allRows;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Internet Archive seeder ===');

  let rows;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[ia] Loaded ${rows.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    rows = await fetchInternetArchive();
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(rows));
    console.log(`[ia] Cached ${rows.length} rows to ${CACHE_FILE}`);
  }

  console.log(`\n[ia] Total: ${rows.length} — upserting...`);
  const result = await upsertUrls(rows, { fetchOg: false, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
