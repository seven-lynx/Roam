/**
 * seed-openlibrary.js — Open Library seeder
 *
 * Pulls book records from Open Library's subjects API (no API key required).
 * Each book links to its Open Library page with cover image and description.
 *
 * API docs: https://openlibrary.org/dev/docs/api#anchor_subjects
 *
 * Run from repo root:
 *   node scripts/seed-openlibrary.js
 *   node scripts/seed-openlibrary.js --no-cache   # re-fetch from API
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'openlibrary.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const LIMIT    = 1000; // max per subject page
const DELAY_MS = 1500; // polite crawl — OL asks for "reasonable" rate

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Subject → Roam category mapping ──────────────────────────────────────────
// Open Library subjects use underscores for spaces (e.g. "science_fiction")
const SUBJECT_MAP = [
  // Science
  { subject: 'science',            categoryId: CATEGORY.SCIENCE },
  { subject: 'physics',            categoryId: CATEGORY.SCIENCE },
  { subject: 'chemistry',          categoryId: CATEGORY.SCIENCE },
  { subject: 'biology',            categoryId: CATEGORY.SCIENCE },
  { subject: 'astronomy',          categoryId: CATEGORY.SCIENCE },
  { subject: 'mathematics',        categoryId: CATEGORY.SCIENCE },
  { subject: 'ecology',            categoryId: CATEGORY.SCIENCE },
  { subject: 'geology',            categoryId: CATEGORY.SCIENCE },
  { subject: 'evolution',          categoryId: CATEGORY.SCIENCE },
  { subject: 'neuroscience',       categoryId: CATEGORY.SCIENCE },

  // Technology
  { subject: 'technology',         categoryId: CATEGORY.TECHNOLOGY },
  { subject: 'computers',          categoryId: CATEGORY.TECHNOLOGY },
  { subject: 'engineering',        categoryId: CATEGORY.TECHNOLOGY },
  { subject: 'robotics',           categoryId: CATEGORY.TECHNOLOGY },
  { subject: 'internet',           categoryId: CATEGORY.TECHNOLOGY },
  { subject: 'artificial_intelligence', categoryId: CATEGORY.TECHNOLOGY },
  { subject: 'cryptography',       categoryId: CATEGORY.TECHNOLOGY },
  { subject: 'electronics',        categoryId: CATEGORY.TECHNOLOGY },

  // Arts & Culture
  { subject: 'art',                categoryId: CATEGORY.ARTS_CULTURE },
  { subject: 'music',              categoryId: CATEGORY.ARTS_CULTURE },
  { subject: 'architecture',       categoryId: CATEGORY.ARTS_CULTURE },
  { subject: 'film',               categoryId: CATEGORY.ARTS_CULTURE },
  { subject: 'photography',        categoryId: CATEGORY.ARTS_CULTURE },
  { subject: 'poetry',             categoryId: CATEGORY.ARTS_CULTURE },
  { subject: 'theater',            categoryId: CATEGORY.ARTS_CULTURE },
  { subject: 'literature',         categoryId: CATEGORY.ARTS_CULTURE },
  { subject: 'comics',             categoryId: CATEGORY.ARTS_CULTURE },
  { subject: 'dance',              categoryId: CATEGORY.ARTS_CULTURE },

  // History & Ideas
  { subject: 'history',            categoryId: CATEGORY.HISTORY_IDEAS },
  { subject: 'philosophy',         categoryId: CATEGORY.HISTORY_IDEAS },
  { subject: 'economics',          categoryId: CATEGORY.HISTORY_IDEAS },
  { subject: 'political_science',  categoryId: CATEGORY.HISTORY_IDEAS },
  { subject: 'ancient_history',    categoryId: CATEGORY.HISTORY_IDEAS },
  { subject: 'world_war_ii',       categoryId: CATEGORY.HISTORY_IDEAS },
  { subject: 'biography',          categoryId: CATEGORY.HISTORY_IDEAS },
  { subject: 'religion',           categoryId: CATEGORY.HISTORY_IDEAS },
  { subject: 'anthropology',       categoryId: CATEGORY.HISTORY_IDEAS },
  { subject: 'linguistics',        categoryId: CATEGORY.HISTORY_IDEAS },

  // Games & Hobbies
  { subject: 'games',              categoryId: CATEGORY.GAMES_HOBBIES },
  { subject: 'chess',              categoryId: CATEGORY.GAMES_HOBBIES },
  { subject: 'cooking',            categoryId: CATEGORY.GAMES_HOBBIES },
  { subject: 'gardening',          categoryId: CATEGORY.GAMES_HOBBIES },
  { subject: 'crafts',             categoryId: CATEGORY.GAMES_HOBBIES },
  { subject: 'sports',             categoryId: CATEGORY.GAMES_HOBBIES },
  { subject: 'fishing',            categoryId: CATEGORY.GAMES_HOBBIES },
  { subject: 'science_fiction',    categoryId: CATEGORY.GAMES_HOBBIES },
  { subject: 'fantasy',            categoryId: CATEGORY.GAMES_HOBBIES },

  // Weird & Wonderful
  { subject: 'mythology',          categoryId: CATEGORY.WEIRD_WONDERFUL },
  { subject: 'folklore',           categoryId: CATEGORY.WEIRD_WONDERFUL },
  { subject: 'magic',              categoryId: CATEGORY.WEIRD_WONDERFUL },
  { subject: 'occult',             categoryId: CATEGORY.WEIRD_WONDERFUL },
  { subject: 'cryptozoology',      categoryId: CATEGORY.WEIRD_WONDERFUL },
  { subject: 'ufos',               categoryId: CATEGORY.WEIRD_WONDERFUL },
  { subject: 'curiosities_and_wonders', categoryId: CATEGORY.WEIRD_WONDERFUL },

  // People & Places
  { subject: 'travel',             categoryId: CATEGORY.PEOPLE_PLACES },
  { subject: 'geography',          categoryId: CATEGORY.PEOPLE_PLACES },
  { subject: 'africa',             categoryId: CATEGORY.PEOPLE_PLACES },
  { subject: 'asia',               categoryId: CATEGORY.PEOPLE_PLACES },
  { subject: 'europe',             categoryId: CATEGORY.PEOPLE_PLACES },
  { subject: 'latin_america',      categoryId: CATEGORY.PEOPLE_PLACES },
  { subject: 'indigenous_peoples', categoryId: CATEGORY.PEOPLE_PLACES },
  { subject: 'explorers',          categoryId: CATEGORY.PEOPLE_PLACES },

  // Mind & Body
  { subject: 'psychology',         categoryId: CATEGORY.MIND_BODY },
  { subject: 'meditation',         categoryId: CATEGORY.MIND_BODY },
  { subject: 'yoga',               categoryId: CATEGORY.MIND_BODY },
  { subject: 'nutrition',          categoryId: CATEGORY.MIND_BODY },
  { subject: 'mental_health',      categoryId: CATEGORY.MIND_BODY },
  { subject: 'self-help',          categoryId: CATEGORY.MIND_BODY },
  { subject: 'medicine',           categoryId: CATEGORY.MIND_BODY },
  { subject: 'sleep',              categoryId: CATEGORY.MIND_BODY },
];

// ── Fetch one subject page ─────────────────────────────────────────────────────
async function fetchSubject(subject, categoryId) {
  const url = `https://openlibrary.org/subjects/${subject}.json?limit=${LIMIT}&details=false`;

  let res;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app; contact: j.s.coleman00@gmail.com)' },
    });
  } catch (err) {
    console.warn(`[openlibrary]   ${subject}: fetch error — ${err.message}`);
    return [];
  }

  if (!res.ok) {
    console.warn(`[openlibrary]   ${subject}: HTTP ${res.status}`);
    return [];
  }

  let json;
  try {
    json = await res.json();
  } catch (err) {
    console.warn(`[openlibrary]   ${subject}: JSON parse error — ${err.message}`);
    return [];
  }

  const works = json.works ?? [];
  const rows = [];

  for (const work of works) {
    if (!work.key) continue;

    // Book page URL e.g. https://openlibrary.org/works/OL82563W
    const bookUrl = `https://openlibrary.org${work.key}`;

    // Cover image — use Medium size for reasonable file size
    const coverId = work.cover_id ?? work.cover_edition_key ?? null;
    const ogImage = coverId
      ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
      : null;

    // Description — OL subjects API doesn't return it; we have title only
    const title = work.title ? work.title.trim() : null;
    if (!title) continue;

    // Build a short description from authors if available
    const authors = (work.authors ?? []).map((a) => a.name).filter(Boolean);
    const description = authors.length
      ? `By ${authors.slice(0, 3).join(', ')}`
      : null;

    rows.push({
      url:         bookUrl,
      title,
      description,
      og_image_url: ogImage,
      category_id: categoryId,
      source:      'openlibrary',
      language:    'en',
    });
  }

  console.log(`[openlibrary]   ${subject}: ${rows.length} works`);
  return rows;
}

// ── Main fetch loop ───────────────────────────────────────────────────────────
async function fetchOpenLibrary() {
  console.log(`\n[openlibrary] Fetching ${SUBJECT_MAP.length} subjects...`);
  const allRows = [];
  const seen = new Set();

  for (const { subject, categoryId } of SUBJECT_MAP) {
    const rows = await fetchSubject(subject, categoryId);

    for (const row of rows) {
      if (!seen.has(row.url)) {
        seen.add(row.url);
        allRows.push(row);
      }
    }

    await sleep(DELAY_MS);
  }

  console.log(`[openlibrary] Total unique works collected: ${allRows.length}`);
  return allRows;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Open Library seeder ===');

  let rows;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[openlibrary] Loaded ${rows.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    rows = await fetchOpenLibrary();
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(rows));
    console.log(`[openlibrary] Cached ${rows.length} rows to ${CACHE_FILE}`);
  }

  console.log(`\n[openlibrary] Total: ${rows.length} — upserting...`);
  // No OG fetch — cover images come directly from the API
  const result = await upsertUrls(rows, { fetchOg: false, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
