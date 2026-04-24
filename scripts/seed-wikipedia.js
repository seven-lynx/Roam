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
import { upsertUrls, CATEGORY } from './lib/seed.js';

const DELAY_MS       = 500;   // between Wikipedia API calls
const FEATURED_DAYS  = 365;   // how many days of featured articles to pull
const CATEGORY_LIMIT = 200;   // max articles per Wikipedia category

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

  // Entertainment
  { wiki: 'Film',                    categoryId: CATEGORY.ENTERTAINMENT },
  { wiki: 'Television',              categoryId: CATEGORY.ENTERTAINMENT },
  { wiki: 'Video_games',             categoryId: CATEGORY.ENTERTAINMENT },
  { wiki: 'Comics',                  categoryId: CATEGORY.ENTERTAINMENT },
  { wiki: 'Anime_and_manga',         categoryId: CATEGORY.ENTERTAINMENT },

  // Sports & Outdoors
  { wiki: 'Sports',                  categoryId: CATEGORY.SPORTS_OUTDOORS },
  { wiki: 'Hiking',                  categoryId: CATEGORY.SPORTS_OUTDOORS },
  { wiki: 'Cycling',                 categoryId: CATEGORY.SPORTS_OUTDOORS },
  { wiki: 'Mountaineering',          categoryId: CATEGORY.SPORTS_OUTDOORS },

  // Food & Drink
  { wiki: 'Cuisine',                 categoryId: CATEGORY.FOOD_DRINK },
  { wiki: 'Cooking',                 categoryId: CATEGORY.FOOD_DRINK },
  { wiki: 'Beverages',               categoryId: CATEGORY.FOOD_DRINK },

  // Travel
  { wiki: 'Geography',               categoryId: CATEGORY.TRAVEL },
  { wiki: 'Tourism',                 categoryId: CATEGORY.TRAVEL },
  { wiki: 'National_parks',          categoryId: CATEGORY.TRAVEL },
  { wiki: 'Islands',                 categoryId: CATEGORY.TRAVEL },

  // Health & Wellness
  { wiki: 'Medicine',                categoryId: CATEGORY.HEALTH_WELLNESS },
  { wiki: 'Nutrition',               categoryId: CATEGORY.HEALTH_WELLNESS },
  { wiki: 'Mental_health',           categoryId: CATEGORY.HEALTH_WELLNESS },
  { wiki: 'Physical_exercise',       categoryId: CATEGORY.HEALTH_WELLNESS },
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

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Wikipedia seeder ===');

  const featuredRows  = await fetchFeaturedArticles();
  const categoryRows  = await fetchCategoryArticles();

  const all = [...featuredRows, ...categoryRows];
  console.log(`\n[wikipedia] Total collected: ${all.length} — upserting...`);

  // Wikipedia already provides images — skip OG fetching
  const result = await upsertUrls(all, { fetchOg: false, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
