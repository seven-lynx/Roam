/**
 * seed-npr.js — NPR seeder
 *
 * Pulls articles from NPR's public RSS feeds.
 * No API key required. All content is freely readable.
 *
 * Feed index: https://www.npr.org/about-npr/178641285/public-radio-satellite-system-feeds
 * NPR topic feeds: https://feeds.npr.org/{topicId}/rss.xml
 *
 * Run from repo root:
 *   node scripts/seed-npr.js
 *   node scripts/seed-npr.js --no-cache
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'npr.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const DELAY_MS = 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmtEta = (done, total, startMs) => {
  if (done === 0) return '?';
  const s = Math.round(((Date.now() - startMs) / done) * (total - done) / 1000);
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
};

// Max age for articles. Default 365 days; override with --max-age-days N
const MAX_AGE_DAYS = (() => {
  const i = process.argv.indexOf('--max-age-days');
  return i >= 0 ? Math.max(1, parseInt(process.argv[i + 1], 10)) : 365;
})();
const cutoffDate = new Date(Date.now() - MAX_AGE_DAYS * 86_400_000);

// ── NPR topic feeds (numeric IDs) → Roam categories ──────────────────────────
// Full topic list: https://www.npr.org/sections/
// Note: feeds that return 404 are gracefully skipped by fetchFeed() below.
const FEEDS = [
  // ── Science ────────────────────────────────────────────────────────────────
  { url: 'https://feeds.npr.org/1007/rss.xml',  label: 'science',           categoryId: CATEGORY.SCIENCE },
  { url: 'https://feeds.npr.org/1057/rss.xml',  label: 'climate',           categoryId: CATEGORY.SCIENCE },
  { url: 'https://feeds.npr.org/1067/rss.xml',  label: 'environment',       categoryId: CATEGORY.SCIENCE },
  { url: 'https://feeds.npr.org/1091/rss.xml',  label: 'goats-soda',        categoryId: CATEGORY.SCIENCE },
  // ── Technology ─────────────────────────────────────────────────────────────
  { url: 'https://feeds.npr.org/1019/rss.xml',  label: 'technology',        categoryId: CATEGORY.TECHNOLOGY },
  { url: 'https://feeds.npr.org/1006/rss.xml',  label: 'business',          categoryId: CATEGORY.TECHNOLOGY },
  { url: 'https://feeds.npr.org/1068/rss.xml',  label: 'economy',           categoryId: CATEGORY.TECHNOLOGY },
  // ── Arts & Culture ─────────────────────────────────────────────────────────
  { url: 'https://feeds.npr.org/1008/rss.xml',  label: 'arts-culture',      categoryId: CATEGORY.ARTS_CULTURE },
  { url: 'https://feeds.npr.org/1045/rss.xml',  label: 'pop-culture',       categoryId: CATEGORY.ARTS_CULTURE },
  { url: 'https://feeds.npr.org/1030/rss.xml',  label: 'books',             categoryId: CATEGORY.ARTS_CULTURE },
  { url: 'https://feeds.npr.org/1025/rss.xml',  label: 'music-features',    categoryId: CATEGORY.ARTS_CULTURE },
  { url: 'https://feeds.npr.org/1004/rss.xml',  label: 'movies',            categoryId: CATEGORY.ARTS_CULTURE },
  { url: 'https://feeds.npr.org/1044/rss.xml',  label: 'arts-life',         categoryId: CATEGORY.ARTS_CULTURE },
  { url: 'https://feeds.npr.org/1032/rss.xml',  label: 'national',          categoryId: CATEGORY.ARTS_CULTURE },
  // ── History & Ideas ────────────────────────────────────────────────────────
  { url: 'https://feeds.npr.org/1003/rss.xml',  label: 'politics',          categoryId: CATEGORY.HISTORY_IDEAS },
  { url: 'https://feeds.npr.org/1016/rss.xml',  label: 'world',             categoryId: CATEGORY.HISTORY_IDEAS },
  { url: 'https://feeds.npr.org/1018/rss.xml',  label: 'history',           categoryId: CATEGORY.HISTORY_IDEAS },
  { url: 'https://feeds.npr.org/1049/rss.xml',  label: 'investigations',    categoryId: CATEGORY.HISTORY_IDEAS },
  { url: 'https://feeds.npr.org/1014/rss.xml',  label: 'law',               categoryId: CATEGORY.HISTORY_IDEAS },
  // ── Mind & Body ────────────────────────────────────────────────────────────
  { url: 'https://feeds.npr.org/1026/rss.xml',  label: 'life-kit',          categoryId: CATEGORY.MIND_BODY },
  { url: 'https://feeds.npr.org/1042/rss.xml',  label: 'shots-health',      categoryId: CATEGORY.MIND_BODY },
  { url: 'https://feeds.npr.org/1050/rss.xml',  label: 'mental-health',     categoryId: CATEGORY.MIND_BODY },
  // ── People & Places ────────────────────────────────────────────────────────
  { url: 'https://feeds.npr.org/1017/rss.xml',  label: 'race',              categoryId: CATEGORY.PEOPLE_PLACES },
  { url: 'https://feeds.npr.org/1015/rss.xml',  label: 'education',         categoryId: CATEGORY.PEOPLE_PLACES },
  { url: 'https://feeds.npr.org/1022/rss.xml',  label: 'religion',          categoryId: CATEGORY.PEOPLE_PLACES },
  { url: 'https://feeds.npr.org/1040/rss.xml',  label: 'identity',          categoryId: CATEGORY.PEOPLE_PLACES },
  { url: 'https://feeds.npr.org/1085/rss.xml',  label: 'immigration',       categoryId: CATEGORY.PEOPLE_PLACES },
  // ── Games & Hobbies ────────────────────────────────────────────────────────
  { url: 'https://feeds.npr.org/1048/rss.xml',  label: 'food',              categoryId: CATEGORY.GAMES_HOBBIES },
  { url: 'https://feeds.npr.org/1046/rss.xml',  label: 'sports',            categoryId: CATEGORY.GAMES_HOBBIES },
  { url: 'https://feeds.npr.org/1013/rss.xml',  label: 'travel',            categoryId: CATEGORY.GAMES_HOBBIES },
  // ── Weird & Wonderful ──────────────────────────────────────────────────────
  { url: 'https://feeds.npr.org/2/rss.xml',     label: 'top-stories',       categoryId: CATEGORY.WEIRD_WONDERFUL },
  { url: 'https://feeds.npr.org/1038/rss.xml',  label: 'picture-show',      categoryId: CATEGORY.WEIRD_WONDERFUL },
  { url: 'https://feeds.npr.org/1092/rss.xml',  label: 'money',             categoryId: CATEGORY.WEIRD_WONDERFUL },
];

// ── Simple RSS parser (shared pattern with ProPublica seeder) ─────────────────
function parseRSS(xml) {
  const items = [];
  const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi;

  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];

    const linkMatch = block.match(/<link[^>]*>([^<]+)<\/link>/i)
      ?? block.match(/<link[^>]+href="([^"]+)"/i);
    const titleMatch = block.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i)
      ?? block.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch = block.match(/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i)
      ?? block.match(/<description[^>]*>([^<]*)<\/description>/i);
    const imgMatch = block.match(/<media:content[^>]+url="([^"]+)"/i)
      ?? block.match(/<media:thumbnail[^>]+url="([^"]+)"/i)
      ?? block.match(/<enclosure[^>]+url="([^"]+)"/i);
    const pubDateMatch = block.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/i);

    const url = linkMatch ? linkMatch[1].trim() : null;
    if (!url || !url.startsWith('http')) continue;

    // Filter by age before any other processing
    if (pubDateMatch) {
      const pubDate = new Date(pubDateMatch[1].trim());
      if (!isNaN(pubDate.getTime()) && pubDate < cutoffDate) continue;
    }

    // Skip non-article NPR URLs (station pages, programme homepages, etc.)
    if (!url.includes('npr.org') || url.match(/npr\.org\/(sections|programs|series|podcasts)\/[^/]+\/?$/)) continue;

    const title = titleMatch
      ? titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
      : null;

    const rawDesc = descMatch ? descMatch[1] : null;
    const description = rawDesc
      ? rawDesc.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim().slice(0, 500)
      : null;

    const ogImage = imgMatch ? imgMatch[1].trim() : null;

    items.push({ url, title, description, ogImage });
  }

  return items;
}

// ── Fetch one RSS feed ────────────────────────────────────────────────────────
async function fetchFeed(feedUrl, label, categoryId) {
  let res;
  try {
    res = await fetch(feedUrl, {
      headers: { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)' },
    });
  } catch (err) {
    console.warn(`[npr]   ${label}: ${err.message}`);
    return [];
  }

  if (!res.ok) {
    console.warn(`[npr]   ${label}: HTTP ${res.status}`);
    return [];
  }

  const xml   = await res.text();
  const items = parseRSS(xml);

  return items.map((item) => ({
    url:          item.url,
    title:        item.title,
    description:  item.description,
    og_image_url: item.ogImage,
    category_id:  categoryId,
    source:       'npr',
  }));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function fetchNPR() {
  console.log(`\n[npr] Fetching ${FEEDS.length} RSS feeds...`);
  const allRows = [];
  const seen    = new Set();
  const startMs = Date.now();
  let feedIdx   = 0;

  for (const { url: feedUrl, label, categoryId } of FEEDS) {
    const rows = await fetchFeed(feedUrl, label, categoryId);
    let added = 0;

    for (const row of rows) {
      if (!row.url || seen.has(row.url)) continue;
      seen.add(row.url);
      allRows.push(row);
      added++;
    }

    feedIdx++;
    console.log(`[npr]   ${feedIdx}/${FEEDS.length}  ${label}: ${added} articles  (total=${allRows.length}, eta=${fmtEta(feedIdx, FEEDS.length, startMs)})`);
    await sleep(DELAY_MS);
  }

  console.log(`\n[npr] Total unique articles: ${allRows.length}`);
  return allRows;
}

async function main() {
  console.log('=== NPR seeder ===');

  let rows;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[npr] Loaded ${rows.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    rows = await fetchNPR();
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(rows));
    console.log(`[npr] Cached ${rows.length} rows to ${CACHE_FILE}`);
  }

  console.log(`\n[npr] Total: ${rows.length} — upserting (with OG fetch for missing images)...`);
  const result = await upsertUrls(rows, { checkLive: true,  fetchOg: true, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
