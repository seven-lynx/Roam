/**
 * seed-wiby.js — wiby.me seeder
 *
 * wiby.me is a search engine for old-style personal websites — exactly the
 * kind of hidden-gem content Roam is built to surface.
 *
 * Strategy: search for keywords across all categories, parse the HTML results
 * pages to extract URLs, titles, and descriptions.
 *
 * No API key required. Be polite — wiby.me is run by one person.
 *
 * Run from repo root:
 *   node scripts/seed-wiby.js
 *   node scripts/seed-wiby.js --no-cache
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'wiby.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const PAGES_PER_QUERY = 3;   // wiby returns ~10 results/page; 3 pages = ~30 per keyword
const DELAY_MS        = 2000; // be very polite to this small indie search engine

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmtEta = (done, total, startMs) => {
  if (done === 0) return '?';
  const s = Math.round(((Date.now() - startMs) / done) * (total - done) / 1000);
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
};

// ── Search terms → Roam categories ───────────────────────────────────────────
const QUERIES = [
  // Science
  { q: 'astronomy',          categoryId: CATEGORY.SCIENCE },
  { q: 'physics',            categoryId: CATEGORY.SCIENCE },
  { q: 'biology',            categoryId: CATEGORY.SCIENCE },
  { q: 'mathematics',        categoryId: CATEGORY.SCIENCE },
  { q: 'chemistry',          categoryId: CATEGORY.SCIENCE },
  { q: 'geology',            categoryId: CATEGORY.SCIENCE },
  { q: 'ecology nature',     categoryId: CATEGORY.SCIENCE },
  { q: 'space exploration',  categoryId: CATEGORY.SCIENCE },

  // Technology
  { q: 'linux',              categoryId: CATEGORY.TECHNOLOGY },
  { q: 'programming',        categoryId: CATEGORY.TECHNOLOGY },
  { q: 'open source',        categoryId: CATEGORY.TECHNOLOGY },
  { q: 'electronics',        categoryId: CATEGORY.TECHNOLOGY },
  { q: 'amateur radio',      categoryId: CATEGORY.TECHNOLOGY },
  { q: 'hacking',            categoryId: CATEGORY.TECHNOLOGY },
  { q: 'vintage computers',  categoryId: CATEGORY.TECHNOLOGY },
  { q: 'raspberry pi',       categoryId: CATEGORY.TECHNOLOGY },

  // Arts & Culture
  { q: 'art gallery',        categoryId: CATEGORY.ARTS_CULTURE },
  { q: 'music',              categoryId: CATEGORY.ARTS_CULTURE },
  { q: 'poetry',             categoryId: CATEGORY.ARTS_CULTURE },
  { q: 'photography',        categoryId: CATEGORY.ARTS_CULTURE },
  { q: 'literature',         categoryId: CATEGORY.ARTS_CULTURE },
  { q: 'comics',             categoryId: CATEGORY.ARTS_CULTURE },
  { q: 'film cinema',        categoryId: CATEGORY.ARTS_CULTURE },

  // History & Ideas
  { q: 'history',            categoryId: CATEGORY.HISTORY_IDEAS },
  { q: 'philosophy',         categoryId: CATEGORY.HISTORY_IDEAS },
  { q: 'ancient history',    categoryId: CATEGORY.HISTORY_IDEAS },
  { q: 'archaeology',        categoryId: CATEGORY.HISTORY_IDEAS },
  { q: 'mythology',          categoryId: CATEGORY.HISTORY_IDEAS },
  { q: 'economics',          categoryId: CATEGORY.HISTORY_IDEAS },

  // Games & Hobbies
  { q: 'chess',              categoryId: CATEGORY.GAMES_HOBBIES },
  { q: 'board games',        categoryId: CATEGORY.GAMES_HOBBIES },
  { q: 'retro games',        categoryId: CATEGORY.GAMES_HOBBIES },
  { q: 'model trains',       categoryId: CATEGORY.GAMES_HOBBIES },
  { q: 'cooking recipes',    categoryId: CATEGORY.GAMES_HOBBIES },
  { q: 'gardening',          categoryId: CATEGORY.GAMES_HOBBIES },
  { q: 'science fiction',    categoryId: CATEGORY.GAMES_HOBBIES },

  // Weird & Wonderful
  { q: 'weird',              categoryId: CATEGORY.WEIRD_WONDERFUL },
  { q: 'conspiracy',         categoryId: CATEGORY.WEIRD_WONDERFUL },
  { q: 'paranormal',         categoryId: CATEGORY.WEIRD_WONDERFUL },
  { q: 'cryptids',           categoryId: CATEGORY.WEIRD_WONDERFUL },
  { q: 'urban legends',      categoryId: CATEGORY.WEIRD_WONDERFUL },
  { q: 'strange collections', categoryId: CATEGORY.WEIRD_WONDERFUL },

  // People & Places
  { q: 'travel',             categoryId: CATEGORY.PEOPLE_PLACES },
  { q: 'local history',      categoryId: CATEGORY.PEOPLE_PLACES },
  { q: 'personal website',   categoryId: CATEGORY.PEOPLE_PLACES },
  { q: 'genealogy',          categoryId: CATEGORY.PEOPLE_PLACES },
  { q: 'hiking trails',      categoryId: CATEGORY.PEOPLE_PLACES },

  // Mind & Body
  { q: 'meditation',         categoryId: CATEGORY.MIND_BODY },
  { q: 'psychology',         categoryId: CATEGORY.MIND_BODY },
  { q: 'yoga',               categoryId: CATEGORY.MIND_BODY },
  { q: 'mental health',      categoryId: CATEGORY.MIND_BODY },
  { q: 'nutrition',          categoryId: CATEGORY.MIND_BODY },
];

// ── Parse wiby.me HTML search results ────────────────────────────────────────
// wiby result blocks look like:
//   <blockquote>
//     <a class="tlink" href="https://...">Title</a><br>
//     <p class="url">https://...</p><p> snippet </p>
//   </blockquote>
function parseResults(html) {
  const results = [];

  // Match blockquote, extract tlink href + title, skip <p class="url">, get description from second <p>
  const blockRe = /<blockquote>\s*<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<p class="url">[\s\S]*?<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/gi;

  let m;
  while ((m = blockRe.exec(html)) !== null) {
    const url         = m[1].trim();
    const title       = m[2].replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
    const description = m[3].replace(/<[^>]+>/g, '').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim().slice(0, 500);

    if (url && title) {
      results.push({ url, title, description: description || null });
    }
  }

  return results;
}

// ── Fetch one search results page ─────────────────────────────────────────────
async function fetchPage(q, page) {
  const url = `https://wiby.me/?q=${encodeURIComponent(q)}&p=${page}`;

  let res;
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)',
        'Accept': 'text/html',
      },
    });
  } catch (err) {
    console.warn(`[wiby]   "${q}" p${page}: ${err.message}`);
    return [];
  }

  if (!res.ok) {
    console.warn(`[wiby]   "${q}" p${page}: HTTP ${res.status}`);
    return [];
  }

  const html = await res.text();
  return parseResults(html);
}

// ── Main fetch loop ───────────────────────────────────────────────────────────
async function fetchWiby() {
  console.log(`\n[wiby] Searching ${QUERIES.length} queries × ${PAGES_PER_QUERY} pages...`);
  const allRows = [];
  const seen    = new Set();
  const startMs = Date.now();
  let queryIdx  = 0;

  for (const { q, categoryId } of QUERIES) {
    let added = 0;

    for (let page = 1; page <= PAGES_PER_QUERY; page++) {
      const results = await fetchPage(q, page);

      for (const { url, title, description } of results) {
        if (seen.has(url)) continue;
        seen.add(url);
        allRows.push({
          url,
          title,
          description,
          og_image_url: null,
          category_id:  categoryId,
          source:       'wiby',
        });
        added++;
      }

      // Stop paginating if the page returned no results
      if (results.length === 0) break;

      await sleep(DELAY_MS);
    }

    queryIdx++;
    console.log(`[wiby]   ${queryIdx}/${QUERIES.length}  "${q}": ${added} URLs  (total=${allRows.length}, eta=${fmtEta(queryIdx, QUERIES.length, startMs)})`);
  }

  console.log(`\n[wiby] Total unique URLs collected: ${allRows.length}`);
  return allRows;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== wiby.me seeder ===');

  let rows;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[wiby] Loaded ${rows.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    rows = await fetchWiby();
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(rows));
    console.log(`[wiby] Cached ${rows.length} rows to ${CACHE_FILE}`);
  }

  console.log(`\n[wiby] Total: ${rows.length} — upserting (with OG fetch)...`);
  const result = await upsertUrls(rows, { fetchOg: true, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
