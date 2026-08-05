/**
 * seed-pinboard.mjs — Pinboard popular bookmarks seeder
 *
 * Pinboard is a fast, no-nonsense bookmarking service used by developers,
 * researchers, and readers. The popular feed surfaces socially-bookmarked
 * links across all topics — a strong human curation signal.
 *
 * Feeds used:
 *   Popular:  https://feeds.pinboard.in/json/popular  (~400 items)
 *   Recent:   https://feeds.pinboard.in/json/recent   (~400 items)
 *   Tag feeds: one request per topic tag for curated subject coverage
 *
 * No API key required.
 *
 * Run from repo root:
 *   node scripts/seed-pinboard.mjs
 *   node scripts/seed-pinboard.mjs --no-cache
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'pinboard.json');
const NO_CACHE   = process.argv.includes('--no-cache');
const DELAY_MS   = 1500;   // Pinboard asks for respectful rate limiting
const sleep  = (ms) => new Promise((r) => setTimeout(r, ms));
const fmtEta = (done, total, startMs) => {
  if (done === 0) return '?';
  const s = Math.round(((Date.now() - startMs) / done) * (total - done) / 1000);
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
};

// ── Curated tag feeds → Roam categories ──────────────────────────────────────
// Tag endpoint: https://feeds.pinboard.in/json/t:TAG  (public tag feed)
const TAG_FEEDS = [
  // Science
  { tag: 'science',        categoryId: CATEGORY.SCIENCE },
  { tag: 'astronomy',      categoryId: CATEGORY.SCIENCE },
  { tag: 'biology',        categoryId: CATEGORY.SCIENCE },
  { tag: 'physics',        categoryId: CATEGORY.SCIENCE },
  { tag: 'climate',        categoryId: CATEGORY.SCIENCE },
  // Technology
  { tag: 'programming',    categoryId: CATEGORY.TECHNOLOGY },
  { tag: 'linux',          categoryId: CATEGORY.TECHNOLOGY },
  { tag: 'security',       categoryId: CATEGORY.TECHNOLOGY },
  { tag: 'ai',             categoryId: CATEGORY.TECHNOLOGY },
  { tag: 'opensource',     categoryId: CATEGORY.TECHNOLOGY },
  // Arts & Culture
  { tag: 'art',            categoryId: CATEGORY.ARTS_CULTURE },
  { tag: 'music',          categoryId: CATEGORY.ARTS_CULTURE },
  { tag: 'photography',    categoryId: CATEGORY.ARTS_CULTURE },
  { tag: 'literature',     categoryId: CATEGORY.ARTS_CULTURE },
  { tag: 'film',           categoryId: CATEGORY.ARTS_CULTURE },
  // History & Ideas
  { tag: 'history',        categoryId: CATEGORY.HISTORY_IDEAS },
  { tag: 'philosophy',     categoryId: CATEGORY.HISTORY_IDEAS },
  { tag: 'politics',       categoryId: CATEGORY.HISTORY_IDEAS },
  { tag: 'economics',      categoryId: CATEGORY.HISTORY_IDEAS },
  // Games & Hobbies
  { tag: 'games',          categoryId: CATEGORY.GAMES_HOBBIES },
  { tag: 'cooking',        categoryId: CATEGORY.GAMES_HOBBIES },
  { tag: 'gardening',      categoryId: CATEGORY.GAMES_HOBBIES },
  // Mind & Body
  { tag: 'health',         categoryId: CATEGORY.MIND_BODY },
  { tag: 'psychology',     categoryId: CATEGORY.MIND_BODY },
  { tag: 'meditation',     categoryId: CATEGORY.MIND_BODY },
  // People & Places
  { tag: 'travel',         categoryId: CATEGORY.PEOPLE_PLACES },
  { tag: 'culture',        categoryId: CATEGORY.PEOPLE_PLACES },
  // Weird & Wonderful
  { tag: 'weird',          categoryId: CATEGORY.WEIRD_WONDERFUL },
  { tag: 'curiosity',      categoryId: CATEGORY.WEIRD_WONDERFUL },
  { tag: 'interesting',    categoryId: CATEGORY.WEIRD_WONDERFUL },
];

// ── Category inference from tags ─────────────────────────────────────────────
const TAG_TO_CATEGORY = {
  science: CATEGORY.SCIENCE, astronomy: CATEGORY.SCIENCE, biology: CATEGORY.SCIENCE,
  physics: CATEGORY.SCIENCE, math: CATEGORY.SCIENCE, chemistry: CATEGORY.SCIENCE,
  nature: CATEGORY.SCIENCE, environment: CATEGORY.SCIENCE, climate: CATEGORY.SCIENCE,
  programming: CATEGORY.TECHNOLOGY, software: CATEGORY.TECHNOLOGY, linux: CATEGORY.TECHNOLOGY,
  security: CATEGORY.TECHNOLOGY, ai: CATEGORY.TECHNOLOGY, machinelearning: CATEGORY.TECHNOLOGY,
  technology: CATEGORY.TECHNOLOGY, webdev: CATEGORY.TECHNOLOGY, javascript: CATEGORY.TECHNOLOGY,
  art: CATEGORY.ARTS_CULTURE, music: CATEGORY.ARTS_CULTURE, photography: CATEGORY.ARTS_CULTURE,
  literature: CATEGORY.ARTS_CULTURE, books: CATEGORY.ARTS_CULTURE, film: CATEGORY.ARTS_CULTURE,
  cinema: CATEGORY.ARTS_CULTURE, design: CATEGORY.ARTS_CULTURE, poetry: CATEGORY.ARTS_CULTURE,
  history: CATEGORY.HISTORY_IDEAS, philosophy: CATEGORY.HISTORY_IDEAS, politics: CATEGORY.HISTORY_IDEAS,
  economics: CATEGORY.HISTORY_IDEAS, sociology: CATEGORY.HISTORY_IDEAS, archaeology: CATEGORY.HISTORY_IDEAS,
  games: CATEGORY.GAMES_HOBBIES, cooking: CATEGORY.GAMES_HOBBIES, food: CATEGORY.GAMES_HOBBIES,
  gardening: CATEGORY.GAMES_HOBBIES, sports: CATEGORY.GAMES_HOBBIES, hobbies: CATEGORY.GAMES_HOBBIES,
  health: CATEGORY.MIND_BODY, psychology: CATEGORY.MIND_BODY, meditation: CATEGORY.MIND_BODY,
  fitness: CATEGORY.MIND_BODY, nutrition: CATEGORY.MIND_BODY, wellbeing: CATEGORY.MIND_BODY,
  travel: CATEGORY.PEOPLE_PLACES, geography: CATEGORY.PEOPLE_PLACES, culture: CATEGORY.PEOPLE_PLACES,
  weird: CATEGORY.WEIRD_WONDERFUL, curiosity: CATEGORY.WEIRD_WONDERFUL,
};

function inferCategory(tags) {
  if (!Array.isArray(tags)) return CATEGORY.WEIRD_WONDERFUL;
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    if (TAG_TO_CATEGORY[lower]) return TAG_TO_CATEGORY[lower];
  }
  return CATEGORY.WEIRD_WONDERFUL;
}

// ── Fetch a Pinboard JSON feed ────────────────────────────────────────────────
async function fetchFeed(url, defaultCategoryId) {
  let res;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)' },
    });
  } catch (err) {
    console.warn(`[pinboard] Fetch error for ${url}: ${err.message}`);
    return [];
  }
  if (!res.ok) {
    console.warn(`[pinboard] HTTP ${res.status} for ${url}`);
    return [];
  }

  let items;
  try {
    items = await res.json();
  } catch {
    return [];
  }
  if (!Array.isArray(items)) return [];

  return items
    .filter((item) => item.u && item.u.startsWith('http'))
    .map((item) => ({
      url:         item.u,
      title:       item.d ?? null,
      description: item.n ? item.n.trim().slice(0, 500) : null,
      og_image_url: null,
      category_id: defaultCategoryId ?? inferCategory(item.t ?? []),
      source:      'pinboard',
    }));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function fetchPinboard() {
  const allRows = [];
  const seen    = new Set();

  const addRows = (rows) => {
    for (const row of rows) {
      if (!row.url || seen.has(row.url)) continue;
      seen.add(row.url);
      allRows.push(row);
    }
  };

  // Popular feed
  console.log('\n[pinboard] Fetching popular feed...');
  addRows(await fetchFeed('https://feeds.pinboard.in/json/popular', null));
  await sleep(DELAY_MS);

  // Recent feed
  console.log('[pinboard] Fetching recent feed...');
  addRows(await fetchFeed('https://feeds.pinboard.in/json/recent', null));
  await sleep(DELAY_MS);

  // Tag feeds
  console.log(`[pinboard] Fetching ${TAG_FEEDS.length} tag feeds...`);
  const tagStartMs = Date.now();
  for (let i = 0; i < TAG_FEEDS.length; i++) {
    const { tag, categoryId } = TAG_FEEDS[i];
    const rows = await fetchFeed(`https://feeds.pinboard.in/json/t:${tag}`, categoryId);
    addRows(rows);
    process.stdout.write(`\r[pinboard]   ${i + 1}/${TAG_FEEDS.length} tags  total=${allRows.length}  eta=${fmtEta(i + 1, TAG_FEEDS.length, tagStartMs)}  `);
    await sleep(DELAY_MS);
  }

  console.log(`\n\n[pinboard] Total unique bookmarks: ${allRows.length}`);
  return allRows;
}

async function main() {
  console.log('=== Pinboard seeder ===');

  let rows;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[pinboard] Loaded ${rows.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    rows = await fetchPinboard();
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(rows));
    console.log(`[pinboard] Cached ${rows.length} rows to ${CACHE_FILE}`);
  }

  console.log(`\n[pinboard] Total: ${rows.length} — upserting (with OG fetch)...`);
  const result = await upsertUrls(rows, { checkLive: true,  fetchOg: true, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => { console.error(err); process.exit(1); });
