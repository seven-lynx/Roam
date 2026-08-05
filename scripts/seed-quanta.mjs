/**
 * seed-quanta.mjs — Quanta Magazine seeder
 *
 * Pulls all articles from Quanta Magazine via their WordPress JSON API.
 * Quanta covers math, physics, biology, and computer science — all freely
 * readable, no paywall.
 *
 * No API key required.
 *
 * Run from repo root:
 *   node scripts/seed-quanta.mjs
 *   node scripts/seed-quanta.mjs --no-cache
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY, SUBCATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'quanta.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const BASE_URL  = 'https://www.quantamagazine.org/wp-json/wp/v2/posts';
const PER_PAGE  = 100;
const DELAY_MS  = 500;
const FIELDS    = 'id,date,link,title,excerpt,categories';

// Quanta category IDs → Roam subcategory
const CAT_MAP = {
  188: { category_id: CATEGORY.SCIENCE,    subcategory_id: SUBCATEGORY.MATHEMATICS_LOGIC },
  189: { category_id: CATEGORY.SCIENCE,    subcategory_id: SUBCATEGORY.PHYSICS_CHEMISTRY },
  191: { category_id: CATEGORY.SCIENCE,    subcategory_id: SUBCATEGORY.BIOLOGY_EVOLUTION },
  190: { category_id: CATEGORY.TECHNOLOGY, subcategory_id: SUBCATEGORY.AI_MACHINE_LEARNING },
  31655: { category_id: CATEGORY.SCIENCE,  subcategory_id: SUBCATEGORY.ENVIRONMENT_CLIMATE },
  // abstractions (619), science-news (17), qa (176) — use physics as fallback
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, '\u2019')
    .replace(/&#8216;/g, '\u2018')
    .replace(/&#8220;/g, '\u201c')
    .replace(/&#8221;/g, '\u201d')
    .replace(/&#8230;/g, '\u2026')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapPost(post) {
  const url = post.link;
  if (!url) return null;

  const title = stripHtml(post.title?.rendered ?? '');
  if (!title) return null;

  const excerpt = stripHtml(post.excerpt?.rendered ?? '');
  const description = excerpt || null;

  // Pick the most specific Roam category from the post's category list
  const cats = post.categories ?? [];
  let mapping = null;
  for (const catId of cats) {
    if (CAT_MAP[catId]) { mapping = CAT_MAP[catId]; break; }
  }
  // Default: physics/chemistry covers general science
  if (!mapping) mapping = { category_id: CATEGORY.SCIENCE, subcategory_id: SUBCATEGORY.PHYSICS_CHEMISTRY };

  return {
    url,
    title,
    description,
    category_id:    mapping.category_id,
    subcategory_id: mapping.subcategory_id,
    source: 'quanta',
  };
}

// ── Fetch one page ────────────────────────────────────────────────────────────
async function fetchPage(page) {
  const params = new URLSearchParams({ per_page: PER_PAGE, page, _fields: FIELDS });
  const res = await fetch(`${BASE_URL}?${params}`, {
    headers: { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on page ${page}`);
  const totalPages = parseInt(res.headers.get('x-wp-totalpages') ?? '1', 10);
  const posts = await res.json();
  return { posts, totalPages };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Quanta Magazine seeder ===');

  let rows;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[quanta] Loaded ${rows.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    const allPosts = [];
    let page = 1;
    let totalPages = 1;

    do {
      const result = await fetchPage(page);
      totalPages = result.totalPages;
      allPosts.push(...result.posts);
      process.stdout.write(`\r[quanta] page ${page}/${totalPages}  (${allPosts.length} posts)`);
      page++;
      if (page <= totalPages) await sleep(DELAY_MS);
    } while (page <= totalPages);

    console.log('');

    rows = allPosts.map(mapPost).filter(Boolean);
    console.log(`[quanta] Mapped: ${rows.length} rows`);

    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(rows));
    console.log(`[quanta] Cached to ${CACHE_FILE}`);
  }

  console.log(`\n[quanta] Total: ${rows.length} — upserting...`);
  const result = await upsertUrls(rows, { checkLive: true,  fetchOg: false, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
