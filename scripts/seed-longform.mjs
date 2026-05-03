/**
 * seed-longform.mjs — Long-form essay & science publications seeder
 *
 * Pulls articles from RSS feeds of high-quality independent publications:
 *   • Aeon (aeon.co)       — philosophy, science, culture essays
 *   • Nautilus (nautil.us) — science & ideas
 *   • Longreads            — curated long-form non-fiction
 *   • Psyche (psyche.co)   — mind, philosophy, mental health (Aeon partner)
 *   • The Conversation     — academic-authored explainers
 *   • Quanta Magazine      — mathematics & science
 *   • Lapham's Quarterly   — history in primary sources
 *   • Literary Hub         — books, writing, culture
 *   • Brain Pickings (The Marginalian) — cross-disciplinary essays
 *
 * No API key required. All content freely readable.
 *
 * Run from repo root:
 *   node scripts/seed-longform.mjs
 *   node scripts/seed-longform.mjs --no-cache
 *   node scripts/seed-longform.mjs --max-age-days 180
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { config as dotenvConfig } from 'dotenv';
import { upsertUrls, CATEGORY, fetchWithRetry } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../.env') });

const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'longform.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const maxAgeIdx  = process.argv.indexOf('--max-age-days');
const MAX_AGE_DAYS = maxAgeIdx >= 0 ? Math.max(1, parseInt(process.argv[maxAgeIdx + 1], 10)) : 730;
const cutoffDate = new Date(Date.now() - MAX_AGE_DAYS * 86_400_000);

const DELAY_MS = 1500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Feed definitions ──────────────────────────────────────────────────────────
const FEEDS = [
  // ── Science ──────────────────────────────────────────────────────────────
  { url: 'https://nautil.us/feed/',                                   label: 'nautilus',       categoryId: CATEGORY.SCIENCE },
  { url: 'https://www.quantamagazine.org/feed/',                      label: 'quanta',         categoryId: CATEGORY.SCIENCE },
  { url: 'https://theconversation.com/us/science/feed',              label: 'conversation-science',    categoryId: CATEGORY.SCIENCE },
  { url: 'https://theconversation.com/us/environment/feed',           label: 'conversation-env',         categoryId: CATEGORY.SCIENCE },

  // ── History & Ideas ───────────────────────────────────────────────────────
  { url: 'https://aeon.co/feed.rss',                                  label: 'aeon',           categoryId: CATEGORY.HISTORY_IDEAS },
  { url: 'https://www.laphamsquarterly.org/rss.xml',                  label: 'laphams',        categoryId: CATEGORY.HISTORY_IDEAS },
  { url: 'https://theconversation.com/us/arts/feed',                  label: 'conversation-arts',       categoryId: CATEGORY.HISTORY_IDEAS },
  { url: 'https://theconversation.com/us/politics/feed',              label: 'conversation-politics',    categoryId: CATEGORY.HISTORY_IDEAS },

  // ── Mind & Body ───────────────────────────────────────────────────────────
  { url: 'https://psyche.co/feed',                                    label: 'psyche',         categoryId: CATEGORY.MIND_BODY },
  { url: 'https://theconversation.com/us/health/feed',               label: 'conversation-health',     categoryId: CATEGORY.MIND_BODY },

  // ── Arts & Culture ────────────────────────────────────────────────────────
  { url: 'https://lithub.com/feed/',                                  label: 'lithub',         categoryId: CATEGORY.ARTS_CULTURE },
  { url: 'https://www.themarginalian.org/feed/',                      label: 'marginalian',    categoryId: CATEGORY.ARTS_CULTURE },

  // ── Weird & Wonderful ─────────────────────────────────────────────────────
  { url: 'https://longreads.com/feed/',                               label: 'longreads',      categoryId: CATEGORY.WEIRD_WONDERFUL },
  { url: 'https://theconversation.com/us/arts-humanities/feed',      label: 'conversation-humanities', categoryId: CATEGORY.WEIRD_WONDERFUL },
];

// ── RSS parser ────────────────────────────────────────────────────────────────
function parseRSS(xml, label) {
  const items = [];
  const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let m;

  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];

    const linkMatch  = block.match(/<link[^>]*>([^<]+)<\/link>/i)
      ?? block.match(/<link[^>]+href="([^"]+)"/i);
    const titleMatch = block.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i)
      ?? block.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch  = block.match(/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i)
      ?? block.match(/<description[^>]*>([^<]*)<\/description>/i);
    const imgMatch   = block.match(/<media:content[^>]+url="([^"]+)"/i)
      ?? block.match(/<media:thumbnail[^>]+url="([^"]+)"/i)
      ?? block.match(/<enclosure[^>]+url="([^"]+)"/i);
    const pubDateMatch = block.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/i);

    const url = linkMatch?.[1]?.trim();
    if (!url || !url.startsWith('http')) continue;

    // Age filter
    if (pubDateMatch) {
      const pubDate = new Date(pubDateMatch[1].trim());
      if (!isNaN(pubDate.getTime()) && pubDate < cutoffDate) continue;
    }

    const title = titleMatch
      ? titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, '').trim()
      : null;

    const rawDesc = descMatch?.[1] ?? null;
    const description = rawDesc
      ? rawDesc.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ').trim().slice(0, 500)
      : null;

    const ogImage = imgMatch?.[1]?.trim() ?? null;
    const pubDate = pubDateMatch
      ? (() => { const d = new Date(pubDateMatch[1].trim()); return isNaN(d.getTime()) ? null : d.toISOString(); })()
      : null;

    items.push({ url, title, description, ogImage, pubDate });
  }

  return items;
}

// ── Fetch one RSS feed ────────────────────────────────────────────────────────
async function fetchFeed({ url: feedUrl, label, categoryId }) {
  let res;
  try {
    res = await fetchWithRetry(feedUrl, {
      headers: { 'User-Agent': 'Roam-Seeder/1.0 (+https://roamtheweb.app)' },
    });
  } catch (err) {
    console.warn(`[longform]   ${label}: ${err.message}`);
    return [];
  }

  if (!res.ok) {
    console.warn(`[longform]   ${label}: HTTP ${res.status}`);
    return [];
  }

  const xml   = await res.text();
  const items = parseRSS(xml, label);

  console.log(`[longform]   ${label}: ${items.length} articles`);

  return items.map((item) => ({
    url:          item.url,
    title:        item.title,
    description:  item.description,
    og_image_url: item.ogImage,
    category_id:  categoryId,
    source:       'longform',
    published_at: item.pubDate ?? null,
  }));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Long-form publications seeder ===');
  console.log(`    Max age: ${MAX_AGE_DAYS} days`);
  console.log(`    Feeds:   ${FEEDS.length}\n`);

  let all;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    all = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[longform] Loaded ${all.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    all = [];
    const seen = new Set();

    for (const feed of FEEDS) {
      const rows = await fetchFeed(feed);
      for (const row of rows) {
        if (!seen.has(row.url)) {
          seen.add(row.url);
          all.push(row);
        }
      }
      await sleep(DELAY_MS);
    }

    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(all));
    console.log(`\n[longform] Cached ${all.length} rows → ${CACHE_FILE}`);
  }

  console.log(`\n[longform] Total: ${all.length} — upserting...`);
  const result = await upsertUrls(all, { fetchOg: true, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
