/**
 * seed-guardian.js — The Guardian seeder
 *
 * Pulls articles from The Guardian's open platform API.
 * No paywall — every article is freely readable.
 *
 * Requires: GUARDIAN_API_KEY in root .env
 *   Get one free (instant) at https://open-platform.theguardian.com/access/
 *   Add to .env: GUARDIAN_API_KEY=your_key
 *
 * Rate limits: 12 req/s, 5000 req/day (free tier)
 *
 * Run from repo root:
 *   node scripts/seed-guardian.js
 *   node scripts/seed-guardian.js --no-cache
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'guardian.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const PAGE_SIZE         = 200; // Guardian max
const PAGES_PER_SECTION = 5;   // 200 × 5 = 1,000 articles/section
const DELAY_MS          = 300; // 12 req/s limit — be polite

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Guardian sections → Roam categories ──────────────────────────────────────
const SECTION_MAP = [
  { section: 'science',          categoryId: CATEGORY.SCIENCE },
  { section: 'environment',      categoryId: CATEGORY.SCIENCE },
  { section: 'technology',       categoryId: CATEGORY.TECHNOLOGY },
  { section: 'culture',          categoryId: CATEGORY.ARTS_CULTURE },
  { section: 'books',            categoryId: CATEGORY.ARTS_CULTURE },
  { section: 'film',             categoryId: CATEGORY.ARTS_CULTURE },
  { section: 'music',            categoryId: CATEGORY.ARTS_CULTURE },
  { section: 'world',            categoryId: CATEGORY.HISTORY_IDEAS },
  { section: 'politics',         categoryId: CATEGORY.HISTORY_IDEAS },
  { section: 'business',         categoryId: CATEGORY.HISTORY_IDEAS },
  { section: 'lifeandstyle',     categoryId: CATEGORY.MIND_BODY },
  { section: 'society',          categoryId: CATEGORY.MIND_BODY },
  { section: 'travel',           categoryId: CATEGORY.PEOPLE_PLACES },
  { section: 'cities',           categoryId: CATEGORY.PEOPLE_PLACES },
  { section: 'sport',            categoryId: CATEGORY.GAMES_HOBBIES },
  { section: 'food',             categoryId: CATEGORY.GAMES_HOBBIES },
  { section: 'games',            categoryId: CATEGORY.GAMES_HOBBIES },
  { section: 'artanddesign',     categoryId: CATEGORY.ARTS_CULTURE },
];

// ── Fetch one page ────────────────────────────────────────────────────────────
async function fetchPage(apiKey, section, page) {
  const params = new URLSearchParams({
    'api-key':     apiKey,
    section,
    'page-size':   String(PAGE_SIZE),
    page:          String(page),
    'show-fields': 'thumbnail,trailText,headline',
    'order-by':    'relevance',
  });

  let res;
  let attempts = 0;
  while (attempts < 3) {
    try {
      res = await fetch(`https://content.guardianapis.com/search?${params}`, {
        headers: { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)' },
      });
      if (res.status === 429) {
        attempts++;
        console.warn(`[guardian]   Rate limited — waiting 30s...`);
        await sleep(30000);
        continue;
      }
      if (!res.ok) {
        console.warn(`[guardian]   ${section} p${page}: HTTP ${res.status}`);
        return [];
      }
      break;
    } catch (err) {
      attempts++;
      console.warn(`[guardian]   Fetch error: ${err.message} — retry ${attempts}/3`);
      await sleep(5000 * attempts);
    }
  }

  if (!res?.ok) return [];

  const json    = await res.json();
  const results = json?.response?.results ?? [];

  return results
    .filter((r) => r.webUrl)
    .map((r) => ({
      url:         r.webUrl,
      title:       r.fields?.headline ?? r.webTitle ?? null,
      description: r.fields?.trailText
        ? r.fields.trailText.replace(/<[^>]+>/g, '').trim().slice(0, 500)
        : null,
      ogImage: r.fields?.thumbnail ?? null,
    }));
}

// ── Main fetch loop ───────────────────────────────────────────────────────────
async function fetchGuardian() {
  const apiKey = process.env.GUARDIAN_API_KEY;
  if (!apiKey) throw new Error('GUARDIAN_API_KEY is not set in .env — get a free key at https://open-platform.theguardian.com/access/');

  console.log(`\n[guardian] Fetching ${SECTION_MAP.length} sections × up to ${PAGES_PER_SECTION} pages...`);
  const allRows = [];
  const seen    = new Set();

  for (const { section, categoryId } of SECTION_MAP) {
    let added      = 0;
    let totalPages = PAGES_PER_SECTION;

    for (let page = 1; page <= totalPages; page++) {
      const articles = await fetchPage(apiKey, section, page);

      for (const { url, title, description, ogImage } of articles) {
        if (!url || seen.has(url)) continue;
        seen.add(url);
        allRows.push({
          url,
          title,
          description,
          og_image_url: ogImage,
          category_id:  categoryId,
          source:       'guardian',
        });
        added++;
      }

      if (articles.length === 0) break;
      await sleep(DELAY_MS);
    }

    console.log(`[guardian]   ${section}: ${added} articles`);
  }

  console.log(`\n[guardian] Total unique articles collected: ${allRows.length}`);
  return allRows;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Guardian seeder ===');

  let rows;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[guardian] Loaded ${rows.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    rows = await fetchGuardian();
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(rows));
    console.log(`[guardian] Cached ${rows.length} rows to ${CACHE_FILE}`);
  }

  console.log(`\n[guardian] Total: ${rows.length} — upserting...`);
  const result = await upsertUrls(rows, { fetchOg: false, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
