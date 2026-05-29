/**
 * seed-boardgamegeek.js — BoardGameGeek seeder
 *
 * Collects top-rated board games via BGG's XML API v2.
 * No API key required. No HTML scraping (avoids Cloudflare blocks).
 *
 * Strategy (3 phases):
 *  1. Hot list  — BGG's current 50 hottest games (always works)
 *  2. Search    — 90+ search terms (mechanics, themes, series) via the XML
 *                 search endpoint; each returns up to 1,000 candidate IDs
 *  3. Metadata  — Batch-fetch /thing for all collected IDs; keep only games
 *                 with usersrated ≥ 200 and bayesaverage ≥ 6.0
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
import { upsertUrls, CATEGORY, SUBCATEGORY, fetchWithRetry } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'boardgamegeek.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const THING_BATCH    = 20;    // BGG recommends ≤20 IDs per /thing request
const DELAY_MS       = 2500;  // BGG asks for reasonable rate limiting
const RETRY_DELAY    = 10000;
const MIN_USERS_RATED = 200;
const MIN_BAYES_AVG  = 6.0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Search terms covering major BGG game categories / mechanics / themes ───────
const SEARCH_TERMS = [
  // Core mechanics
  'worker placement', 'deck building', 'tile placement', 'area control',
  'cooperative', 'drafting', 'engine building', 'push your luck',
  'roll and write', 'legacy game', 'asymmetric', 'auction bidding',
  'network building', 'route building', 'deckbuilder',
  // Themes
  'medieval', 'space exploration', 'fantasy', 'horror', 'pirate',
  'dungeon crawler', 'civilization', 'heist', 'mythology', 'western',
  'prehistoric', 'steampunk', 'cyberpunk', 'submarine',
  // Well-known series / publishers
  'catan', 'ticket to ride', 'carcassonne', 'pandemic', 'dominion',
  'terraforming mars', 'wingspan', 'everdell', 'gloomhaven', 'root',
  'spirit island', 'arkham horror', 'robinson crusoe', 'viticulture',
  'agricola', 'puerto rico', 'power grid', '7 wonders', 'brass',
  'twilight imperium', 'scythe', 'azul', 'patchwork', 'splendor',
  'great western trail', 'orleans', 'concordia', 'istanbul',
  'lords of waterdeep', 'king of tokyo', 'sheriff of nottingham',
  // Abstract / classics
  'chess', 'go', 'checkers', 'backgammon', 'mancala',
  // Party / family
  'party game', 'word game', 'trivia', 'deduction', 'social deduction',
  'traitor', 'bluffing', 'hidden role',
  // War games
  'wargame', 'hex and counter', 'block wargame', 'naval', 'world war',
  // Economic
  'trading', 'stock market', 'commodity', 'resource management',
  // Card games
  'card game', 'trick taking', 'hand management', 'tableau building',
];

// ── Phase 1: hot list ─────────────────────────────────────────────────────────
async function fetchHotList() {
  const url = 'https://boardgamegeek.com/xmlapi2/hot?type=boardgame';
  let res;
  try {
    res = await fetchWithRetry(url, {
      headers: { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)' },
    });
  } catch (err) {
    console.warn('[bgg] Hot list fetch error:', err.message);
    return [];
  }
  if (!res.ok) {
    console.warn('[bgg] Hot list HTTP', res.status);
    return [];
  }
  const xml = await res.text();
  const ids  = [];
  const re   = /<item[^>]+id="(\d+)"/g;
  let m;
  while ((m = re.exec(xml)) !== null) ids.push(m[1]);
  console.log(`[bgg] Hot list: ${ids.length} IDs`);
  return ids;
}

// ── Phase 2: collect IDs via search ───────────────────────────────────────────
async function searchForIds(term) {
  const url = `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(term)}&type=boardgame`;
  let res;
  try {
    res = await fetchWithRetry(url, {
      headers: { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)' },
    });
    // BGG returns 202 when data is still being prepared — treat as retriable
    if (res.status === 202) { await sleep(RETRY_DELAY); return searchForIds(term); }
    if (!res.ok) return [];
  } catch { return []; }

  const xml = await res.text();
  const ids  = [];
  const re   = /<item[^>]+type="boardgame"[^>]+id="(\d+)"/g;
  let m;
  while ((m = re.exec(xml)) !== null) ids.push(m[1]);
  return ids;
}

// ── Phase 3: batch-fetch metadata ─────────────────────────────────────────────
async function fetchThings(ids) {
  const rows = [];

  for (let i = 0; i < ids.length; i += THING_BATCH) {
    const batch = ids.slice(i, i + THING_BATCH);
    const url   = `https://boardgamegeek.com/xmlapi2/thing?id=${batch.join(',')}&stats=1`;

    let res;
    try {
      res = await fetchWithRetry(url, {
        headers: { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)' },
      });
      if (res.status === 202) {
        console.log(`[bgg] Batch ${Math.floor(i / THING_BATCH) + 1}: 202 queued, retrying...`);
        await sleep(RETRY_DELAY);
        res = await fetchWithRetry(url, { headers: { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)' } });
      }
    } catch (err) {
      console.warn(`[bgg] Batch error: ${err.message}`);
      await sleep(DELAY_MS);
      continue;
    }

    if (!res || !res.ok) {
      await sleep(DELAY_MS);
      continue;
    }

    const xml = await res.text();

    // Parse each <item> block
    const itemBlocks = xml.match(/<item[^>]*type="boardgame[^"]*"[\s\S]*?<\/item>/g) ?? [];

    for (const block of itemBlocks) {
      const idMatch      = block.match(/<item[^>]*id="(\d+)"/);
      const nameMatch    = block.match(/<name[^>]*type="primary"[^>]*value="([^"]+)"/);
      const imageMatch   = block.match(/<image>([^<]+)<\/image>/);
      const descMatch    = block.match(/<description>([^<]*(?:<!\[CDATA\[)?[\s\S]*?(?:\]\]>)?)<\/description>/);
      const yearMatch    = block.match(/<yearpublished[^>]*value="(\d{4})"/);
      const usersMatch   = block.match(/<usersrated[^>]*value="(\d+)"/);
      const bayesMatch   = block.match(/<bayesaverage[^>]*value="([\d.]+)"/);

      if (!idMatch || !nameMatch) continue;

      // Quality filter: skip games with too few ratings or too low a score
      const usersRated = parseInt(usersMatch?.[1] ?? '0', 10);
      const bayesAvg   = parseFloat(bayesMatch?.[1] ?? '0');
      if (usersRated < MIN_USERS_RATED || bayesAvg < MIN_BAYES_AVG) continue;

      const gameId  = idMatch[1];
      const title   = nameMatch[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
      const year    = yearMatch ? yearMatch[1] : null;

      let image = imageMatch ? imageMatch[1].trim() : null;
      if (image && !image.startsWith('http')) image = `https:${image}`;

      let rawDesc = descMatch ? descMatch[1] : null;
      if (rawDesc) {
        rawDesc = rawDesc
          .replace(/&#10;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/<[^>]+>/g, '')
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
        category_id:    CATEGORY.GAMES_HOBBIES,
        subcategory_id: SUBCATEGORY.BOARD_GAMES_TABLETOP,
        source:         'boardgamegeek',
      });
    }

    if ((Math.floor(i / THING_BATCH) + 1) % 20 === 0) {
      process.stdout.write(`\r[bgg] Fetched metadata: ${rows.length} qualifying games  `);
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
    // Phase 1: hot list
    console.log('\n[bgg] Phase 1: fetching hot list...');
    const hotIds = await fetchHotList();
    await sleep(DELAY_MS);

    // Phase 2: search terms → candidate IDs
    console.log(`\n[bgg] Phase 2: collecting IDs via ${SEARCH_TERMS.length} search terms...`);
    const allIds = new Set(hotIds);
    for (let i = 0; i < SEARCH_TERMS.length; i++) {
      const term = SEARCH_TERMS[i];
      const ids  = await searchForIds(term);
      ids.forEach((id) => allIds.add(id));
      process.stdout.write(`\r[bgg]   ${i + 1}/${SEARCH_TERMS.length} searches  ${allIds.size} unique IDs  `);
      await sleep(DELAY_MS);
    }
    const uniqueIds = [...allIds];
    console.log(`\n[bgg] Phase 2 done: ${uniqueIds.length} unique candidate IDs`);

    // Phase 3: fetch full metadata, filter by quality
    console.log(`\n[bgg] Phase 3: fetching metadata (filter: usersRated≥${MIN_USERS_RATED}, bayes≥${MIN_BAYES_AVG})...`);
    rows = await fetchThings(uniqueIds);
    console.log(`\n[bgg] Phase 3 done: ${rows.length} qualifying games`);

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
