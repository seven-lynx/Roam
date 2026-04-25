/**
 * seed-lobsters.js — Lobsters seeder
 *
 * Pulls top-rated posts from lobste.rs via their public JSON API.
 * No API key required. Human-applied tags map directly to Technology subcategories.
 *
 * Run from repo root:
 *   node scripts/seed-lobsters.js
 *   node scripts/seed-lobsters.js --no-cache   # re-fetch from API
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'lobsters.json');
const NO_CACHE   = process.argv.includes('--no-cache');

// Lobsters newest stories, paginated (25 per page)
// /hottest only has ~1-2 pages of content; /newest has a full archive
const PAGES    = 40;  // 40 × 25 = up to 1,000 stories
const DELAY_MS = 1000; // be polite — lobste.rs is a small community server

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Lobsters tag → Roam category (anything unmapped falls back to TECHNOLOGY)
const TAG_CATEGORY = {
  // Science
  'science':        CATEGORY.SCIENCE,
  'physics':        CATEGORY.SCIENCE,
  'biology':        CATEGORY.SCIENCE,
  'chemistry':      CATEGORY.SCIENCE,
  'mathematics':    CATEGORY.SCIENCE,
  'space':          CATEGORY.SCIENCE,
  // Health
  'health':         CATEGORY.MIND_BODY,
  'cogsci':         CATEGORY.MIND_BODY,
  // Arts
  'art':            CATEGORY.ARTS_CULTURE,
  'design':         CATEGORY.ARTS_CULTURE,
  'typography':     CATEGORY.ARTS_CULTURE,
  // Games
  'games':          CATEGORY.GAMES_HOBBIES,
  'gamedev':        CATEGORY.GAMES_HOBBIES,
  'film':           CATEGORY.ARTS_CULTURE,
};

function tagsToCategory(tags) {
  for (const tag of tags) {
    if (TAG_CATEGORY[tag]) return TAG_CATEGORY[tag];
  }
  return CATEGORY.TECHNOLOGY;
}

// ── Fetch from Lobsters ───────────────────────────────────────────────────────

async function fetchLobsters() {
  console.log(`\n[lobsters] Fetching ${PAGES} pages of hottest stories...`);
  const rows = [];
  const seen = new Set();

  for (let page = 1; page <= PAGES; page++) {
    let data;
    let ok = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(
          `https://lobste.rs/newest.json?page=${page}`,
          { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' } }
        );
        if (!res.ok) { console.warn(`[lobsters]   page ${page}: HTTP ${res.status}`); break; }
        data = await res.json();
        ok = true;
        break;
      } catch (err) {
        console.warn(`[lobsters]   page ${page}: fetch error (attempt ${attempt}/3) — ${err.message}`);
        if (attempt < 3) await sleep(3000 * attempt);
      }
    }
    if (!ok) continue;

    for (const story of data) {
      const url = story.url;
      // Skip Ask / Lobsters-internal discussion links
      if (!url || url.startsWith('https://lobste.rs/') || seen.has(url)) continue;
      seen.add(url);

      rows.push({
        url,
        title:        story.title ?? null,
        description:  story.description_plain ?? null,
        og_image_url: null,
        category_id:  tagsToCategory(story.tags ?? []),
        source:       'lobsters',
      });
    }

    console.log(`[lobsters]   page ${page}: ${data.length} stories`);
    await sleep(DELAY_MS);
  }

  console.log(`[lobsters] Stories collected: ${rows.length}`);
  return rows;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Lobsters seeder ===');

  let rows;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[lobsters] Loaded ${rows.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    rows = await fetchLobsters();
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(rows));
    console.log(`[lobsters] Cached ${rows.length} rows to ${CACHE_FILE}`);
  }

  console.log(`\n[lobsters] Total: ${rows.length} — upserting (with OG fetch)...`);
  const result = await upsertUrls(rows, { fetchOg: true, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
