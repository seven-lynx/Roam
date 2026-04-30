/**
 * seed-bandcamp.js — Bandcamp music seeder
 *
 * Uses Bandcamp's internal tag hub API (`/api/hub/2/dig_deeper`) to enumerate
 * albums and artists by genre tag. No official API key required.
 *
 * POST body: { tag, page, sort: "pop", tags: [], location: 0, format: "all" }
 * Response:  { items: [...], more_available: bool }
 *
 * Rate limit: 1500ms between requests (polite).
 *
 * Run from repo root:
 *   node scripts/seed-bandcamp.js
 *   node scripts/seed-bandcamp.js --no-cache   # re-fetch, skip cache
 *   node scripts/seed-bandcamp.js --reset       # clear cache and restart
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'bandcamp.json');
const NO_CACHE   = process.argv.includes('--no-cache');
const RESET      = process.argv.includes('--reset');

const PAGES_PER_TAG = 20;  // ~8-12 items/page = ~160-240 per tag
const DELAY_MS      = 1500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Tag → Category mapping ────────────────────────────────────────────────────
const TAGS = [
  // Arts & Culture — music genres
  { tag: 'jazz',            category: CATEGORY.ARTS_CULTURE },
  { tag: 'classical',       category: CATEGORY.ARTS_CULTURE },
  { tag: 'folk',            category: CATEGORY.ARTS_CULTURE },
  { tag: 'blues',           category: CATEGORY.ARTS_CULTURE },
  { tag: 'soul',            category: CATEGORY.ARTS_CULTURE },
  { tag: 'r-and-b',         category: CATEGORY.ARTS_CULTURE },
  { tag: 'hip-hop',         category: CATEGORY.ARTS_CULTURE },
  { tag: 'indie',           category: CATEGORY.ARTS_CULTURE },
  { tag: 'rock',            category: CATEGORY.ARTS_CULTURE },
  { tag: 'pop',             category: CATEGORY.ARTS_CULTURE },
  { tag: 'punk',            category: CATEGORY.ARTS_CULTURE },
  { tag: 'metal',           category: CATEGORY.ARTS_CULTURE },
  { tag: 'country',         category: CATEGORY.ARTS_CULTURE },
  { tag: 'world-music',     category: CATEGORY.ARTS_CULTURE },
  { tag: 'reggae',          category: CATEGORY.ARTS_CULTURE },
  { tag: 'soundtrack',      category: CATEGORY.ARTS_CULTURE },
  { tag: 'singer-songwriter', category: CATEGORY.ARTS_CULTURE },
  { tag: 'lo-fi',           category: CATEGORY.ARTS_CULTURE },

  // Weird & Wonderful — experimental / niche
  { tag: 'electronic',      category: CATEGORY.WEIRD_WONDERFUL },
  { tag: 'ambient',         category: CATEGORY.WEIRD_WONDERFUL },
  { tag: 'experimental',    category: CATEGORY.WEIRD_WONDERFUL },
  { tag: 'noise',           category: CATEGORY.WEIRD_WONDERFUL },
  { tag: 'drone',           category: CATEGORY.WEIRD_WONDERFUL },
  { tag: 'synthwave',       category: CATEGORY.WEIRD_WONDERFUL },
  { tag: 'vaporwave',       category: CATEGORY.WEIRD_WONDERFUL },
  { tag: 'chiptune',        category: CATEGORY.WEIRD_WONDERFUL },
  { tag: 'post-rock',       category: CATEGORY.WEIRD_WONDERFUL },
  { tag: 'krautrock',       category: CATEGORY.WEIRD_WONDERFUL },

  // Mind & Body
  { tag: 'meditation',      category: CATEGORY.MIND_BODY },
  { tag: 'new-age',         category: CATEGORY.MIND_BODY },
  { tag: 'classical-piano', category: CATEGORY.MIND_BODY },
];

// ── API fetch ─────────────────────────────────────────────────────────────────

async function fetchTag(tag, categoryId) {
  const entries = [];

  for (let page = 1; page <= PAGES_PER_TAG; page++) {
    await sleep(DELAY_MS);

    let data;
    try {
      const res = await fetch('https://bandcamp.com/api/hub/2/dig_deeper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept':       'application/json, text/javascript, */*; q=0.01',
          'Referer':      `https://bandcamp.com/tag/${encodeURIComponent(tag)}`,
          'Origin':       'https://bandcamp.com',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          tag,
          page,
          sort:     'pop',
          tags:     [],
          location: 0,
          format:   'all',
        }),
      });

      if (res.status === 429) {
        console.warn(`[bandcamp]   tag=${tag} p${page}: rate limited, waiting 60s...`);
        await sleep(60000);
        continue;
      }
      if (res.status === 403) {
        console.warn(`[bandcamp]   tag=${tag} p${page}: 403 Forbidden — Cloudflare block, skipping tag`);
        break;
      }
      if (!res.ok) {
        console.warn(`[bandcamp]   tag=${tag} p${page}: HTTP ${res.status}`);
        break;
      }

      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        // Cloudflare HTML challenge page
        console.warn(`[bandcamp]   tag=${tag} p${page}: non-JSON response (bot check?) — skipping tag`);
        break;
      }
    } catch (err) {
      console.warn(`[bandcamp]   tag=${tag} p${page}: error — ${err.message}`);
      break;
    }

    const items = data?.items ?? [];
    if (items.length === 0) break;

    for (const item of items) {
      const url = item.tralbum_url || item.url;
      if (!url) continue;

      const title = item.title || item.artist || '';
      if (!title) continue;

      // Build description: "Artist — bio snippet" or just bio
      const artist  = item.artist || '';
      const bio     = item.bio ? item.bio.replace(/\s+/g, ' ').trim() : '';
      const description = artist && bio
        ? `${artist} — ${bio}`.slice(0, 500)
        : (bio || artist).slice(0, 500);

      if (!description) continue;

      entries.push({
        url:         url.startsWith('http') ? url : `https:${url}`,
        title:       title.slice(0, 300),
        description,
        category_id: categoryId,
        source:      'bandcamp',
      });
    }

    console.log(`[bandcamp]   tag=${tag} p${page}: ${items.length} items (total ${entries.length})`);

    if (!data.more_available) {
      console.log(`[bandcamp]   tag=${tag}: end at page ${page}`);
      break;
    }
  }

  return entries;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

  if (RESET && existsSync(CACHE_FILE)) {
    const { unlinkSync } = await import('fs');
    unlinkSync(CACHE_FILE);
    console.log('[bandcamp] Cache cleared.');
  }

  let allItems;

  if (!NO_CACHE && !RESET && existsSync(CACHE_FILE)) {
    console.log('[bandcamp] Loading from cache...');
    allItems = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[bandcamp] ${allItems.length} items loaded from cache.`);
  } else {
    console.log(`\n[bandcamp] Fetching (${TAGS.length} tags × up to ${PAGES_PER_TAG} pages)...`);

    allItems = [];
    const globalSeen = new Set();

    for (const { tag, category } of TAGS) {
      const entries = await fetchTag(tag, category);
      let added = 0;
      for (const entry of entries) {
        if (!globalSeen.has(entry.url)) {
          globalSeen.add(entry.url);
          allItems.push(entry);
          added++;
        }
      }
      console.log(`[bandcamp] tag=${tag}: ${entries.length} fetched, ${added} new → total ${allItems.length}`);
    }

    writeFileSync(CACHE_FILE, JSON.stringify(allItems, null, 2));
    console.log(`\n[bandcamp] Cached ${allItems.length} items to ${CACHE_FILE}`);
  }

  if (allItems.length === 0) {
    console.log('[bandcamp] No items to upsert.');
    return;
  }

  console.log(`\n[bandcamp] Total: ${allItems.length} items — upserting...`);
  await upsertUrls(allItems, { fetchOg: false, verbose: false });
  console.log('[bandcamp] 🎉 Bandcamp seeding complete!');
}

main().catch(err => {
  console.error('[bandcamp] Fatal error:', err);
  process.exit(1);
});
