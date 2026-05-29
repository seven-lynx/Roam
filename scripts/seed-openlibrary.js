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
import { upsertUrls, CATEGORY, SUBCATEGORY } from './lib/seed.js';

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
  { subject: 'science',            categoryId: CATEGORY.SCIENCE,         subcategoryId: SUBCATEGORY.PHYSICS_CHEMISTRY },
  { subject: 'physics',            categoryId: CATEGORY.SCIENCE,         subcategoryId: SUBCATEGORY.PHYSICS_CHEMISTRY },
  { subject: 'chemistry',          categoryId: CATEGORY.SCIENCE,         subcategoryId: SUBCATEGORY.PHYSICS_CHEMISTRY },
  { subject: 'biology',            categoryId: CATEGORY.SCIENCE,         subcategoryId: SUBCATEGORY.BIOLOGY_EVOLUTION },
  { subject: 'astronomy',          categoryId: CATEGORY.SCIENCE,         subcategoryId: SUBCATEGORY.SPACE_ASTRONOMY },
  { subject: 'mathematics',        categoryId: CATEGORY.SCIENCE,         subcategoryId: SUBCATEGORY.MATHEMATICS_LOGIC },
  { subject: 'ecology',            categoryId: CATEGORY.SCIENCE,         subcategoryId: SUBCATEGORY.BIOLOGY_EVOLUTION },
  { subject: 'geology',            categoryId: CATEGORY.SCIENCE,         subcategoryId: SUBCATEGORY.GEOLOGY_EARTH_SCIENCE },
  { subject: 'evolution',          categoryId: CATEGORY.SCIENCE,         subcategoryId: SUBCATEGORY.BIOLOGY_EVOLUTION },
  { subject: 'neuroscience',       categoryId: CATEGORY.SCIENCE,         subcategoryId: SUBCATEGORY.BIOLOGY_EVOLUTION },

  // Technology
  { subject: 'technology',         categoryId: CATEGORY.TECHNOLOGY,      subcategoryId: SUBCATEGORY.EMERGING_TECHNOLOGY },
  { subject: 'computers',          categoryId: CATEGORY.TECHNOLOGY,      subcategoryId: SUBCATEGORY.PROGRAMMING_SOFTWARE },
  { subject: 'engineering',        categoryId: CATEGORY.TECHNOLOGY,      subcategoryId: SUBCATEGORY.HARDWARE_ELECTRONICS },
  { subject: 'robotics',           categoryId: CATEGORY.TECHNOLOGY,      subcategoryId: SUBCATEGORY.ROBOTICS_AUTOMATION },
  { subject: 'internet',           categoryId: CATEGORY.TECHNOLOGY,      subcategoryId: SUBCATEGORY.INTERNET_CULTURE },
  { subject: 'artificial_intelligence', categoryId: CATEGORY.TECHNOLOGY,  subcategoryId: SUBCATEGORY.AI_MACHINE_LEARNING },
  { subject: 'cryptography',       categoryId: CATEGORY.TECHNOLOGY,      subcategoryId: SUBCATEGORY.CYBERSECURITY_PRIVACY },
  { subject: 'electronics',        categoryId: CATEGORY.TECHNOLOGY,      subcategoryId: SUBCATEGORY.HARDWARE_ELECTRONICS },

  // Arts & Culture
  { subject: 'art',                categoryId: CATEGORY.ARTS_CULTURE,    subcategoryId: SUBCATEGORY.VISUAL_ART },
  { subject: 'music',              categoryId: CATEGORY.ARTS_CULTURE,    subcategoryId: SUBCATEGORY.MUSIC },
  { subject: 'architecture',       categoryId: CATEGORY.ARTS_CULTURE,    subcategoryId: SUBCATEGORY.ARCHITECTURE_URBAN },
  { subject: 'film',               categoryId: CATEGORY.ARTS_CULTURE,    subcategoryId: SUBCATEGORY.FILM_TELEVISION },
  { subject: 'photography',        categoryId: CATEGORY.ARTS_CULTURE,    subcategoryId: SUBCATEGORY.PHOTOGRAPHY },
  { subject: 'poetry',             categoryId: CATEGORY.ARTS_CULTURE,    subcategoryId: SUBCATEGORY.LITERATURE_WRITING },
  { subject: 'theater',            categoryId: CATEGORY.ARTS_CULTURE,    subcategoryId: SUBCATEGORY.THEATRE_PERFORMANCE },
  { subject: 'literature',         categoryId: CATEGORY.ARTS_CULTURE,    subcategoryId: SUBCATEGORY.LITERATURE_WRITING },
  { subject: 'comics',             categoryId: CATEGORY.ARTS_CULTURE,    subcategoryId: SUBCATEGORY.COMICS_ILLUSTRATION },
  { subject: 'dance',              categoryId: CATEGORY.ARTS_CULTURE,    subcategoryId: SUBCATEGORY.THEATRE_PERFORMANCE },
  { subject: 'science_fiction',    categoryId: CATEGORY.ARTS_CULTURE,    subcategoryId: SUBCATEGORY.SCIFI_FANTASY },
  { subject: 'fantasy',            categoryId: CATEGORY.ARTS_CULTURE,    subcategoryId: SUBCATEGORY.SCIFI_FANTASY },

  // History & Ideas
  { subject: 'history',            categoryId: CATEGORY.HISTORY_IDEAS,   subcategoryId: SUBCATEGORY.MODERN_HISTORY },
  { subject: 'philosophy',         categoryId: CATEGORY.HISTORY_IDEAS,   subcategoryId: SUBCATEGORY.PHILOSOPHY_ETHICS },
  { subject: 'economics',          categoryId: CATEGORY.HISTORY_IDEAS,   subcategoryId: SUBCATEGORY.ECONOMICS_HISTORY },
  { subject: 'political_science',  categoryId: CATEGORY.HISTORY_IDEAS,   subcategoryId: SUBCATEGORY.POLITICS_GEOPOLITICS },
  { subject: 'ancient_history',    categoryId: CATEGORY.HISTORY_IDEAS,   subcategoryId: SUBCATEGORY.ANCIENT_MEDIEVAL_HISTORY },
  { subject: 'world_war_ii',       categoryId: CATEGORY.HISTORY_IDEAS,   subcategoryId: SUBCATEGORY.MILITARY_HISTORY },
  { subject: 'biography',          categoryId: CATEGORY.HISTORY_IDEAS,   subcategoryId: SUBCATEGORY.BIOGRAPHIES_PROFILES },
  { subject: 'religion',           categoryId: CATEGORY.HISTORY_IDEAS,   subcategoryId: SUBCATEGORY.RELIGION_MYTHOLOGY },
  { subject: 'anthropology',       categoryId: CATEGORY.HISTORY_IDEAS,   subcategoryId: SUBCATEGORY.ANTHROPOLOGY_ARCHAEOLOGY },
  { subject: 'linguistics',        categoryId: CATEGORY.HISTORY_IDEAS,   subcategoryId: SUBCATEGORY.LANGUAGES_LINGUISTICS },

  // Games & Hobbies
  { subject: 'games',              categoryId: CATEGORY.GAMES_HOBBIES,   subcategoryId: SUBCATEGORY.BOARD_GAMES_TABLETOP },
  { subject: 'chess',              categoryId: CATEGORY.GAMES_HOBBIES,   subcategoryId: SUBCATEGORY.BOARD_GAMES_TABLETOP },
  { subject: 'cooking',            categoryId: CATEGORY.GAMES_HOBBIES,   subcategoryId: SUBCATEGORY.COOKING_FOOD },
  { subject: 'gardening',          categoryId: CATEGORY.GAMES_HOBBIES,   subcategoryId: SUBCATEGORY.GARDENING_HORTICULTURE },
  { subject: 'crafts',             categoryId: CATEGORY.GAMES_HOBBIES,   subcategoryId: SUBCATEGORY.CRAFTS_DIY_MAKING },
  { subject: 'sports',             categoryId: CATEGORY.GAMES_HOBBIES,   subcategoryId: SUBCATEGORY.SPORTS_ATHLETICS },
  { subject: 'fishing',            categoryId: CATEGORY.GAMES_HOBBIES,   subcategoryId: null },

  // Weird & Wonderful
  { subject: 'mythology',          categoryId: CATEGORY.WEIRD_WONDERFUL,  subcategoryId: SUBCATEGORY.URBAN_LEGENDS_FOLKLORE },
  { subject: 'folklore',           categoryId: CATEGORY.WEIRD_WONDERFUL,  subcategoryId: SUBCATEGORY.URBAN_LEGENDS_FOLKLORE },
  { subject: 'magic',              categoryId: CATEGORY.WEIRD_WONDERFUL,  subcategoryId: SUBCATEGORY.PARANORMAL_UNEXPLAINED },
  { subject: 'occult',             categoryId: CATEGORY.WEIRD_WONDERFUL,  subcategoryId: SUBCATEGORY.PARANORMAL_UNEXPLAINED },
  { subject: 'cryptozoology',      categoryId: CATEGORY.WEIRD_WONDERFUL,  subcategoryId: SUBCATEGORY.PARANORMAL_UNEXPLAINED },
  { subject: 'ufos',               categoryId: CATEGORY.WEIRD_WONDERFUL,  subcategoryId: SUBCATEGORY.PARANORMAL_UNEXPLAINED },
  { subject: 'curiosities_and_wonders', categoryId: CATEGORY.WEIRD_WONDERFUL, subcategoryId: SUBCATEGORY.ODDITIES_CURIOSITIES },

  // People & Places
  { subject: 'travel',             categoryId: CATEGORY.PEOPLE_PLACES,   subcategoryId: SUBCATEGORY.TRAVEL_EXPLORATION },
  { subject: 'geography',          categoryId: CATEGORY.PEOPLE_PLACES,   subcategoryId: SUBCATEGORY.MAPS_CARTOGRAPHY },
  { subject: 'africa',             categoryId: CATEGORY.PEOPLE_PLACES,   subcategoryId: null },
  { subject: 'asia',               categoryId: CATEGORY.PEOPLE_PLACES,   subcategoryId: null },
  { subject: 'europe',             categoryId: CATEGORY.PEOPLE_PLACES,   subcategoryId: null },
  { subject: 'latin_america',      categoryId: CATEGORY.PEOPLE_PLACES,   subcategoryId: null },
  { subject: 'indigenous_peoples', categoryId: CATEGORY.PEOPLE_PLACES,   subcategoryId: SUBCATEGORY.INDIGENOUS_CULTURES },
  { subject: 'explorers',          categoryId: CATEGORY.PEOPLE_PLACES,   subcategoryId: SUBCATEGORY.TRAVEL_EXPLORATION },

  // Mind & Body
  { subject: 'psychology',         categoryId: CATEGORY.MIND_BODY,       subcategoryId: SUBCATEGORY.PSYCHOLOGY_BEHAVIOUR },
  { subject: 'meditation',         categoryId: CATEGORY.MIND_BODY,       subcategoryId: SUBCATEGORY.MINDFULNESS_MEDITATION },
  { subject: 'yoga',               categoryId: CATEGORY.MIND_BODY,       subcategoryId: SUBCATEGORY.FITNESS_MOVEMENT },
  { subject: 'nutrition',          categoryId: CATEGORY.MIND_BODY,       subcategoryId: SUBCATEGORY.NUTRITION_HEALTH },
  { subject: 'mental_health',      categoryId: CATEGORY.MIND_BODY,       subcategoryId: SUBCATEGORY.MENTAL_HEALTH },
  { subject: 'self-help',          categoryId: CATEGORY.MIND_BODY,       subcategoryId: SUBCATEGORY.PERSONAL_DEVELOPMENT },
  { subject: 'medicine',           categoryId: CATEGORY.MIND_BODY,       subcategoryId: SUBCATEGORY.NUTRITION_HEALTH },
  { subject: 'sleep',              categoryId: CATEGORY.MIND_BODY,       subcategoryId: SUBCATEGORY.SLEEP_RECOVERY },
];

// ── Fetch one subject page ─────────────────────────────────────────────────────
async function fetchSubject(subject, categoryId, subcategoryId) {
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
      category_id:  categoryId,
      subcategory_id: subcategoryId ?? null,
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

  for (const { subject, categoryId, subcategoryId } of SUBJECT_MAP) {
    const rows = await fetchSubject(subject, categoryId, subcategoryId);

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
