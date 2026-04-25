/**
 * seed-propublica.js — ProPublica seeder
 *
 * Pulls investigative journalism articles from ProPublica's sitemap index.
 * ProPublica only has one public RSS feed (main); topic feeds were removed.
 * Instead, we crawl the per-day XML sitemaps for recent articles.
 *
 * Sitemap index: https://www.propublica.org/sitemap.xml
 * Day sitemaps:  https://www.propublica.org/sitemap.xml?yyyy=YYYY&mm=MM&dd=DD
 *
 * Run from repo root:
 *   node scripts/seed-propublica.js
 *   node scripts/seed-propublica.js --no-cache
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'propublica.json');
const NO_CACHE   = process.argv.includes('--no-cache');

// Fetch articles published in the last N calendar days
const DAYS_BACK = 90;
const DELAY_MS  = 800;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// ── Build list of day sitemap URLs for last DAYS_BACK days ───────────────────
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
  const daySitemaps = getRecentDaySitemaps(DAYS_BACK);
  console.log(`\n[propublica] Scanning ${daySitemaps.length} daily sitemaps (last ${DAYS_BACK} days)...`);

  const seen    = new Set();
  const allRows = [];

  for (const sitemapUrl of daySitemaps) {
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
        category_id:  getCategoryFromUrl(url),
        source:       'propublica',
      });
      added++;
    }

    if (added > 0) {
      const dateStr = sitemapUrl.split('?')[1];
      console.log(`[propublica]   ${dateStr}: ${added} articles`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n[propublica] Total unique articles: ${allRows.length}`);
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
  const result = await upsertUrls(rows, { fetchOg: true, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
