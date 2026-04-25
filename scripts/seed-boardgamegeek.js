/**
 * seed-boardgamegeek.js — BoardGameGeek seeder
 *
 * Pulls top-rated board games from BGG's public XML API v2.
 * No API key required. BGG recommends a 5s delay between requests.
 *
 * Strategy:
 *  1. Fetch the "browse" pages (ranked by rating) to get game IDs
 *  2. Fetch full metadata for each game in batches of 20
 *
 * API docs: https://boardgamegeek.com/wiki/page/BGG_XML_API2
 *
 * Run from repo root:
 *   node scripts/seed-boardgamegeek.js
 *   node scripts/seed-boardgamegeek.js --no-cache
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'boardgamegeek.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const BROWSE_PAGES  = 20;   // 100 games per page = 2,000 top-rated games
const THING_BATCH   = 20;   // BGG recommends ≤20 IDs per /thing request
const DELAY_MS      = 2000; // BGG asks for reasonable rate limiting
const RETRY_DELAY   = 10000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Phase 1: Collect game IDs from browse pages ───────────────────────────────
async function fetchGameIds() {
  const ids = [];

  for (let page = 1; page <= BROWSE_PAGES; page++) {
    const url = `https://boardgamegeek.com/browse/boardgame/page/${page}`;

    let res;
    try {
      res = await fetch(url, {
        headers: {
          'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)',
          'Accept': 'text/html',
        },
      });
    } catch (err) {
      console.warn(`[bgg] Browse page ${page}: ${err.message}`);
      await sleep(RETRY_DELAY);
      continue;
    }

    if (!res.ok) {
      console.warn(`[bgg] Browse page ${page}: HTTP ${res.status}`);
      await sleep(RETRY_DELAY);
      continue;
    }

    const html = await res.text();

    // Extract game IDs from links like /boardgame/12345/game-name
    const matches = html.matchAll(/href="\/boardgame\/(\d+)\//g);
    for (const m of matches) {
      const id = m[1];
      if (!ids.includes(id)) ids.push(id);
    }

    console.log(`[bgg] Browse page ${page}: ${ids.length} IDs total`);
    await sleep(DELAY_MS);
  }

  return [...new Set(ids)]; // deduplicate
}

// ── Phase 2: Fetch full game metadata in batches ──────────────────────────────
async function fetchThings(ids) {
  const rows = [];

  for (let i = 0; i < ids.length; i += THING_BATCH) {
    const batch = ids.slice(i, i + THING_BATCH);
    const url   = `https://boardgamegeek.com/xmlapi2/thing?id=${batch.join(',')}&stats=1`;

    let res;
    let attempts = 0;
    while (attempts < 3) {
      try {
        res = await fetch(url, {
          headers: { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)' },
        });

        // BGG returns 202 Accepted when data is being prepared — retry
        if (res.status === 202) {
          attempts++;
          console.log(`[bgg] Batch ${Math.floor(i / THING_BATCH) + 1}: 202 queued, retrying...`);
          await sleep(RETRY_DELAY);
          continue;
        }

        if (!res.ok) {
          console.warn(`[bgg] Batch ${Math.floor(i / THING_BATCH) + 1}: HTTP ${res.status}`);
          break;
        }

        break;
      } catch (err) {
        attempts++;
        console.warn(`[bgg] Batch error: ${err.message} — retry ${attempts}/3`);
        await sleep(RETRY_DELAY);
      }
    }

    if (!res || !res.ok) {
      await sleep(DELAY_MS);
      continue;
    }

    const xml = await res.text();

    // Parse each <item> block
    const itemBlocks = xml.match(/<item[^>]*type="boardgame[^"]*"[\s\S]*?<\/item>/g) ?? [];

    for (const block of itemBlocks) {
      const idMatch    = block.match(/<item[^>]*id="(\d+)"/);
      const nameMatch  = block.match(/<name[^>]*type="primary"[^>]*value="([^"]+)"/);
      const imageMatch = block.match(/<image>([^<]+)<\/image>/);
      const descMatch  = block.match(/<description>([^<]*(?:<!\[CDATA\[)?[\s\S]*?(?:\]\]>)?)<\/description>/);
      const yearMatch  = block.match(/<yearpublished[^>]*value="(\d{4})"/);

      if (!idMatch || !nameMatch) continue;

      const gameId  = idMatch[1];
      const title   = nameMatch[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
      const year    = yearMatch ? yearMatch[1] : null;

      let image = imageMatch ? imageMatch[1].trim() : null;
      if (image && !image.startsWith('http')) image = `https:${image}`;

      let rawDesc = descMatch ? descMatch[1] : null;
      if (rawDesc) {
        // Unescape common HTML entities
        rawDesc = rawDesc
          .replace(/&#10;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/<[^>]+>/g, '') // strip any HTML tags
          .trim()
          .slice(0, 500);
      }

      const description = rawDesc
        ? (year ? `(${year}) ${rawDesc}` : rawDesc)
        : (year ? `Published ${year}` : null);

      rows.push({
        url:          `https://boardgamegeek.com/boardgame/${gameId}`,
        title,
        description,
        og_image_url: image,
        category_id:  CATEGORY.GAMES_HOBBIES,
        source:       'boardgamegeek',
      });
    }

    if ((Math.floor(i / THING_BATCH) + 1) % 10 === 0) {
      console.log(`[bgg] Fetched metadata for ${rows.length} games so far...`);
    }

    await sleep(DELAY_MS);
  }

  return rows;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== BoardGameGeek seeder ===');

  let rows;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[bgg] Loaded ${rows.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    console.log(`\n[bgg] Phase 1: collecting top ${BROWSE_PAGES * 100} game IDs...`);
    const ids = await fetchGameIds();
    console.log(`[bgg] Phase 1 done: ${ids.length} unique IDs`);

    console.log(`\n[bgg] Phase 2: fetching game metadata in batches of ${THING_BATCH}...`);
    rows = await fetchThings(ids);
    console.log(`[bgg] Phase 2 done: ${rows.length} games with metadata`);

    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(rows));
    console.log(`[bgg] Cached ${rows.length} rows to ${CACHE_FILE}`);
  }

  console.log(`\n[bgg] Total: ${rows.length} — upserting...`);
  const result = await upsertUrls(rows, { fetchOg: false, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
