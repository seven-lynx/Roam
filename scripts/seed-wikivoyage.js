/**
 * seed-wikivoyage.js — Wikivoyage seeder
 *
 * Pulls travel destination articles from Wikivoyage via the MediaWiki API.
 * No API key required. Great for PEOPLE_PLACES category.
 *
 * API docs: https://en.wikivoyage.org/w/api.php
 *
 * Run from repo root:
 *   node scripts/seed-wikivoyage.js
 *   node scripts/seed-wikivoyage.js --no-cache
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY, SUBCATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'wikivoyage.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const API_BASE  = 'https://en.wikivoyage.org/w/api.php';
const DELAY_MS  = 300;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Phase 1: Collect all article titles ───────────────────────────────────────
// Uses allpages with NO extra props to avoid prop-level continuation stalling
// the generator. We only request `info` (for the canonical URL).
async function fetchAllTitles() {
  const titles = [];
  let apcontinue = undefined;

  do {
    const params = new URLSearchParams({
      action:        'query',
      list:          'allpages',
      apnamespace:   '0',
      aplimit:       '500',
      format:        'json',
      formatversion: '2',
      ...(apcontinue ? { apcontinue } : {}),
    });

    let res;
    try {
      res = await fetch(`${API_BASE}?${params}`, {
        headers: { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)' },
      });
    } catch (err) {
      console.warn(`[wikivoyage] allpages fetch error — ${err.message}`);
      break;
    }

    if (!res.ok) { console.warn(`[wikivoyage] allpages HTTP ${res.status}`); break; }

    const json = await res.json();
    const pages = json?.query?.allpages ?? [];
    titles.push(...pages.map((p) => p.title));

    apcontinue = json?.continue?.apcontinue ?? undefined;
    if (apcontinue) await sleep(DELAY_MS);
  } while (apcontinue);

  return titles;
}

// ── Phase 2: Batch-fetch extracts + thumbnails for a list of titles ───────────
async function fetchMetaBatch(batch) {
  const params = new URLSearchParams({
    action:        'query',
    titles:        batch.join('|'),
    prop:          'extracts|pageimages|info',
    exintro:       '1',
    explaintext:   '1',
    exsentences:   '3',
    piprop:        'thumbnail',
    pithumbsize:   '400',
    inprop:        'url',
    format:        'json',
    formatversion: '2',
  });

  try {
    const res = await fetch(`${API_BASE}?${params}`, {
      headers: { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)' },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Object.values(json?.query?.pages ?? {});
  } catch {
    return [];
  }
}

// ── Main fetch ────────────────────────────────────────────────────────────────
async function fetchWikivoyage() {
  console.log(`\n[wikivoyage] Phase 1: collecting all article titles...`);
  const allTitles = await fetchAllTitles();

  // Filter out non-article pages
  const filtered = allTitles.filter(
    (t) => !t.startsWith('Wikivoyage:') && !t.startsWith('Template:') &&
            !t.startsWith('MediaWiki:') && !t.startsWith('Module:') &&
            !t.startsWith('Category:')
  );
  console.log(`[wikivoyage] Phase 1 done: ${filtered.length} articles found`);

  console.log(`[wikivoyage] Phase 2: fetching metadata in batches of 50...`);
  const allRows = [];

  for (let i = 0; i < filtered.length; i += 50) {
    const batch = filtered.slice(i, i + 50);
    const pages = await fetchMetaBatch(batch);

    for (const page of pages) {
      if (!page.fullurl || !page.title) continue;
      allRows.push({
        url:          page.fullurl,
        title:        page.title,
        description:  page.extract ? page.extract.trim().slice(0, 500) : null,
        og_image_url: page.thumbnail?.source ?? null,
        category_id:    CATEGORY.PEOPLE_PLACES,
        subcategory_id: SUBCATEGORY.TRAVEL_EXPLORATION,
        source:         'wikivoyage',
      });
    }

    if ((i / 50 + 1) % 20 === 0) {
      console.log(`[wikivoyage]   ${allRows.length} rows collected so far...`);
    }
    await sleep(DELAY_MS);
  }

  console.log(`\n[wikivoyage] Total unique destinations collected: ${allRows.length}`);
  return allRows;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Wikivoyage seeder ===');

  let rows;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[wikivoyage] Loaded ${rows.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    rows = await fetchWikivoyage();
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(rows));
    console.log(`[wikivoyage] Cached ${rows.length} rows to ${CACHE_FILE}`);
  }

  console.log(`\n[wikivoyage] Total: ${rows.length} — upserting...`);
  const result = await upsertUrls(rows, { fetchOg: false, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
