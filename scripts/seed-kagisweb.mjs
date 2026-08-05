/**
 * seed-kagisweb.mjs — Kagi Small Web seeder
 *
 * Kagi Small Web is a curated collection of indie/personal web pages maintained
 * by Kagi Search. It prizes non-commercial, human-written content — exactly
 * aligned with Roam's ethos.
 *
 * Data sources (in order of preference):
 *  1. Kagi Small Web recent feed  (https://kagi.com/api/smallweb/feed.json)
 *  2. GitHub data dump            (https://raw.githubusercontent.com/kagisearch/smallweb/main/data/smallweb.csv)
 *
 * No API key required.
 *
 * Run from repo root:
 *   node scripts/seed-kagisweb.mjs
 *   node scripts/seed-kagisweb.mjs --no-cache
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'kagisweb.json');
const NO_CACHE   = process.argv.includes('--no-cache');
const DELAY_MS   = 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HEADERS = { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)' };

// ── Keyword → Roam category mapping ──────────────────────────────────────────
const KEYWORD_CATEGORY = [
  { keywords: ['science', 'physics', 'math', 'chemistry', 'biology', 'astronomy', 'ecology'], cat: CATEGORY.SCIENCE },
  { keywords: ['programming', 'software', 'linux', 'tech', 'computer', 'code', 'dev', 'web'], cat: CATEGORY.TECHNOLOGY },
  { keywords: ['art', 'music', 'photo', 'film', 'book', 'literature', 'poetry', 'design', 'culture'], cat: CATEGORY.ARTS_CULTURE },
  { keywords: ['history', 'philosophy', 'politics', 'economics', 'society', 'ideas'], cat: CATEGORY.HISTORY_IDEAS },
  { keywords: ['game', 'cook', 'food', 'garden', 'hobby', 'craft', 'sport'], cat: CATEGORY.GAMES_HOBBIES },
  { keywords: ['health', 'mind', 'mental', 'fitness', 'wellbeing', 'body', 'meditat'], cat: CATEGORY.MIND_BODY },
  { keywords: ['travel', 'place', 'geography', 'people', 'community', 'local'], cat: CATEGORY.PEOPLE_PLACES },
];

function inferCategoryFromText(text) {
  if (!text) return CATEGORY.WEIRD_WONDERFUL;
  const lower = text.toLowerCase();
  for (const { keywords, cat } of KEYWORD_CATEGORY) {
    if (keywords.some((kw) => lower.includes(kw))) return cat;
  }
  return CATEGORY.WEIRD_WONDERFUL;
}

// ── Source 1: Kagi Small Web JSON feed ───────────────────────────────────────
// The feed returns recent indie web articles Kagi has discovered
async function fetchKagiFeed() {
  const FEED_URLS = [
    'https://kagi.com/api/smallweb/feed.json',
    'https://kagi.com/smallweb/feed.json',
  ];

  for (const url of FEED_URLS) {
    let res;
    try {
      res = await fetch(url, { headers: HEADERS });
    } catch { continue; }

    if (!res.ok) continue;

    let data;
    try { data = await res.json(); } catch { continue; }

    // JSON Feed format: { items: [{ url, title, content_text, ... }] }
    const items = data?.items ?? (Array.isArray(data) ? data : []);
    if (items.length === 0) continue;

    console.log(`[kagisweb] Feed: ${items.length} items from ${url}`);
    return items.map((item) => {
      const text = [item.title, item.content_text, item.summary].filter(Boolean).join(' ');
      return {
        url:         item.url ?? item.id,
        title:       item.title ?? null,
        description: item.content_text?.slice(0, 500) ?? item.summary?.slice(0, 500) ?? null,
        og_image_url: item.image ?? null,
        category_id: inferCategoryFromText(text),
        source:      'kagisweb',
      };
    }).filter((r) => r.url?.startsWith('http'));
  }

  return [];
}

// ── Source 2: Kagi Small Web Atom/RSS feed ───────────────────────────────────
async function fetchKagiRSS() {
  const RSS_URLS = [
    'https://kagi.com/api/v1/smallweb/feed',  // Atom feed (current)
    'https://kagi.com/rss/smallweb.xml',
    'https://kagi.com/api/smallweb/rss',
  ];

  for (const url of RSS_URLS) {
    let res;
    try {
      res = await fetch(url, { headers: HEADERS });
    } catch { continue; }

    if (!res.ok) continue;
    const xml = await res.text();

    const items = [];

    // Atom format (<entry> with <link href="..."> and <summary>)
    const entryRe = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
    let m;
    while ((m = entryRe.exec(xml)) !== null) {
      const block = m[1];
      const linkM  = block.match(/<link[^>]+href="([^"]+)"/i);
      const titleM = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      const descM  = block.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i);
      if (!linkM) continue;
      const itemUrl = linkM[1].trim();
      if (!itemUrl.startsWith('http')) continue;
      const title   = titleM ? titleM[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]+>/g, '').trim() : null;
      const rawDesc = descM ? descM[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#34;/g, '"').trim().slice(0, 500) : null;
      items.push({
        url: itemUrl, title, description: rawDesc, og_image_url: null,
        category_id: inferCategoryFromText(`${title} ${rawDesc}`),
        source: 'kagisweb',
      });
    }

    // RSS format (<item> with <link> and <description>)
    if (items.length === 0) {
      const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi;
      while ((m = itemRe.exec(xml)) !== null) {
        const block = m[1];
        const linkM  = block.match(/<link[^>]*>([^<]+)<\/link>/i);
        const titleM = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
        const descM  = block.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
        if (!linkM) continue;
        const itemUrl  = linkM[1].trim();
        if (!itemUrl.startsWith('http')) continue;
        const title    = titleM ? titleM[1].replace(/<[^>]+>/g, '').trim() : null;
        const rawDesc  = descM ? descM[1].replace(/<[^>]+>/g, '').trim().slice(0, 500) : null;
        items.push({
          url: itemUrl, title, description: rawDesc, og_image_url: null,
          category_id: inferCategoryFromText(`${title} ${rawDesc}`),
          source: 'kagisweb',
        });
      }
    }

    if (items.length > 0) {
      console.log(`[kagisweb] Feed: ${items.length} items from ${url}`);
      return items;
    }
  }

  return [];
}

// ── Source 3: GitHub CSV data dump ───────────────────────────────────────────
async function fetchGitHubDump() {
  const CSV_URLS = [
    'https://raw.githubusercontent.com/kagisearch/smallweb/main/data/smallweb.csv',
    'https://raw.githubusercontent.com/kagisearch/smallweb/main/smallweb.csv',
  ];

  for (const url of CSV_URLS) {
    let res;
    try {
      res = await fetch(url, { headers: HEADERS });
    } catch { continue; }

    if (!res.ok) continue;
    const csv = await res.text();
    const lines = csv.split('\n').filter(Boolean);
    if (lines.length < 2) continue;

    // Detect header
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));
    const urlIdx  = header.indexOf('url');
    const titleIdx = header.indexOf('title');
    const descIdx  = header.indexOf('description') >= 0 ? header.indexOf('description') : header.indexOf('desc');
    if (urlIdx < 0) continue;

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      // Simple CSV split (handles basic quoting)
      const cols = lines[i].match(/("(?:[^"]|"")*"|[^,]*)/g)?.map((v) => v.replace(/^"|"$/g, '').replace(/""/g, '"').trim()) ?? [];
      const rowUrl = cols[urlIdx];
      if (!rowUrl || !rowUrl.startsWith('http')) continue;
      const title = titleIdx >= 0 ? cols[titleIdx] ?? null : null;
      const desc  = descIdx  >= 0 ? cols[descIdx]?.slice(0, 500) ?? null : null;
      rows.push({
        url: rowUrl, title, description: desc, og_image_url: null,
        category_id: inferCategoryFromText(`${title} ${desc}`),
        source: 'kagisweb',
      });
    }

    if (rows.length > 0) {
      console.log(`[kagisweb] GitHub CSV: ${rows.length} rows`);
      return rows;
    }
  }

  return [];
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function fetchKagiSmallWeb() {
  const allRows = [];
  const seen    = new Set();

  const addRows = (rows) => {
    for (const row of rows) {
      if (!row.url || seen.has(row.url)) continue;
      seen.add(row.url);
      allRows.push(row);
    }
  };

  // Try all sources
  console.log('\n[kagisweb] Trying JSON feed...');
  const feedRows = await fetchKagiFeed();
  addRows(feedRows);
  await sleep(DELAY_MS);

  if (feedRows.length === 0) {
    console.log('[kagisweb] Trying RSS feed...');
    addRows(await fetchKagiRSS());
    await sleep(DELAY_MS);
  }

  console.log('[kagisweb] Trying GitHub CSV dump...');
  addRows(await fetchGitHubDump());

  console.log(`\n[kagisweb] Total unique URLs: ${allRows.length}`);
  return allRows;
}

async function main() {
  console.log('=== Kagi Small Web seeder ===');

  let rows;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[kagisweb] Loaded ${rows.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    rows = await fetchKagiSmallWeb();
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(rows));
    console.log(`[kagisweb] Cached ${rows.length} rows to ${CACHE_FILE}`);
  }

  if (rows.length === 0) {
    console.warn('[kagisweb] No rows collected. The Kagi Small Web API endpoints may have changed.');
    console.warn('[kagisweb] Check https://kagi.com/smallweb and update the feed URLs in this script.');
    process.exit(0);
  }

  console.log(`\n[kagisweb] Total: ${rows.length} — upserting...`);
  const result = await upsertUrls(rows, { checkLive: true,  fetchOg: true, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => { console.error(err); process.exit(1); });
