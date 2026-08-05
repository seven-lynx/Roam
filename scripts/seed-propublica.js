/**
 * seed-propublica.js — ProPublica seeder
 *
 * Pulls investigative journalism articles from ProPublica's sitemap index.
 * Parses the top-level sitemap to discover all year/month sub-sitemaps,
 * then extracts every article URL — covering the full archive back to ~2008.
 *
 * Sitemap index: https://www.propublica.org/sitemap.xml
 * Sub-sitemaps:  listed inside the index with <loc> tags
 *
 * Run from repo root:
 *   node scripts/seed-propublica.js
 *   node scripts/seed-propublica.js --no-cache
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY, SUBCATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'propublica.json');
const NO_CACHE   = process.argv.includes('--no-cache');

// Fetch articles published in the last N calendar days
const DELAY_MS  = 800;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmtEta = (done, total, startMs) => {
  if (done === 0) return '?';
  const s = Math.round(((Date.now() - startMs) / done) * (total - done) / 1000);
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
};

// Max age for articles. Default 730 days (2 years); override with --max-age-days N
const MAX_AGE_DAYS = (() => {
  const i = process.argv.indexOf('--max-age-days');
  return i >= 0 ? Math.max(1, parseInt(process.argv[i + 1], 10)) : 730;
})();
const EARLIEST_YEAR = new Date(Date.now() - MAX_AGE_DAYS * 86_400_000).getFullYear();

const HEADERS = { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)' };

// ── Category detection from article URL slug ──────────────────────────────────
function getCategoryFromUrl(url) {
  const slug = url.toLowerCase();
  if (/environment|climate|energy|epa|pollution|air.quality|water|fossil|oil|gas|pipeline|solar|wildfire|flood|drought|species|endangered/.test(slug)) {
    return CATEGORY.SCIENCE;
  }
  if (/health|medical|hospital|drug|medicine|mental|covid|vaccine|disease|cancer|patient|nursing|medicaid|medicare/.test(slug)) {
    return CATEGORY.MIND_BODY;
  }
  if (/technolog|cyber|data|software|internet|surveillance|algorithm|ai\b|artificial.intelligen|facebook|google|amazon/.test(slug)) {
    return CATEGORY.TECHNOLOGY;
  }
  if (/immigra|border|migrant|refugee|visa|asylum|deport/.test(slug)) {
    return CATEGORY.PEOPLE_PLACES;
  }
  // Default: politics, business, criminal justice, education, etc.
  return CATEGORY.HISTORY_IDEAS;
}

function getSubcategoryFromUrl(url) {
  const slug = url.toLowerCase();
  if (/environment|climate|energy|epa|pollution|air.quality|water|fossil|oil|gas|pipeline|solar|wildfire|flood|drought|species|endangered/.test(slug)) {
    return SUBCATEGORY.ENVIRONMENT_CLIMATE;
  }
  if (/health|medical|hospital|drug|medicine|mental|covid|vaccine|disease|cancer|patient|nursing|medicaid|medicare/.test(slug)) {
    return SUBCATEGORY.NUTRITION_HEALTH;
  }
  if (/technolog|cyber|data|software|internet|surveillance|algorithm|ai\b|artificial.intelligen|facebook|google|amazon/.test(slug)) {
    return SUBCATEGORY.CYBERSECURITY_PRIVACY;
  }
  if (/immigra|border|migrant|refugee|visa|asylum|deport/.test(slug)) {
    return SUBCATEGORY.MIGRATION_DIASPORA;
  }
  return SUBCATEGORY.POLITICS_GEOPOLITICS;
}

// ── Fetch and parse a single sitemap XML ─────────────────────────────────────
async function fetchSitemapUrls(sitemapUrl) {
  let res;
  try {
    res = await fetch(sitemapUrl, { headers: HEADERS });
  } catch (err) {
    return [];
  }
  if (!res.ok) return [];

  const xml = await res.text();
  const urls = [];
  const locRe = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = locRe.exec(xml)) !== null) {
    const u = m[1].trim();
    // Only article pages, not series/topics/about pages
    if (u.includes('/article/')) {
      urls.push(u);
    }
  }
  return urls;
}

// ── Parse sitemap index to get all sub-sitemap URLs ──────────────────────────
async function fetchSitemapIndex() {
  console.log('\n[propublica] Fetching sitemap index...');
  let res;
  try {
    res = await fetch('https://www.propublica.org/sitemap.xml', { headers: HEADERS });
  } catch (err) {
    console.error('[propublica] Failed to fetch sitemap index:', err.message);
    return [];
  }
  if (!res.ok) {
    console.error('[propublica] Sitemap index HTTP', res.status);
    return [];
  }
  const xml = await res.text();

  // Extract <loc> from <sitemap> blocks (not <url> blocks)
  const sitemapRe = /<sitemap>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/sitemap>/g;
  const urls = [];
  let m;
  while ((m = sitemapRe.exec(xml)) !== null) {
    urls.push(m[1].trim());
  }

  // If the index uses flat <loc> (some ProPublica sitemap variants)
  if (urls.length === 0) {
    const locRe = /<loc>([^<]+)<\/loc>/g;
    while ((m = locRe.exec(xml)) !== null) {
      const u = m[1].trim();
      if (u.includes('sitemap') || u.includes('.xml')) urls.push(u);
    }
  }

  console.log(`[propublica] Found ${urls.length} sub-sitemaps`);
  return urls;
}

// ── Build list of day sitemap URLs for last DAYS_BACK days ───────────────────
// (kept as fallback if sitemap index is empty or unreachable)
function getRecentDaySitemaps(daysBack) {
  const urls = [];
  const now  = new Date();
  for (let i = 0; i < daysBack; i++) {
    const d    = new Date(now);
    d.setDate(d.getDate() - i);
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    urls.push(`https://www.propublica.org/sitemap.xml?yyyy=${yyyy}&mm=${mm}&dd=${dd}`);
  }
  return urls;
}

// ── Main fetch routine ────────────────────────────────────────────────────────
async function fetchProPublica() {
  // Try sitemap index first for full all-time coverage
  let sitemapUrls = await fetchSitemapIndex();

  // Fallback: day sitemaps for last MAX_AGE_DAYS days
  if (sitemapUrls.length === 0) {
    console.log(`[propublica] Falling back to day-sitemaps for last ${MAX_AGE_DAYS} days...`);
    sitemapUrls = getRecentDaySitemaps(MAX_AGE_DAYS);
  }

  // Filter out sitemaps from before EARLIEST_YEAR
  const filtered = sitemapUrls.filter((u) => {
    const yearMatch = u.match(/(?:yyyy=|(\d{4})\/\d{2}(?:\/\d{2})?\/)/)
      ?? u.match(/\/sitemap-(\d{4})/)
      ?? u.match(/(\d{4})/); // last-resort: first 4-digit year in URL
    if (!yearMatch) return true; // keep if we can't parse
    const year = parseInt(yearMatch[1] ?? yearMatch[0], 10);
    return isNaN(year) || year >= EARLIEST_YEAR;
  });

  if (filtered.length < sitemapUrls.length) {
    console.log(`[propublica] Filtered ${sitemapUrls.length - filtered.length} sitemaps older than ${EARLIEST_YEAR}`);
  }

  console.log(`\n[propublica] Scanning ${filtered.length} sitemaps...`);

  const seen    = new Set();
  const allRows = [];
  const startMs = Date.now();

  for (let i = 0; i < filtered.length; i++) {
    const sitemapUrl  = filtered[i];
    const articleUrls = await fetchSitemapUrls(sitemapUrl);
    let added = 0;

    for (const url of articleUrls) {
      if (seen.has(url)) continue;
      seen.add(url);
      allRows.push({
        url,
        title:        null,  // filled by OG fetch at upsert time
        description:  null,
        og_image_url: null,
        category_id:   getCategoryFromUrl(url),
        subcategory_id: getSubcategoryFromUrl(url),
        source:        'propublica',
      });
      added++;
    }

    if (added > 0) {
      process.stdout.write(`\r[propublica]   ${i + 1}/${filtered.length} sitemaps  total=${allRows.length}  eta=${fmtEta(i + 1, filtered.length, startMs)}  `);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n\n[propublica] Total unique articles: ${allRows.length}`);
  return allRows;
}

async function main() {
  console.log('=== ProPublica seeder ===');

  let rows;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[propublica] Loaded ${rows.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    rows = await fetchProPublica();
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(rows));
    console.log(`[propublica] Cached ${rows.length} rows to ${CACHE_FILE}`);
  }

  console.log(`\n[propublica] Total: ${rows.length} — upserting (with OG fetch for missing images)...`);
  const result = await upsertUrls(rows, { checkLive: true,  fetchOg: true, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
