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
import { upsertUrls, CATEGORY } from './lib/seed.js';

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
// Each entry: { wikiCategory, categoryId, subcategoryHint }
const CATEGORY_MAP = [
  // Technology
  { wiki: 'Computing',               categoryId: CATEGORY.TECHNOLOGY },
  { wiki: 'Software',                categoryId: CATEGORY.TECHNOLOGY },
  { wiki: 'Internet_culture',        categoryId: CATEGORY.TECHNOLOGY },
  { wiki: 'Robotics',                categoryId: CATEGORY.TECHNOLOGY },
  { wiki: 'Artificial_intelligence', categoryId: CATEGORY.TECHNOLOGY },
  { wiki: 'Cryptography',            categoryId: CATEGORY.TECHNOLOGY },

  // Science
  { wiki: 'Physics',                 categoryId: CATEGORY.SCIENCE },
  { wiki: 'Chemistry',               categoryId: CATEGORY.SCIENCE },
  { wiki: 'Biology',                 categoryId: CATEGORY.SCIENCE },
  { wiki: 'Mathematics',             categoryId: CATEGORY.SCIENCE },
  { wiki: 'Astronomy',               categoryId: CATEGORY.SCIENCE },
  { wiki: 'Geology',                 categoryId: CATEGORY.SCIENCE },
  { wiki: 'Ecology',                 categoryId: CATEGORY.SCIENCE },

  // Arts & Culture
  { wiki: 'Visual_arts',             categoryId: CATEGORY.ARTS_CULTURE },
  { wiki: 'Architecture',            categoryId: CATEGORY.ARTS_CULTURE },
  { wiki: 'Literature',              categoryId: CATEGORY.ARTS_CULTURE },
  { wiki: 'Music',                   categoryId: CATEGORY.ARTS_CULTURE },
  { wiki: 'Philosophy',              categoryId: CATEGORY.ARTS_CULTURE },
  { wiki: 'History',                 categoryId: CATEGORY.ARTS_CULTURE },
  { wiki: 'Mythology',               categoryId: CATEGORY.ARTS_CULTURE },

  // Entertainment → Arts & Culture (Film/TV/Comics) and Games & Hobbies (games/anime)
  { wiki: 'Film',                    categoryId: CATEGORY.ARTS_CULTURE },
  { wiki: 'Television',              categoryId: CATEGORY.ARTS_CULTURE },
  { wiki: 'Video_games',             categoryId: CATEGORY.GAMES_HOBBIES },
  { wiki: 'Comics',                  categoryId: CATEGORY.ARTS_CULTURE },
  { wiki: 'Anime_and_manga',         categoryId: CATEGORY.GAMES_HOBBIES },

  // Sports & Outdoors → People & Places
  { wiki: 'Sports',                  categoryId: CATEGORY.PEOPLE_PLACES },
  { wiki: 'Hiking',                  categoryId: CATEGORY.PEOPLE_PLACES },
  { wiki: 'Cycling',                 categoryId: CATEGORY.PEOPLE_PLACES },
  { wiki: 'Mountaineering',          categoryId: CATEGORY.PEOPLE_PLACES },

  // Food & Drink → People & Places (cultural)
  { wiki: 'Cuisine',                 categoryId: CATEGORY.PEOPLE_PLACES },
  { wiki: 'Cooking',                 categoryId: CATEGORY.PEOPLE_PLACES },
  { wiki: 'Beverages',               categoryId: CATEGORY.PEOPLE_PLACES },

  // Travel → People & Places
  { wiki: 'Geography',               categoryId: CATEGORY.PEOPLE_PLACES },
  { wiki: 'Tourism',                 categoryId: CATEGORY.PEOPLE_PLACES },
  { wiki: 'National_parks',          categoryId: CATEGORY.PEOPLE_PLACES },
  { wiki: 'Islands',                 categoryId: CATEGORY.PEOPLE_PLACES },

  // Health & Wellness → Mind & Body
  { wiki: 'Medicine',                categoryId: CATEGORY.MIND_BODY },
  { wiki: 'Nutrition',               categoryId: CATEGORY.MIND_BODY },
  { wiki: 'Mental_health',           categoryId: CATEGORY.MIND_BODY },
  { wiki: 'Physical_exercise',       categoryId: CATEGORY.MIND_BODY },
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

function summaryToRow(summary, categoryId) {
  if (!summary || summary.type === 'disambiguation') return null;
  const url = summary.content_urls?.desktop?.page;
  if (!url) return null;
  return {
    url,
    title:        summary.title?.replace(/_/g, ' ') ?? null,
    description:  summary.extract ? summary.extract.slice(0, 500) : null,
    og_image_url: summary.thumbnail?.source ?? null,
    category_id:  categoryId,
    source:       'wikipedia',
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

  for (const { wiki, categoryId } of CATEGORY_MAP) {
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

      const row = summaryToRow(summary, categoryId);
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
