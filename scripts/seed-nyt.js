/**
 * seed-nyt.js — New York Times seeder
 *
 * Pulls article metadata from the NYT Top Stories API.
 * Note: NYT articles are paywalled. Users with "Skip paywalled sites" enabled
 * will not see these URLs. Subscribers and those who want to browse NYT can opt in.
 *
 * Uses the Top Stories API (v2) — one request per section, returns current
 * top ~20–40 stories per section. The Article Search API's fq section filter
 * is broken on the free tier (always returns 0 results), so Top Stories is
 * the reliable alternative.
 *
 * Requires: NYT_API_KEY in root .env
 *   Get one free at https://developer.nytimes.com/ (instant)
 *   Add to .env: NYT_API_KEY=your_key
 *
 * Rate limits: 10 req/min, 4000 req/day
 *
 * Run from repo root:
 *   node scripts/seed-nyt.js
 *   node scripts/seed-nyt.js --no-cache
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'nyt.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const DELAY_MS = 6500; // 10 req/min — add buffer

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── NYT Top Stories sections → Roam categories ────────────────────────────────
// Section slugs must match the Top Stories API path exactly (lowercase)
const SECTION_MAP = [
  { section: 'science',    categoryId: CATEGORY.SCIENCE },
  { section: 'health',     categoryId: CATEGORY.MIND_BODY },
  { section: 'technology', categoryId: CATEGORY.TECHNOLOGY },
  { section: 'arts',       categoryId: CATEGORY.ARTS_CULTURE },
  { section: 'books',      categoryId: CATEGORY.ARTS_CULTURE },
  { section: 'movies',     categoryId: CATEGORY.ARTS_CULTURE },
  { section: 'travel',     categoryId: CATEGORY.PEOPLE_PLACES },
  { section: 'world',      categoryId: CATEGORY.HISTORY_IDEAS },
  { section: 'business',   categoryId: CATEGORY.HISTORY_IDEAS },
  { section: 'opinion',    categoryId: CATEGORY.HISTORY_IDEAS },
  { section: 'us',         categoryId: CATEGORY.HISTORY_IDEAS },
  { section: 'sports',     categoryId: CATEGORY.GAMES_HOBBIES },
  { section: 'food',       categoryId: CATEGORY.GAMES_HOBBIES },
  { section: 'magazine',   categoryId: CATEGORY.WEIRD_WONDERFUL },
];

// ── Fetch one section ─────────────────────────────────────────────────────────
async function fetchSection(apiKey, section) {
  let res;
  let attempts = 0;
  while (attempts < 3) {
    try {
      res = await fetch(
        `https://api.nytimes.com/svc/topstories/v2/${section}.json?api-key=${apiKey}`,
        { headers: { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)' } },
      );
      if (res.status === 429) {
        attempts++;
        console.warn(`[nyt]   Rate limited — waiting 60s...`);
        await sleep(60000);
        continue;
      }
      if (!res.ok) {
        console.warn(`[nyt]   ${section}: HTTP ${res.status}`);
        return [];
      }
      break;
    } catch (err) {
      attempts++;
      console.warn(`[nyt]   Fetch error: ${err.message} — retry ${attempts}/3`);
      await sleep(10000 * attempts);
    }
  }

  if (!res?.ok) return [];

  const json    = await res.json();
  const results = json?.results ?? [];

  return results
    .filter((r) => r.url && !r.url.includes('://www.nytimes.com/video/'))
    .map((r) => {
      const media   = r.multimedia ?? [];
      const imgItem = media.find((m) => m.format === 'mediumThreeByTwo210' || m.format === 'Normal');
      return {
        url:         r.url,
        title:       r.title ?? null,
        description: r.abstract ? r.abstract.trim().slice(0, 500) : null,
        ogImage:     imgItem?.url ?? null,
      };
    });
}

// ── Main fetch loop ───────────────────────────────────────────────────────────
async function fetchNYT() {
  const apiKey = process.env.NYT_API_KEY;
  if (!apiKey) throw new Error('NYT_API_KEY is not set in .env');

  console.log(`\n[nyt] Fetching ${SECTION_MAP.length} sections (Top Stories API)...`);
  const allRows = [];
  const seen    = new Set();

  for (const { section, categoryId } of SECTION_MAP) {
    const articles = await fetchSection(apiKey, section);
    let added = 0;

    for (const { url, title, description, ogImage } of articles) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      allRows.push({
        url,
        title,
        description,
        og_image_url: ogImage,
        category_id:  categoryId,
        source:       'nyt',
      });
      added++;
    }

    console.log(`[nyt]   ${section}: ${added} articles`);
    await sleep(DELAY_MS);
  }

  console.log(`\n[nyt] Total unique articles collected: ${allRows.length}`);
  return allRows;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== NYT seeder ===');

  let rows;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[nyt] Loaded ${rows.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    rows = await fetchNYT();
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(rows));
    console.log(`[nyt] Cached ${rows.length} rows to ${CACHE_FILE}`);
  }

  console.log(`\n[nyt] Total: ${rows.length} — upserting...`);
  const result = await upsertUrls(rows, { fetchOg: false, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
