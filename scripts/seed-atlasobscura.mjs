/**
 * seed-atlasobscura.mjs — Atlas Obscura seeder
 *
 * Atlas Obscura is a guide to the world's hidden wonders, unusual places,
 * curious foods, and strange phenomena. Pulls from their XML sitemaps to
 * collect the full archive of places, articles, and foods. Titles are derived
 * from URL slugs; OG images and descriptions can be backfilled later with
 * backfill-og-metadata.mjs.
 *
 * No API key required.
 *
 * Run from repo root:
 *   node scripts/seed-atlasobscura.mjs
 *   node scripts/seed-atlasobscura.mjs --no-cache
 *   node scripts/seed-atlasobscura.mjs --max-sitemap 5000
 *
 * Source labels written to DB:
 *   atlas-obscura-places   → People & Places
 *   atlas-obscura-articles → Weird & Wonderful
 *   atlas-obscura-foods    → Games & Hobbies
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { gunzipSync } from 'zlib';
import { config as dotenvConfig } from 'dotenv';
import { upsertUrls, CATEGORY, SUBCATEGORY, fetchWithRetry } from './lib/seed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../.env') });

const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'atlasobscura.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const maxSitemapIdx = process.argv.indexOf('--max-sitemap');
const MAX_SITEMAP   = maxSitemapIdx >= 0
  ? Math.max(1, parseInt(process.argv[maxSitemapIdx + 1], 10))
  : 30_000;

const DELAY_MS = 1000;
const sleep    = (ms) => new Promise((r) => setTimeout(r, ms));

// ── URL → category mapping ────────────────────────────────────────────────────
const CONTENT_TYPES = [
  {
    pattern:    /\/places\//,
    categoryId:    CATEGORY.PEOPLE_PLACES,
    subcategoryId: SUBCATEGORY.UNUSUAL_PLACES,
    source:     'atlas-obscura-places',
  },
  {
    pattern:    /\/articles\//,
    categoryId:    CATEGORY.WEIRD_WONDERFUL,
    subcategoryId: SUBCATEGORY.ODDITIES_CURIOSITIES,
    source:     'atlas-obscura-articles',
  },
  {
    pattern:    /\/foods\//,
    categoryId:    CATEGORY.GAMES_HOBBIES,
    subcategoryId: SUBCATEGORY.COOKING_FOOD,
    source:     'atlas-obscura-foods',
  },
];

function categorise(url) {
  for (const def of CONTENT_TYPES) {
    if (def.pattern.test(url)) return def;
  }
  return null;
}

// ── Slug → readable title ─────────────────────────────────────────────────────
const ARTICLES = new Set(['a', 'an', 'the']);
const PREPS    = new Set(['at', 'by', 'for', 'in', 'of', 'on', 'to', 'up', 'via', 'with', 'and', 'but', 'or', 'nor']);

function slugToTitle(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word, i) => {
      const lc = word.toLowerCase();
      if (i > 0 && (ARTICLES.has(lc) || PREPS.has(lc))) return lc;
      return lc.charAt(0).toUpperCase() + lc.slice(1);
    })
    .join(' ');
}

function urlToTitle(url) {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    const slug  = parts[parts.length - 1] ?? '';
    const title = slugToTitle(slug);
    return title.length >= 3 ? title : null;
  } catch {
    return null;
  }
}

// ── XML helpers ───────────────────────────────────────────────────────────────
function parseSitemapUrls(xml) {
  const urls = [];
  // Match both <loc> inside <url> elements and bare <loc> in sitemapindex
  const re = /<loc[^>]*>\s*(https?:\/\/[^\s<]+)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    urls.push(m[1].trim());
  }
  return urls;
}

function isSitemapIndex(xml) {
  return /<sitemapindex[\s>]/i.test(xml);
}

async function fetchXml(url) {
  try {
    const res = await fetchWithRetry(
      url,
      { headers: { 'User-Agent': 'Roam-Seeder/1.0 (+https://roamtheweb.app)', Accept: 'application/xml, text/xml, application/x-gzip, */*' } },
      { retries: 3, base: 2000 },
    );
    if (!res.ok) {
      console.warn(`[atlasobscura] HTTP ${res.status} → ${url}`);
      return null;
    }
    if (url.endsWith('.gz')) {
      const buf = Buffer.from(await res.arrayBuffer());
      return gunzipSync(buf).toString('utf8');
    }
    return await res.text();
  } catch (err) {
    console.warn(`[atlasobscura] Fetch error for ${url}: ${err.message}`);
    return null;
  }
}

/** Read robots.txt and return the Sitemap directive URL, if present. */
async function findSitemapFromRobots(baseUrl) {
  try {
    const res = await fetchWithRetry(
      `${baseUrl}/robots.txt`,
      { headers: { 'User-Agent': 'Roam-Seeder/1.0 (+https://roamtheweb.app)' } },
      { retries: 2, base: 1000 },
    );
    if (!res.ok) return null;
    const text = await res.text();
    const m = text.match(/^Sitemap:\s*(https?:\/\/\S+)/im);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

// ── Sitemap crawler ───────────────────────────────────────────────────────────
async function collectFromSitemaps() {
  const rows = [];
  const seen = new Set();

  const BASE = 'https://www.atlasobscura.com';

  // 1. Try robots.txt first
  console.log('[atlasobscura] Checking robots.txt for Sitemap directive...');
  const robotsSitemap = await findSitemapFromRobots(BASE);

  const ROOT_CANDIDATES = [
    robotsSitemap,
    `${BASE}/sitemaps/sitemap_index.xml.gz`,
    `${BASE}/sitemaps/sitemap_index.xml`,
    `${BASE}/sitemap_index.xml`,
    `${BASE}/sitemap.xml`,
  ].filter(Boolean);

  let childSitemaps = [];

  for (const rootUrl of ROOT_CANDIDATES) {
    console.log(`[atlasobscura] Fetching sitemap index: ${rootUrl}`);
    const xml = await fetchXml(rootUrl);
    if (!xml) continue;

    if (isSitemapIndex(xml)) {
      const locs = parseSitemapUrls(xml);
      // Prefer content-type sitemaps; fall back to all
      const contentSitemaps = locs.filter((u) =>
        /places|articles|foods|wonder|content/i.test(u),
      );
      childSitemaps = contentSitemaps.length > 0 ? contentSitemaps : locs;
      console.log(`[atlasobscura] Found ${childSitemaps.length} child sitemaps`);
      break;
    } else {
      // The root URL is itself a sitemap — treat it as a single child
      childSitemaps = [rootUrl];
      console.log('[atlasobscura] Root URL is a direct sitemap (not an index)');
      break;
    }
  }

  if (childSitemaps.length === 0) {
    console.warn('[atlasobscura] No sitemaps found — nothing to crawl');
    return rows;
  }

  for (let si = 0; si < childSitemaps.length; si++) {
    if (rows.length >= MAX_SITEMAP) break;

    const sitemapUrl = childSitemaps[si];
    console.log(`[atlasobscura] Sitemap ${si + 1}/${childSitemaps.length}: ${sitemapUrl}`);
    await sleep(DELAY_MS);

    const xml = await fetchXml(sitemapUrl);
    if (!xml) continue;

    // A child sitemap may itself be an index (nested pagination)
    if (isSitemapIndex(xml)) {
      const nested = parseSitemapUrls(xml);
      childSitemaps.push(...nested.filter((u) => !childSitemaps.includes(u)));
      console.log(`[atlasobscura]   → nested index, added ${nested.length} more sitemaps`);
      continue;
    }

    const urls = parseSitemapUrls(xml);
    let added = 0;
    for (const url of urls) {
      if (rows.length >= MAX_SITEMAP) break;
      if (seen.has(url)) continue;
      seen.add(url);

      const cat   = categorise(url);
      if (!cat) continue;

      const title = urlToTitle(url);
      if (!title) continue;

      rows.push({
        url,
        title,
        category_id:    cat.categoryId,
        subcategory_id: cat.subcategoryId,
        source:         cat.source,
      });
      added++;
    }

    console.log(`[atlasobscura]   +${added} rows → total ${rows.length}`);
  }

  return rows;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });

  let rows;

  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    console.log('[atlasobscura] Loading from cache...');
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[atlasobscura] ${rows.length} rows loaded from cache`);
  } else {
    rows = await collectFromSitemaps();

    if (rows.length === 0) {
      console.log('[atlasobscura] No rows collected — nothing to upsert.');
      return;
    }

    writeFileSync(CACHE_FILE, JSON.stringify(rows, null, 2));
    console.log(`[atlasobscura] Cache saved → ${CACHE_FILE} (${rows.length} rows)`);
  }

  // Log breakdown by source
  const bySource = {};
  for (const r of rows) {
    bySource[r.source] = (bySource[r.source] ?? 0) + 1;
  }
  for (const [src, count] of Object.entries(bySource)) {
    console.log(`[atlasobscura]   ${src}: ${count}`);
  }

  console.log(`[atlasobscura] Upserting ${rows.length} rows (fetchOg=false — run backfill-og-metadata.mjs later for images)`);

  const result = await upsertUrls(rows, {
    fetchOg:  false,
    verbose:  true,
  });

  console.log(
    `[atlasobscura] Done. Inserted: ${result?.inserted ?? '?'}, Skipped: ${result?.skipped ?? '?'}`,
  );
}

main().catch((err) => {
  console.error('[atlasobscura] Fatal error:', err);
  process.exit(1);
});
