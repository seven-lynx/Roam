/**
 * seed-atlantic-newyorker.mjs — The Atlantic & The New Yorker seeder
 *
 * Pulls articles from RSS feeds of two of the most influential English-language
 * magazines. Both publish long-form journalism, criticism, and essays across
 * politics, culture, science, and ideas.
 *
 * Some articles may be behind a paywall; they are included so subscribers can
 * discover them through Roam, and free readers can still see the title/excerpt.
 *
 * No API key required. Content is publicly indexed.
 *
 * Run from repo root:
 *   node scripts/seed-atlantic-newyorker.mjs
 *   node scripts/seed-atlantic-newyorker.mjs --no-cache
 *   node scripts/seed-atlantic-newyorker.mjs --max-age-days 1825
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { config as dotenvConfig } from 'dotenv';
import { upsertUrls, CATEGORY, fetchWithRetry } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../.env') });

const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'atlantic-newyorker.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const maxAgeIdx  = process.argv.indexOf('--max-age-days');
const MAX_AGE_DAYS = maxAgeIdx >= 0 ? Math.max(1, parseInt(process.argv[maxAgeIdx + 1], 10)) : 1825;
const cutoffDate = new Date(Date.now() - MAX_AGE_DAYS * 86_400_000);

const DELAY_MS = 1500; // Polite delay between feed fetches
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Feed definitions ──────────────────────────────────────────────────────────
const FEEDS = [
  // ── The Atlantic ─────────────────────────────────────────────────────────
  { url: 'https://feeds.feedburner.com/TheAtlantic',               source: 'atlantic',   categoryId: CATEGORY.HISTORY_IDEAS  },
  { url: 'https://www.theatlantic.com/feed/channel/science/',      source: 'atlantic',   categoryId: CATEGORY.SCIENCE        },
  { url: 'https://www.theatlantic.com/feed/channel/technology/',   source: 'atlantic',   categoryId: CATEGORY.TECHNOLOGY     },
  { url: 'https://www.theatlantic.com/feed/channel/culture/',      source: 'atlantic',   categoryId: CATEGORY.ARTS_CULTURE   },
  { url: 'https://www.theatlantic.com/feed/channel/health/',       source: 'atlantic',   categoryId: CATEGORY.MIND_BODY      },
  { url: 'https://www.theatlantic.com/feed/channel/politics/',     source: 'atlantic',   categoryId: CATEGORY.HISTORY_IDEAS  },
  { url: 'https://www.theatlantic.com/feed/channel/ideas/',        source: 'atlantic',   categoryId: CATEGORY.HISTORY_IDEAS  },
  { url: 'https://www.theatlantic.com/feed/channel/international/',source: 'atlantic',   categoryId: CATEGORY.PEOPLE_PLACES  },
  { url: 'https://www.theatlantic.com/feed/channel/education/',    source: 'atlantic',   categoryId: CATEGORY.HISTORY_IDEAS  },
  { url: 'https://www.theatlantic.com/feed/channel/business/',     source: 'atlantic',   categoryId: CATEGORY.HISTORY_IDEAS  },

  // ── The New Yorker ────────────────────────────────────────────────────────
  { url: 'https://www.newyorker.com/feed/everything',              source: 'newyorker',  categoryId: CATEGORY.ARTS_CULTURE   },
  { url: 'https://www.newyorker.com/feed/culture/books',           source: 'newyorker',  categoryId: CATEGORY.ARTS_CULTURE   },
  { url: 'https://www.newyorker.com/feed/culture/art',             source: 'newyorker',  categoryId: CATEGORY.ARTS_CULTURE   },
  { url: 'https://www.newyorker.com/feed/culture/music',           source: 'newyorker',  categoryId: CATEGORY.ARTS_CULTURE   },
  { url: 'https://www.newyorker.com/feed/culture/film',            source: 'newyorker',  categoryId: CATEGORY.ARTS_CULTURE   },
  { url: 'https://www.newyorker.com/feed/news',                    source: 'newyorker',  categoryId: CATEGORY.HISTORY_IDEAS  },
  { url: 'https://www.newyorker.com/feed/news/dispatches',         source: 'newyorker',  categoryId: CATEGORY.PEOPLE_PLACES  },
  { url: 'https://www.newyorker.com/feed/science',                 source: 'newyorker',  categoryId: CATEGORY.SCIENCE        },
  { url: 'https://www.newyorker.com/feed/humor',                   source: 'newyorker',  categoryId: CATEGORY.WEIRD_WONDERFUL},
];

// ── RSS parser ────────────────────────────────────────────────────────────────
function parseRSS(xml) {
  const items = [];
  const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let m;

  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];

    const linkMatch    = block.match(/<link[^>]*>([^<]+)<\/link>/i)
      ?? block.match(/<link[^>]+href="([^"]+)"/i);
    const titleMatch   = block.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i)
      ?? block.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch    = block.match(/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i)
      ?? block.match(/<description[^>]*>([^<]*)<\/description>/i);
    const pubDateMatch = block.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/i);
    const imgMatch     = block.match(/<media:content[^>]+url="([^"]+)"/i)
      ?? block.match(/<media:thumbnail[^>]+url="([^"]+)"/i);

    const url = linkMatch?.[1]?.trim();
    if (!url || !url.startsWith('http')) continue;

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

// ── Atom parser ───────────────────────────────────────────────────────────────
function parseAtom(xml) {
  const items = [];
  const entryRe = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
  let m;

  while ((m = entryRe.exec(xml)) !== null) {
    const block = m[1];

    const linkMatch      = block.match(/<link[^>]+rel=["']alternate["'][^>]+href="([^"]+)"/i)
      ?? block.match(/<link[^>]+href="([^"]+)"/i);
    const titleMatch     = block.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i)
      ?? block.match(/<title[^>]*>([^<]+)<\/title>/i);
    const publishedMatch = block.match(/<published[^>]*>([^<]+)<\/published>/i)
      ?? block.match(/<updated[^>]*>([^<]+)<\/updated>/i);
    const summaryMatch   = block.match(/<summary[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/summary>/i)
      ?? block.match(/<content[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/content>/i);
    const imgMatch       = block.match(/<media:content[^>]+url="([^"]+)"/i)
      ?? block.match(/<media:thumbnail[^>]+url="([^"]+)"/i);

    const url = linkMatch?.[1]?.trim();
    if (!url || !url.startsWith('http')) continue;

    if (publishedMatch) {
      const pubDate = new Date(publishedMatch[1].trim());
      if (!isNaN(pubDate.getTime()) && pubDate < cutoffDate) continue;
    }

    const title = titleMatch
      ? titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, '').trim()
      : null;

    const rawDesc = summaryMatch?.[1] ?? null;
    const description = rawDesc
      ? rawDesc.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ').trim().slice(0, 500)
      : null;

    const ogImage = imgMatch?.[1]?.trim() ?? null;
    const pubDate = publishedMatch
      ? (() => { const d = new Date(publishedMatch[1].trim()); return isNaN(d.getTime()) ? null : d.toISOString(); })()
      : null;

    items.push({ url, title, description, ogImage, pubDate });
  }

  return items;
}

function parseFeed(xml) {
  if (/<feed\b/i.test(xml)) return parseAtom(xml);
  return parseRSS(xml);
}

// ── Fetch all feeds ───────────────────────────────────────────────────────────
async function fetchAll() {
  const all = [];
  const seen = new Set();

  for (const { url: feedUrl, source, categoryId } of FEEDS) {
    let res;
    try {
      res = await fetchWithRetry(feedUrl, {
        headers: { 'User-Agent': 'Roam-Seeder/1.0 (+https://roamtheweb.app)' },
      }, { retries: 2, base: 2000 });
    } catch (err) {
      console.warn(`[atlantic-newyorker] ${feedUrl}: ${err.message}`);
      await sleep(DELAY_MS);
      continue;
    }

    if (!res.ok) {
      console.warn(`[atlantic-newyorker] ${feedUrl}: HTTP ${res.status}`);
      await sleep(DELAY_MS);
      continue;
    }

    const xml   = await res.text();
    const items = parseFeed(xml);
    let added = 0;

    for (const { url, title, description, ogImage, pubDate } of items) {
      if (!seen.has(url)) {
        seen.add(url);
        all.push({
          url,
          title,
          description,
          og_image_url: ogImage,
          category_id:  categoryId,
          source,
          published_at: pubDate,
          language:     'en',
        });
        added++;
      }
    }

    console.log(`[atlantic-newyorker] ${source} | ${feedUrl.replace(/^https?:\/\/[^/]+/, '')}: ${added} articles (total=${all.length})`);
    await sleep(DELAY_MS);
  }

  return all;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== The Atlantic & The New Yorker seeder ===');
  console.log(`    Max age: ${MAX_AGE_DAYS} days\n`);

  let all;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    all = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[atlantic-newyorker] Loaded ${all.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    all = await fetchAll();
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(all));
    console.log(`[atlantic-newyorker] Cached ${all.length} rows`);
  }

  console.log(`\n[atlantic-newyorker] Total: ${all.length} — upserting...`);
  // fetchOg=true: retrieves full descriptions and images for articles that lack them in RSS.
  const result = await upsertUrls(all, { checkLive: true,  fetchOg: true, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
