/**
 * seed-marginalia.mjs — Marginalia Search seeder
 *
 * Marginalia (search.marginalia.nu) is an independent search engine that prizes
 * non-commercial, text-first personal and academic websites — exactly the kind
 * of hidden-gem content Roam is designed to surface.
 *
 * Strategy: query Marginalia's public search API with ~80 topic terms, collect
 * unique URLs from result pages, deduplicate across queries.
 *
 * API:  https://search.marginalia.nu/api/search?query=TERM&index=0&count=100
 * No API key required. Be polite — Marginalia is run by one person.
 *
 * Run from repo root:
 *   node scripts/seed-marginalia.mjs
 *   node scripts/seed-marginalia.mjs --no-cache
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY, fetchWithRetry } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'marginalia.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const DELAY_MS  = 2000;  // Very polite — single-person project
const COUNT     = 100;   // Results per query (Marginalia's max)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Search terms → Roam categories ───────────────────────────────────────────
const QUERIES = [
  // Science
  { q: 'astronomy stargazing',       cat: CATEGORY.SCIENCE },
  { q: 'physics mathematics',        cat: CATEGORY.SCIENCE },
  { q: 'biology ecology nature',     cat: CATEGORY.SCIENCE },
  { q: 'chemistry experiments',      cat: CATEGORY.SCIENCE },
  { q: 'geology earth science',      cat: CATEGORY.SCIENCE },
  { q: 'botany plants',              cat: CATEGORY.SCIENCE },
  { q: 'weather meteorology',        cat: CATEGORY.SCIENCE },
  { q: 'space exploration',          cat: CATEGORY.SCIENCE },
  { q: 'mathematics proof',          cat: CATEGORY.SCIENCE },
  // Technology
  { q: 'linux unix command line',    cat: CATEGORY.TECHNOLOGY },
  { q: 'programming tutorial',       cat: CATEGORY.TECHNOLOGY },
  { q: 'open source project',        cat: CATEGORY.TECHNOLOGY },
  { q: 'amateur radio ham',          cat: CATEGORY.TECHNOLOGY },
  { q: 'vintage computers retro',    cat: CATEGORY.TECHNOLOGY },
  { q: 'raspberry pi electronics',   cat: CATEGORY.TECHNOLOGY },
  { q: 'emulation gaming',           cat: CATEGORY.TECHNOLOGY },
  { q: 'personal website blog tech', cat: CATEGORY.TECHNOLOGY },
  { q: 'security cryptography',      cat: CATEGORY.TECHNOLOGY },
  // Arts & Culture
  { q: 'photography personal',       cat: CATEGORY.ARTS_CULTURE },
  { q: 'music composition theory',   cat: CATEGORY.ARTS_CULTURE },
  { q: 'poetry literature writing',  cat: CATEGORY.ARTS_CULTURE },
  { q: 'art gallery painting',       cat: CATEGORY.ARTS_CULTURE },
  { q: 'comics illustration',        cat: CATEGORY.ARTS_CULTURE },
  { q: 'film cinema review',         cat: CATEGORY.ARTS_CULTURE },
  { q: 'book review literary',       cat: CATEGORY.ARTS_CULTURE },
  { q: 'folklore mythology story',   cat: CATEGORY.ARTS_CULTURE },
  // History & Ideas
  { q: 'history ancient medieval',   cat: CATEGORY.HISTORY_IDEAS },
  { q: 'philosophy ethics',          cat: CATEGORY.HISTORY_IDEAS },
  { q: 'archaeology ancient',        cat: CATEGORY.HISTORY_IDEAS },
  { q: 'economics political theory', cat: CATEGORY.HISTORY_IDEAS },
  { q: 'world history civilization', cat: CATEGORY.HISTORY_IDEAS },
  { q: 'linguistics language',       cat: CATEGORY.HISTORY_IDEAS },
  { q: 'religion theology',          cat: CATEGORY.HISTORY_IDEAS },
  // Games & Hobbies
  { q: 'chess strategy board game',  cat: CATEGORY.GAMES_HOBBIES },
  { q: 'tabletop rpg roleplaying',   cat: CATEGORY.GAMES_HOBBIES },
  { q: 'model trains miniature',     cat: CATEGORY.GAMES_HOBBIES },
  { q: 'cooking recipe food',        cat: CATEGORY.GAMES_HOBBIES },
  { q: 'gardening growing plants',   cat: CATEGORY.GAMES_HOBBIES },
  { q: 'woodworking craft hobby',    cat: CATEGORY.GAMES_HOBBIES },
  { q: 'science fiction fandom',     cat: CATEGORY.GAMES_HOBBIES },
  { q: 'cycling hiking outdoors',    cat: CATEGORY.GAMES_HOBBIES },
  // Mind & Body
  { q: 'meditation mindfulness',     cat: CATEGORY.MIND_BODY },
  { q: 'mental health psychology',   cat: CATEGORY.MIND_BODY },
  { q: 'fitness exercise health',    cat: CATEGORY.MIND_BODY },
  { q: 'nutrition diet wellness',    cat: CATEGORY.MIND_BODY },
  // People & Places
  { q: 'travel adventure journal',   cat: CATEGORY.PEOPLE_PLACES },
  { q: 'local history community',    cat: CATEGORY.PEOPLE_PLACES },
  { q: 'culture anthropology',       cat: CATEGORY.PEOPLE_PLACES },
  { q: 'geography place maps',       cat: CATEGORY.PEOPLE_PLACES },
  // Weird & Wonderful
  { q: 'curiosity odd interesting',  cat: CATEGORY.WEIRD_WONDERFUL },
  { q: 'conspiracy theory paranormal', cat: CATEGORY.WEIRD_WONDERFUL },
  { q: 'unusual weird quirky',       cat: CATEGORY.WEIRD_WONDERFUL },
  { q: 'personal website diary',     cat: CATEGORY.WEIRD_WONDERFUL },
];

// ── Fetch one search query ────────────────────────────────────────────────────
async function fetchQuery(q, index = 0) {
  const url = `https://search.marginalia.nu/api/search?query=${encodeURIComponent(q)}&index=${index}&count=${COUNT}`;

  let res;
  try {
    res = await fetchWithRetry(url, {
      headers: { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app; seeder bot)' },
    });
  } catch (err) {
    console.warn(`[marginalia] Fetch error: ${err.message} for "${q}"`);
    return [];
  }

  let data;
  try { data = await res.json(); } catch { return []; }

  const results = data?.results ?? [];
  return results
    .filter((r) => r.url && r.url.startsWith('http'))
    .map((r) => ({
      url:         r.url,
      title:       r.title ?? null,
      description: r.description ? r.description.trim().slice(0, 500) : null,
      og_image_url: null,
    }));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function fetchMarginalia() {
  const allRows = [];
  const seen    = new Set();

  for (let i = 0; i < QUERIES.length; i++) {
    const { q, cat } = QUERIES[i];
    const results = await fetchQuery(q);

    for (const r of results) {
      if (seen.has(r.url)) continue;
      seen.add(r.url);
      allRows.push({ ...r, category_id: cat, source: 'marginalia' });
    }

    process.stdout.write(`\r[marginalia] ${i + 1}/${QUERIES.length} queries  total=${allRows.length}  `);
    await sleep(DELAY_MS);
  }

  console.log(`\n\n[marginalia] Total unique pages: ${allRows.length}`);
  return allRows;
}

async function main() {
  console.log('=== Marginalia seeder ===');

  let rows;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[marginalia] Loaded ${rows.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    rows = await fetchMarginalia();
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(rows));
    console.log(`[marginalia] Cached ${rows.length} rows to ${CACHE_FILE}`);
  }

  console.log(`\n[marginalia] Total: ${rows.length} — upserting...`);
  const result = await upsertUrls(rows, { fetchOg: false, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => { console.error(err); process.exit(1); });
