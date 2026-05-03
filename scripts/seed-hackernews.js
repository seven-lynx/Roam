/**
 * seed-hackernews.js — Hacker News seeder
 *
 * Pulls top HN stories (points > 100) via the Algolia HN Search API.
 * No API key required. No rate limiting needed (Algolia is fast).
 *
 * Run from repo root:
 *   node scripts/seed-hackernews.js
 *   node scripts/seed-hackernews.js --no-cache   # re-fetch from API
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'hackernews.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const PAGES          = 5;    // 5 × 1000 hits = up to 5,000 stories
const HITS_PER_PAGE  = 1000;
const MIN_POINTS     = 200; // raised from 100 — filters low-engagement / bot-inflated stories
const MIN_COMMENTS   = 10;  // require real discussion

const HN_INTERNAL = /^https?:\/\/(www\.)?news\.ycombinator\.com/i;

// ── Fetch from Algolia HN API ─────────────────────────────────────────────────

async function fetchHNStories() {
  console.log(`\n[hackernews] Fetching top stories (points > ${MIN_POINTS}, ${PAGES} pages)...`);
  const rows = [];
  const seen = new Set();

  for (let page = 0; page < PAGES; page++) {
    const url =
      `https://hn.algolia.com/api/v1/search` +
      `?tags=story` +
      `&hitsPerPage=${HITS_PER_PAGE}` +
      `&numericFilters=points%3E${MIN_POINTS},num_comments%3E${MIN_COMMENTS}` +
      `&page=${page}`;

    let data;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app; seeder bot)' },
      });
      if (!res.ok) { console.warn(`[hackernews]   page ${page}: HTTP ${res.status}`); continue; }
      data = await res.json();
    } catch (err) {
      console.warn(`[hackernews]   page ${page}: fetch error — ${err.message}`);
      continue;
    }

    const hits = data?.hits ?? [];
    console.log(`[hackernews]   page ${page}: ${hits.length} hits`);

    for (const hit of hits) {
      // Skip Ask HN / Show HN with no external URL, and HN-internal links
      const rawUrl = hit.url;
      if (!rawUrl || HN_INTERNAL.test(rawUrl) || seen.has(rawUrl)) continue;
      seen.add(rawUrl);

      rows.push({
        url:          rawUrl,
        title:        hit.title ?? null,
        description:  null,   // HN API has no description; OG fetch would be slow
        og_image_url: null,
        category_id:  CATEGORY.TECHNOLOGY,
        source:       'hackernews',
        seeder_score: Math.min((hit.points ?? 0) / 1500, 1.0),  // 1500 = strong HN post; was 3000
        published_at: hit.created_at ?? null,  // ISO 8601 from Algolia
      });
    }

    // No sleep needed — Algolia has no strict rate limit for read-only queries
  }

  console.log(`[hackernews] Stories collected: ${rows.length}`);
  return rows;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Hacker News seeder ===');

  let rows;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[hackernews] Loaded ${rows.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    rows = await fetchHNStories();
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(rows));
    console.log(`[hackernews] Cached ${rows.length} rows to ${CACHE_FILE}`);
  }

  console.log(`\n[hackernews] Total: ${rows.length} — upserting (with OG fetch, this may take a while)...`);
  const result = await upsertUrls(rows, { fetchOg: true, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
