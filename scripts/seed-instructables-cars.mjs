/**
 * seed-instructables-cars.mjs — Instructables Automotive seeder
 *
 * Pulls step-by-step DIY car repair, modding, and build guides from
 * Instructables' automotive category RSS feed.
 *
 * Instructables provides detailed, illustrated how-to guides created by
 * a community of makers. The automotive section covers everything from
 * oil changes and brake jobs to custom bodywork and engine swaps.
 *
 * No API key required. RSS feed is publicly indexed.
 *
 * Fallback: If the RSS feed fails, the seeder exits with zero data (no loss).
 *
 * Run from repo root:
 *   node scripts/seed-instructables-cars.mjs
 *   node scripts/seed-instructables-cars.mjs --no-cache
 *   node scripts/seed-instructables-cars.mjs --max-age-days 365
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { config as dotenvConfig } from 'dotenv';
import { upsertUrls, CATEGORY, SUBCATEGORY, fetchWithRetry } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../.env') });

const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'instructables-cars.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const maxAgeIdx  = process.argv.indexOf('--max-age-days');
const MAX_AGE_DAYS = maxAgeIdx >= 0 ? Math.max(1, parseInt(process.argv[maxAgeIdx + 1], 10)) : 365;
const cutoffDate = new Date(Date.now() - MAX_AGE_DAYS * 86_400_000);

const DELAY_MS = 1500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Feed definitions ──────────────────────────────────────────────────────────
const FEEDS = [
  {
    url: 'https://www.instructables.com/channel/autos/rss.xml',
    label: 'instructables-autos',
    categoryId: CATEGORY.GAMES_HOBBIES,
    subcategoryId: SUBCATEGORY.CRAFTS_DIY_MAKING,
  },
  {
    url: 'https://www.instructables.com/channel/workshop/rss.xml',
    label: 'instructables-workshop',
    categoryId: CATEGORY.GAMES_HOBBIES,
    subcategoryId: SUBCATEGORY.CRAFTS_DIY_MAKING,
  },
  {
    url: 'https://www.instructables.com/channel/technology/rss.xml',
    label: 'instructables-tech',
    categoryId: CATEGORY.TECHNOLOGY,
    subcategoryId: SUBCATEGORY.HARDWARE_ELECTRONICS,
  },
];

// ── RSS parser ────────────────────────────────────────────────────────────────
function parseRSS(xml, feed) {
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
      ?? block.match(/<media:thumbnail[^>]+url="([^"]+)"/i)
      ?? block.match(/<enclosure[^>]+url="([^"]+)"/i);

    const url = linkMatch?.[1]?.trim();
    if (!url || !url.startsWith('http')) continue;

    // Age filter
    if (pubDateMatch) {
      const pubDate = new Date(pubDateMatch[1].trim());
      if (!isNaN(pubDate.getTime()) && pubDate < cutoffDate) continue;
    }

    const title = titleMatch
      ? titleMatch[1].replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/&#\d+;/g, '').trim()
      : null;

    if (!title) continue;

    const rawDesc = descMatch?.[1] ?? null;
    const description = rawDesc
      ? rawDesc.replace(/<[^>]+>/g, '').replace(/&/g, '&').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ').trim().slice(0, 500)
      : null;

    const ogImage = imgMatch?.[1]?.trim() ?? null;

    const pubDate = pubDateMatch
      ? (() => { const d = new Date(pubDateMatch[1].trim()); return isNaN(d.getTime()) ? null : d.toISOString(); })()
      : null;

    items.push({
      url,
      title,
      description:     description || null,
      og_image_url:    ogImage || null,
      category_id:     feed.categoryId,
      subcategory_id:  feed.subcategoryId,
      source:          feed.label,
      published_at:    pubDate,
      language:        'en',
      seeder_score:    0.7,
    });
  }

  return items;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Instructables Automotive & DIY Seeder ===');
  console.log(`    Feeds: ${FEEDS.length} | Max age: ${MAX_AGE_DAYS} days\n`);

  mkdirSync(CACHE_DIR, { recursive: true });

  let rows;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[instructables-cars] Loaded ${rows.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    rows = [];
    const seen = new Set();

    for (const feed of FEEDS) {
      console.log(`[instructables-cars] ${feed.label}: ${feed.url}`);
      let res;
      try {
        res = await fetchWithRetry(feed.url, {
          headers: {
            'User-Agent': 'Roam-Seeder/1.0 (+https://roamtheweb.app)',
            Accept:       'application/rss+xml, application/xml, text/xml, */*',
          },
        }, { retries: 3, base: 2000 });
      } catch (err) {
        console.warn(`[instructables-cars]   Error: ${err.message} — skipping`);
        await sleep(DELAY_MS);
        continue;
      }

      if (!res.ok) {
        console.warn(`[instructables-cars]   HTTP ${res.status} — skipping`);
        await sleep(DELAY_MS);
        continue;
      }

      const xml   = await res.text();
      const items = parseRSS(xml, feed);
      let added = 0;

      for (const item of items) {
        if (!seen.has(item.url)) {
          seen.add(item.url);
          rows.push(item);
          added++;
        }
      }

      console.log(`[instructables-cars]   +${added} articles (total=${rows.length})`);
      await sleep(DELAY_MS);
    }

    writeFileSync(CACHE_FILE, JSON.stringify(rows, null, 2));
    console.log(`[instructables-cars] Cached ${rows.length} rows`);
  }

  // Breakdown by source
  const bySource = {};
  for (const r of rows) bySource[r.source] = (bySource[r.source] ?? 0) + 1;
  console.log('\n[instructables-cars] By source:');
  for (const [src, count] of Object.entries(bySource)) {
    console.log(`  ${src}: ${count}`);
  }

  if (rows.length === 0) {
    console.log('[instructables-cars] No rows to upsert.');
    return;
  }

  console.log(`\n[instructables-cars] Upserting ${rows.length} rows...`);
  const result = await upsertUrls(rows, { checkLive: true, fetchOg: true, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error('[instructables-cars] Fatal error:', err);
  process.exit(1);
});