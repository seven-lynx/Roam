/**
 * seed-wikipedia.js — Wikipedia seeder
 *
 * Pulls two sources:
 *   1. Wikipedia's "Today's Featured Article" for the past FEATURED_DAYS days
 *   2. Articles from curated Wikipedia categories, mapped to Roam's 8 pillars
 *
 * Run from repo root:
 *   node scripts/seed-wikipedia.js
 *
 * No API key required. Respects Wikipedia's rate limits (500ms between requests).
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY, SUBCATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'wikipedia.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const DELAY_MS       = 500;   // between Wikipedia API calls
const FEATURED_DAYS  = 365;   // how many days of featured articles to pull
const CATEGORY_LIMIT = 200;   // max articles per Wikipedia category
const CURATED_LIMIT  = 500;   // max articles per Featured/Good list

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Wikipedia category → Roam category mapping ───────────────────────────────
// Each entry: { wiki, categoryId, subcategoryId }
const CATEGORY_MAP = [
  // Technology
  { wiki: 'Computing',               categoryId: CATEGORY.TECHNOLOGY,    subcategoryId: SUBCATEGORY.PROGRAMMING_SOFTWARE },
  { wiki: 'Software',                categoryId: CATEGORY.TECHNOLOGY,    subcategoryId: SUBCATEGORY.PROGRAMMING_SOFTWARE },
  { wiki: 'Internet_culture',        categoryId: CATEGORY.TECHNOLOGY,    subcategoryId: SUBCATEGORY.INTERNET_CULTURE },
  { wiki: 'Robotics',                categoryId: CATEGORY.TECHNOLOGY,    subcategoryId: SUBCATEGORY.ROBOTICS_AUTOMATION },
  { wiki: 'Artificial_intelligence', categoryId: CATEGORY.TECHNOLOGY,    subcategoryId: SUBCATEGORY.AI_MACHINE_LEARNING },
  { wiki: 'Cryptography',            categoryId: CATEGORY.TECHNOLOGY,    subcategoryId: SUBCATEGORY.CYBERSECURITY_PRIVACY },

  // Science
  { wiki: 'Physics',                 categoryId: CATEGORY.SCIENCE,       subcategoryId: SUBCATEGORY.PHYSICS_CHEMISTRY },
  { wiki: 'Chemistry',               categoryId: CATEGORY.SCIENCE,       subcategoryId: SUBCATEGORY.PHYSICS_CHEMISTRY },
  { wiki: 'Biology',                 categoryId: CATEGORY.SCIENCE,       subcategoryId: SUBCATEGORY.BIOLOGY_EVOLUTION },
  { wiki: 'Mathematics',             categoryId: CATEGORY.SCIENCE,       subcategoryId: SUBCATEGORY.MATHEMATICS_LOGIC },
  { wiki: 'Astronomy',               categoryId: CATEGORY.SCIENCE,       subcategoryId: SUBCATEGORY.SPACE_ASTRONOMY },
  { wiki: 'Geology',                 categoryId: CATEGORY.SCIENCE,       subcategoryId: SUBCATEGORY.GEOLOGY_EARTH_SCIENCE },
  { wiki: 'Ecology',                 categoryId: CATEGORY.SCIENCE,       subcategoryId: SUBCATEGORY.ENVIRONMENT_CLIMATE },

  // Arts & Culture
  { wiki: 'Visual_arts',             categoryId: CATEGORY.ARTS_CULTURE,  subcategoryId: SUBCATEGORY.VISUAL_ART },
  { wiki: 'Architecture',            categoryId: CATEGORY.ARTS_CULTURE,  subcategoryId: SUBCATEGORY.ARCHITECTURE_URBAN },
  { wiki: 'Literature',              categoryId: CATEGORY.ARTS_CULTURE,  subcategoryId: SUBCATEGORY.LITERATURE_WRITING },
  { wiki: 'Music',                   categoryId: CATEGORY.ARTS_CULTURE,  subcategoryId: SUBCATEGORY.MUSIC },
  { wiki: 'Philosophy',              categoryId: CATEGORY.HISTORY_IDEAS, subcategoryId: SUBCATEGORY.PHILOSOPHY_ETHICS },
  { wiki: 'History',                 categoryId: CATEGORY.HISTORY_IDEAS, subcategoryId: SUBCATEGORY.MODERN_HISTORY },
  { wiki: 'Mythology',               categoryId: CATEGORY.HISTORY_IDEAS, subcategoryId: SUBCATEGORY.RELIGION_MYTHOLOGY },

  // Entertainment → Arts & Culture (Film/TV/Comics) and Games & Hobbies (games/anime)
  { wiki: 'Film',                    categoryId: CATEGORY.ARTS_CULTURE,  subcategoryId: SUBCATEGORY.FILM_TELEVISION },
  { wiki: 'Television',              categoryId: CATEGORY.ARTS_CULTURE,  subcategoryId: SUBCATEGORY.FILM_TELEVISION },
  { wiki: 'Video_games',             categoryId: CATEGORY.GAMES_HOBBIES, subcategoryId: SUBCATEGORY.VIDEO_GAMES },
  { wiki: 'Comics',                  categoryId: CATEGORY.ARTS_CULTURE,  subcategoryId: SUBCATEGORY.COMICS_ILLUSTRATION },
  { wiki: 'Anime_and_manga',         categoryId: CATEGORY.GAMES_HOBBIES, subcategoryId: SUBCATEGORY.COLLECTING },

  // Sports & Outdoors → People & Places / Games & Hobbies
  { wiki: 'Sports',                  categoryId: CATEGORY.GAMES_HOBBIES, subcategoryId: SUBCATEGORY.SPORTS_ATHLETICS },
  { wiki: 'Hiking',                  categoryId: CATEGORY.GAMES_HOBBIES, subcategoryId: SUBCATEGORY.OUTDOOR_ADVENTURE },
  { wiki: 'Cycling',                 categoryId: CATEGORY.GAMES_HOBBIES, subcategoryId: SUBCATEGORY.OUTDOOR_ADVENTURE },
  { wiki: 'Mountaineering',          categoryId: CATEGORY.GAMES_HOBBIES, subcategoryId: SUBCATEGORY.OUTDOOR_ADVENTURE },

  // Food & Drink → Games & Hobbies
  { wiki: 'Cuisine',                 categoryId: CATEGORY.GAMES_HOBBIES, subcategoryId: SUBCATEGORY.COOKING_FOOD },
  { wiki: 'Cooking',                 categoryId: CATEGORY.GAMES_HOBBIES, subcategoryId: SUBCATEGORY.COOKING_FOOD },
  { wiki: 'Beverages',               categoryId: CATEGORY.GAMES_HOBBIES, subcategoryId: SUBCATEGORY.COOKING_FOOD },

  // Travel → People & Places
  { wiki: 'Geography',               categoryId: CATEGORY.PEOPLE_PLACES, subcategoryId: SUBCATEGORY.MAPS_CARTOGRAPHY },
  { wiki: 'Tourism',                 categoryId: CATEGORY.PEOPLE_PLACES, subcategoryId: SUBCATEGORY.TRAVEL_EXPLORATION },
  { wiki: 'National_parks',          categoryId: CATEGORY.PEOPLE_PLACES, subcategoryId: SUBCATEGORY.TRAVEL_EXPLORATION },
  { wiki: 'Islands',                 categoryId: CATEGORY.PEOPLE_PLACES, subcategoryId: SUBCATEGORY.TRAVEL_EXPLORATION },

  // Health & Wellness → Mind & Body
  { wiki: 'Medicine',                categoryId: CATEGORY.MIND_BODY,     subcategoryId: SUBCATEGORY.NUTRITION_HEALTH },
  { wiki: 'Nutrition',               categoryId: CATEGORY.MIND_BODY,     subcategoryId: SUBCATEGORY.NUTRITION_HEALTH },
  { wiki: 'Mental_health',           categoryId: CATEGORY.MIND_BODY,     subcategoryId: SUBCATEGORY.MENTAL_HEALTH },
  { wiki: 'Physical_exercise',       categoryId: CATEGORY.MIND_BODY,     subcategoryId: SUBCATEGORY.FITNESS_MOVEMENT },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function wikiGet(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app; seeder bot)',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function summaryToRow(summary, categoryId, subcategoryId = null) {
  if (!summary || summary.type === 'disambiguation') return null;
  const url = summary.content_urls?.desktop?.page;
  if (!url) return null;
  return {
    url,
    title:          summary.title?.replace(/_/g, ' ') ?? null,
    description:    summary.extract ? summary.extract.slice(0, 500) : null,
    og_image_url:   summary.thumbnail?.source ?? null,
    category_id:    categoryId,
    subcategory_id: subcategoryId,
    source:         'wikipedia',
  };
}

// ── Part 1: Featured articles ────────────────────────────────────────────────

async function fetchFeaturedArticles() {
  console.log(`\n[wikipedia] Fetching featured articles for past ${FEATURED_DAYS} days...`);
  const rows = [];
  const today = new Date();

  for (let i = 0; i < FEATURED_DAYS; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');

    const data = await wikiGet(
      `https://en.wikipedia.org/api/rest_v1/feed/featured/${yyyy}/${mm}/${dd}`
    );
    await sleep(DELAY_MS);

    const tfa = data?.tfa;
    if (!tfa) continue;

    // The feed endpoint returns a slightly different shape — normalise it
    const url = tfa.content_urls?.desktop?.page;
    if (!url) continue;

    rows.push({
      url,
      title:        tfa.normalizedtitle ?? tfa.title?.replace(/_/g, ' ') ?? null,
      description:  tfa.extract ? tfa.extract.slice(0, 500) : null,
      og_image_url: tfa.thumbnail?.source ?? tfa.originalimage?.source ?? null,
      // Featured articles span all topics — use Science as a sensible default
      // and let the category seeder fill in the topic-specific ones
      category_id:  CATEGORY.SCIENCE,
      source:       'wikipedia',
    });

    if ((i + 1) % 30 === 0) {
      console.log(`[wikipedia]   ${i + 1}/${FEATURED_DAYS} days processed`);
    }
  }

  console.log(`[wikipedia] Featured articles collected: ${rows.length}`);
  return rows;
}

// ── Part 2: Category articles ─────────────────────────────────────────────────

async function fetchCategoryArticles() {
  console.log('\n[wikipedia] Fetching category articles...');
  const rows = [];

  for (const { wiki, categoryId, subcategoryId } of CATEGORY_MAP) {
    console.log(`[wikipedia]   Category:${wiki}`);

    // MediaWiki API — list members of the category (articles only, not subcategories)
    const data = await wikiGet(
      `https://en.wikipedia.org/w/api.php?action=query&list=categorymembers` +
      `&cmtitle=Category:${encodeURIComponent(wiki)}` +
      `&cmtype=page&cmlimit=${CATEGORY_LIMIT}&format=json`
    );
    await sleep(DELAY_MS);

    const members = data?.query?.categorymembers ?? [];
    if (members.length === 0) continue;

    // Fetch summary for each member
    for (const member of members) {
      const encodedTitle = encodeURIComponent(member.title.replace(/ /g, '_'));
      const summary = await wikiGet(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`
      );
      await sleep(DELAY_MS);

      const row = summaryToRow(summary, categoryId, subcategoryId ?? null);
      if (row) rows.push(row);
    }

    console.log(`[wikipedia]     -> ${members.length} articles fetched`);
  }

  console.log(`[wikipedia] Category articles collected: ${rows.length}`);
  return rows;
}

// ── Part 3: Curated quality lists ────────────────────────────────────────────
// Wikipedia's Featured Articles and Good Articles are manually vetted to a
// high editorial standard — the best encyclopaedic content on the site.

async function fetchCuratedLists() {
  console.log('\n[wikipedia] Fetching Featured Articles and Good Articles lists...');
  const rows = [];

  const LISTS = [
    { category: 'Featured_articles', label: 'featured' },
    { category: 'Good_articles',     label: 'good' },
  ];

  for (const { category, label } of LISTS) {
    console.log(`[wikipedia]   ${label} articles (Category:${category})...`);
    let continueParam = '';
    let collected = 0;

    while (collected < CURATED_LIMIT) {
      const url =
        `https://en.wikipedia.org/w/api.php?action=query&list=categorymembers` +
        `&cmtitle=Category:${category}&cmtype=page` +
        `&cmlimit=500&format=json` +
        (continueParam ? `&cmcontinue=${continueParam}` : '');

      const data = await wikiGet(url);
      await sleep(DELAY_MS);

      const members = data?.query?.categorymembers ?? [];
      if (members.length === 0) break;

      for (const member of members) {
        if (collected >= CURATED_LIMIT) break;
        const encodedTitle = encodeURIComponent(member.title.replace(/ /g, '_'));
        const summary = await wikiGet(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`
        );
        await sleep(DELAY_MS);

        const row = summaryToRow(summary, CATEGORY.WEIRD_WONDERFUL); // broad default; OG fetch will add context
        if (row) {
          row.source = 'wikipedia';
          rows.push(row);
          collected++;
        }
      }

      process.stdout.write(`\r[wikipedia]     ${label}: ${collected} articles  `);

      const cont = data?.continue?.cmcontinue;
      if (!cont || collected >= CURATED_LIMIT) break;
      continueParam = encodeURIComponent(cont);
    }

    console.log(`\n[wikipedia]     ${label}: ${collected} articles collected`);
  }

  console.log(`[wikipedia] Curated lists collected: ${rows.length}`);
  return rows;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Wikipedia seeder ===');

  let all;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    all = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[wikipedia] Loaded ${all.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    const featuredRows  = await fetchFeaturedArticles();
    const categoryRows  = await fetchCategoryArticles();
    const curatedRows   = await fetchCuratedLists();
    all = [...featuredRows, ...categoryRows, ...curatedRows];

    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(all));
    console.log(`[wikipedia] Cached ${all.length} rows to ${CACHE_FILE}`);
  }

  console.log(`\n[wikipedia] Total: ${all.length} — upserting...`);

  // Wikipedia already provides images — skip OG fetching
  const result = await upsertUrls(all, { fetchOg: false, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
