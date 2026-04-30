/**
 * seed-itchio.js — Itch.io indie game seeder
 *
 * Scrapes the public Itch.io browse API (?format=json) by genre and tag.
 * No API key required. Returns 36 items per page with HTML in `content` field.
 * Parses HTML via regex to extract URL, title, description, and genre.
 *
 * Rate limit: 600ms between requests (polite, no documented limit).
 *
 * Run from repo root:
 *   node scripts/seed-itchio.js
 *   node scripts/seed-itchio.js --no-cache   # re-fetch, skip cache
 *   node scripts/seed-itchio.js --reset       # clear cache and restart
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'itchio.json');
const NO_CACHE   = process.argv.includes('--no-cache');
const RESET      = process.argv.includes('--reset');

const PAGES_PER_SOURCE = 30;   // 30 × 36 = up to 1,080 items per source
const DELAY_MS         = 600;  // ms between requests
const MIN_ITEMS_PER_PAGE = 5;  // stop paginating if fewer items returned

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Sources ───────────────────────────────────────────────────────────────────
// path: the itch.io browse path (after /games/)
// category: Roam category UUID
// sort: 'top' for all-time top-rated, 'popular' for trending

const SOURCES = [
  // ── Games & Hobbies ─────────────────────────────────────────────────────────
  { path: 'genre-action',           category: CATEGORY.GAMES_HOBBIES },
  { path: 'genre-adventure',        category: CATEGORY.GAMES_HOBBIES },
  { path: 'genre-platformer',       category: CATEGORY.GAMES_HOBBIES },
  { path: 'genre-puzzle',           category: CATEGORY.GAMES_HOBBIES },
  { path: 'genre-rpg',              category: CATEGORY.GAMES_HOBBIES },
  { path: 'genre-strategy',         category: CATEGORY.GAMES_HOBBIES },
  { path: 'genre-simulation',       category: CATEGORY.GAMES_HOBBIES },
  { path: 'genre-shooter',          category: CATEGORY.GAMES_HOBBIES },
  { path: 'genre-survival',         category: CATEGORY.GAMES_HOBBIES },
  { path: 'genre-card-game',        category: CATEGORY.GAMES_HOBBIES },
  { path: 'genre-fighting',         category: CATEGORY.GAMES_HOBBIES },
  { path: 'genre-racing',           category: CATEGORY.GAMES_HOBBIES },
  { path: 'genre-sports',           category: CATEGORY.GAMES_HOBBIES },
  { path: 'tag-multiplayer',        category: CATEGORY.GAMES_HOBBIES },
  { path: 'tag-roguelike',          category: CATEGORY.GAMES_HOBBIES },
  { path: 'tag-metroidvania',       category: CATEGORY.GAMES_HOBBIES },
  { path: 'tag-2d',                 category: CATEGORY.GAMES_HOBBIES },
  { path: 'tag-pixel-art',          category: CATEGORY.GAMES_HOBBIES },
  { path: 'tag-open-world',         category: CATEGORY.GAMES_HOBBIES },

  // ── Arts & Culture ──────────────────────────────────────────────────────────
  { path: 'genre-visual-novel',          category: CATEGORY.ARTS_CULTURE },
  { path: 'genre-interactive-fiction',   category: CATEGORY.ARTS_CULTURE },
  { path: 'genre-rhythm',               category: CATEGORY.ARTS_CULTURE },
  { path: 'tag-story-rich',             category: CATEGORY.ARTS_CULTURE },
  { path: 'tag-narrative',              category: CATEGORY.ARTS_CULTURE },

  // ── Weird & Wonderful ───────────────────────────────────────────────────────
  { path: 'tag-horror',                 category: CATEGORY.WEIRD_WONDERFUL },
  { path: 'tag-experimental',           category: CATEGORY.WEIRD_WONDERFUL },
  { path: 'tag-surreal',                category: CATEGORY.WEIRD_WONDERFUL },
  { path: 'tag-procedural-generation',  category: CATEGORY.WEIRD_WONDERFUL },
  { path: 'tag-generative',             category: CATEGORY.WEIRD_WONDERFUL },
  { path: 'tag-psychological-horror',   category: CATEGORY.WEIRD_WONDERFUL },

  // ── History & Ideas ─────────────────────────────────────────────────────────
  { path: 'genre-educational',          category: CATEGORY.HISTORY_IDEAS },
  { path: 'tag-historical',             category: CATEGORY.HISTORY_IDEAS },
  { path: 'tag-lore',                   category: CATEGORY.HISTORY_IDEAS },
];

// ── HTML parsing ─────────────────────────────────────────────────────────────

/**
 * Parse game entries from the raw HTML returned in itch.io's ?format=json response.
 * Returns array of { url, title, description, genre } objects.
 */
function parseGames(html) {
  const games = [];

  // Split on game_cell divs — each starts with data-game_id
  const cells = html.split(/(?=<div[^>]+data-game_id=")/);

  for (const cell of cells) {
    // URL + title: <a ... class="title game_link">TITLE</a>
    const linkMatch = cell.match(
      /href="(https?:\/\/[^"]+\.itch\.io\/[^"]+)"[^>]*class="title game_link"[^>]*>([^<]+)<\/a>/
    );
    if (!linkMatch) continue;

    const url   = linkMatch[1];
    const title = decodeHtml(linkMatch[2].trim());

    // Description: title attribute of the .game_text element
    const descMatch = cell.match(/title="([^"]*)" class="game_text"/);
    const description = descMatch ? decodeHtml(descMatch[1].trim()) : '';
    if (!description) continue; // skip games with no description

    // Genre: text inside .game_genre
    const genreMatch = cell.match(/class="game_genre">([^<]*)</);
    const genre = genreMatch ? genreMatch[1].trim() : '';

    games.push({ url, title, description, genre });
  }

  return games;
}

function decodeHtml(str) {
  return str
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

async function fetchSource(path, categoryId) {
  const entries = [];

  for (let page = 1; page <= PAGES_PER_SOURCE; page++) {
    const url = `https://itch.io/games/${path}?format=json&sort=top&page=${page}`;

    let data;
    try {
      await sleep(DELAY_MS);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)',
          'Accept': 'application/json',
        },
      });

      if (res.status === 429) {
        console.warn(`[itchio]   ${path} p${page}: rate limited, waiting 30s...`);
        await sleep(30000);
        continue;
      }
      if (!res.ok) {
        console.warn(`[itchio]   ${path} p${page}: HTTP ${res.status}`);
        break;
      }
      data = await res.json();
    } catch (err) {
      console.warn(`[itchio]   ${path} p${page}: error — ${err.message}`);
      break;
    }

    const { num_items, content } = data;
    if (!content || num_items == null) break;

    const games = parseGames(content);
    for (const g of games) {
      entries.push({
        url:         g.url,
        title:       g.title.slice(0, 300),
        description: g.description.slice(0, 500),
        category_id: categoryId,
        source:      'itchio',
      });
    }

    console.log(`[itchio]   ${path} p${page}: ${games.length} games (total ${entries.length})`);

    if (num_items < MIN_ITEMS_PER_PAGE) {
      console.log(`[itchio]   ${path}: end of results at page ${page}`);
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
    console.log('[itchio] Cache cleared.');
  }

  let allGames;

  if (!NO_CACHE && !RESET && existsSync(CACHE_FILE)) {
    console.log('[itchio] Loading from cache...');
    allGames = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[itchio] ${allGames.length} games loaded from cache.`);
  } else {
    console.log(`\n[itchio] Fetching (${SOURCES.length} sources × up to ${PAGES_PER_SOURCE} pages × ~36 items)...`);

    allGames = [];
    const globalSeen = new Set();

    for (const { path, category } of SOURCES) {
      const entries = await fetchSource(path, category);
      let added = 0;
      for (const entry of entries) {
        if (!globalSeen.has(entry.url)) {
          globalSeen.add(entry.url);
          allGames.push(entry);
          added++;
        }
      }
      console.log(`[itchio] source=${path}: ${entries.length} fetched, ${added} new → total ${allGames.length}`);
    }

    writeFileSync(CACHE_FILE, JSON.stringify(allGames, null, 2));
    console.log(`\n[itchio] Cached ${allGames.length} games to ${CACHE_FILE}`);
  }

  if (allGames.length === 0) {
    console.log('[itchio] No games to upsert.');
    return;
  }

  console.log(`\n[itchio] Total: ${allGames.length} games — upserting...`);
  await upsertUrls(allGames, { fetchOg: false, verbose: false });
  console.log('[itchio] 🎉 Itch.io seeding complete!');
}

main().catch(err => {
  console.error('[itchio] Fatal error:', err);
  process.exit(1);
});
