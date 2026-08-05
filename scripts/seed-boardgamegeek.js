/**
 * seed-boardgamegeek.js — BoardGameGeek seeder
 *
 * Collects trending board games and tabletop RPGs via BGG's hotness API.
 * No API key required.
 *
 * Strategy:
 *   Fetch the 50-item hotness list for boardgame and rpgitem subtypes from
 *   api.geekdo.com (BGG's own JSON API used by their mobile apps). Each item
 *   includes title, description, image, year published, and rank.
 *   Running the seeder periodically accumulates new titles as the hotness
 *   list rotates.
 *
 * Run from repo root:
 *   node scripts/seed-boardgamegeek.js
 *   node scripts/seed-boardgamegeek.js --no-cache
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY, SUBCATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'boardgamegeek.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const API_BASE = 'https://api.geekdo.com/api/hotness?objecttype=thing&objectsubtype=';
const SUBTYPES = ['boardgame'];

// ── Fetch hotness list for one subtype ────────────────────────────────────────
async function fetchHotness(subtype) {
  const res = await fetch(`${API_BASE}${subtype}`, {
    headers: { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)', 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`[bgg] hotness/${subtype} HTTP ${res.status}`);
  const json = await res.json();
  return json.items ?? [];
}

// ── Map a hotness item to a seed row ──────────────────────────────────────────
function mapItem(item) {
  const path = item.href; // e.g. /boardgame/174430/gloomhaven
  if (!path) return null;
  const url = `https://boardgamegeek.com${path}`;

  const title = item.name?.trim();
  if (!title) return null;

  const year = item.yearpublished ? `(${item.yearpublished}) ` : '';
  const desc = item.description ? `${year}${item.description}`.trim() : (year ? year.trim() : null);

  const image = item.images?.square100?.src ?? item.imageurl ?? null;

  return {
    url,
    title,
    description: desc,
    og_image_url: image,
    category_id:    CATEGORY.GAMES_HOBBIES,
    subcategory_id: SUBCATEGORY.BOARD_GAMES_TABLETOP,
    source:         'boardgamegeek',
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== BoardGameGeek seeder ===');

  let rows;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[bgg] Loaded ${rows.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    const seen = new Set();
    rows = [];

    for (const subtype of SUBTYPES) {
      const items = await fetchHotness(subtype);
      let added = 0;
      for (const item of items) {
        const row = mapItem(item);
        if (!row || seen.has(row.url)) continue;
        seen.add(row.url);
        rows.push(row);
        added++;
      }
      console.log(`[bgg] ${subtype}: ${added} items`);
    }

    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(rows));
    console.log(`[bgg] Cached ${rows.length} rows to ${CACHE_FILE}`);
  }

  console.log(`\n[bgg] Total: ${rows.length} — upserting...`);
  const result = await upsertUrls(rows, { checkLive: true,  fetchOg: false, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
