/**
 * seed-substack.js — Substack newsletter seeder
 *
 * Uses the public Substack category API to enumerate top newsletters by category.
 *
 * GET https://substack.com/api/v1/category/public/{category_id}/publications?page={n}
 * Response: { publications: [...] }  — 25 pubs/page, paginate until empty.
 *
 * Each publication: { base_url, subdomain, hostname, name, type, id, ... }
 *
 * Rate limit: 1000ms between requests (polite).
 *
 * Run from repo root:
 *   node scripts/seed-substack.js
 *   node scripts/seed-substack.js --reset   # clear cache and restart
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'substack.json');
const RESET      = process.argv.includes('--reset');

const DELAY_MS = 1000;
const sleep    = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Category → Roam category mapping ─────────────────────────────────────────
// IDs from GET https://substack.com/api/v1/categories
const CATEGORIES = [
  // Technology
  { id: 4,     slug: 'technology',     category: CATEGORY.TECHNOLOGY },
  { id: 118,   slug: 'crypto',         category: CATEGORY.TECHNOLOGY },
  { id: 61,    slug: 'design',         category: CATEGORY.TECHNOLOGY },

  // Science
  { id: 134,   slug: 'science',        category: CATEGORY.SCIENCE },
  { id: 15414, slug: 'climate',        category: CATEGORY.SCIENCE },

  // Arts & Culture
  { id: 96,    slug: 'culture',        category: CATEGORY.ARTS_CULTURE },
  { id: 15417, slug: 'art',            category: CATEGORY.ARTS_CULTURE },
  { id: 11,    slug: 'music',          category: CATEGORY.ARTS_CULTURE },
  { id: 339,   slug: 'literature',     category: CATEGORY.ARTS_CULTURE },
  { id: 284,   slug: 'fiction',        category: CATEGORY.ARTS_CULTURE },
  { id: 387,   slug: 'comics',         category: CATEGORY.ARTS_CULTURE },
  { id: 76782, slug: 'film-and-tv',    category: CATEGORY.ARTS_CULTURE },
  { id: 49692, slug: 'humor',          category: CATEGORY.ARTS_CULTURE },
  { id: 49715, slug: 'fashionandbeauty', category: CATEGORY.ARTS_CULTURE },

  // History & Ideas
  { id: 18,    slug: 'history',        category: CATEGORY.HISTORY_IDEAS },
  { id: 114,   slug: 'philosophy',     category: CATEGORY.HISTORY_IDEAS },
  { id: 34,    slug: 'education',      category: CATEGORY.HISTORY_IDEAS },
  { id: 62,    slug: 'business',       category: CATEGORY.HISTORY_IDEAS },
  { id: 153,   slug: 'finance',        category: CATEGORY.HISTORY_IDEAS },
  { id: 103,   slug: 'news',           category: CATEGORY.HISTORY_IDEAS },
  { id: 76739, slug: 'us-politics',    category: CATEGORY.HISTORY_IDEAS },
  { id: 76740, slug: 'world-politics', category: CATEGORY.HISTORY_IDEAS },

  // People & Places
  { id: 109,   slug: 'travel',         category: CATEGORY.PEOPLE_PLACES },
  { id: 1796,  slug: 'parenting',      category: CATEGORY.PEOPLE_PLACES },
  { id: 13645, slug: 'food',           category: CATEGORY.PEOPLE_PLACES },

  // Games & Hobbies
  { id: 94,    slug: 'sports',         category: CATEGORY.GAMES_HOBBIES },

  // Mind & Body
  { id: 355,   slug: 'health',         category: CATEGORY.MIND_BODY },
  { id: 76741, slug: 'health-politics', category: CATEGORY.MIND_BODY },
  { id: 223,   slug: 'faith',          category: CATEGORY.MIND_BODY },
];

// ── Cache helpers ─────────────────────────────────────────────────────────────
function loadCache() {
  if (RESET && existsSync(CACHE_FILE)) {
    console.log('[substack] Resetting cache...');
    return { done: [] };
  }
  if (existsSync(CACHE_FILE)) {
    return JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
  }
  return { done: [] };
}

function saveCache(state) {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(state, null, 2));
}

// ── Fetch one page of publications for a category ────────────────────────────
async function fetchPage(categoryId, page) {
  const url = `https://substack.com/api/v1/category/public/${categoryId}/publications?page=${page}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Roam-Seeder/1.0 (+https://roamtheweb.app)' },
  });
  if (!res.ok) {
    console.warn(`[substack] HTTP ${res.status} for category ${categoryId} page ${page}`);
    return [];
  }
  const json = await res.json();
  return Array.isArray(json.publications) ? json.publications : [];
}

// ── Main ──────────────────────────────────────────────────────────────────────
const state = loadCache();
let totalInserted = 0;
let totalSkipped  = 0;

for (const cat of CATEGORIES) {
  if (state.done.includes(cat.slug)) {
    console.log(`[substack] Skipping ${cat.slug} (cached)`);
    continue;
  }

  console.log(`\n[substack] Fetching category: ${cat.slug} (id=${cat.id})`);
  let page    = 0;
  let catUrls = 0;

  while (true) {
    const pubs = await fetchPage(cat.id, page);

    if (pubs.length === 0) {
      console.log(`[substack]   Page ${page}: empty — stopping`);
      break;
    }

    const rows = pubs
      .filter((p) => p.base_url)
      .map((p) => ({
        url:         p.base_url,
        title:       p.name || null,
        description: p.hero_text || null,
        category_id: cat.category,
        source:      'substack',
      }));

    if (rows.length > 0) {
      const result = await upsertUrls(rows, { fetchOg: false, verbose: false });
      totalInserted += result.inserted ?? 0;
      totalSkipped  += result.skipped  ?? 0;
      catUrls       += rows.length;
      console.log(`[substack]   Page ${page}: ${rows.length} pubs (${result.inserted ?? 0} new)`);
    }

    page++;
    await sleep(DELAY_MS);
  }

  console.log(`[substack] Done ${cat.slug}: ${catUrls} pubs across ${page} pages`);
  state.done.push(cat.slug);
  saveCache(state);
}

console.log(`\n[substack] Complete — ${totalInserted} inserted, ${totalSkipped} skipped`);
