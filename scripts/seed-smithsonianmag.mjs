/**
 * seed-smithsonianmag.mjs — Smithsonian Magazine seeder
 *
 * Pulls articles from Smithsonian Magazine's public RSS feeds.
 * Smithsonian Magazine covers science, history, arts, travel, and innovation
 * with in-depth journalism and photography. All articles are freely readable.
 *
 * No API key required.
 *
 * Run from repo root:
 *   node scripts/seed-smithsonianmag.mjs
 *   node scripts/seed-smithsonianmag.mjs --no-cache
 *   node scripts/seed-smithsonianmag.mjs --max-age-days 365
 *
 * Source labels written to DB:
 *   smithsonian-science    → Science & Nature
 *   smithsonian-history    → History & Ideas
 *   smithsonian-arts       → Arts & Culture
 *   smithsonian-innovation → Technology
 *   smithsonian-travel     → People & Places
 *   smithsonian-news       → category inferred from content
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { config as dotenvConfig } from 'dotenv';
import { upsertUrls, CATEGORY, fetchWithRetry } from './lib/seed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../.env') });

const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'smithsonianmag.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const maxAgeIdx    = process.argv.indexOf('--max-age-days');
const MAX_AGE_DAYS = maxAgeIdx >= 0 ? Math.max(1, parseInt(process.argv[maxAgeIdx + 1], 10)) : 730;
const cutoffDate   = new Date(Date.now() - MAX_AGE_DAYS * 86_400_000);

const DELAY_MS = 1500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Feed definitions ──────────────────────────────────────────────────────────
// Each feed maps to a single Roam category; smart-news is inferred per item.
const FEEDS = [
  { url: 'https://www.smithsonianmag.com/rss/science-nature/', label: 'smithsonian-science',    categoryId: CATEGORY.SCIENCE },
  { url: 'https://www.smithsonianmag.com/rss/history/',        label: 'smithsonian-history',    categoryId: CATEGORY.HISTORY_IDEAS },
  { url: 'https://www.smithsonianmag.com/rss/arts-culture/',   label: 'smithsonian-arts',       categoryId: CATEGORY.ARTS_CULTURE },
  { url: 'https://www.smithsonianmag.com/rss/innovation/',     label: 'smithsonian-innovation', categoryId: CATEGORY.TECHNOLOGY },
  { url: 'https://www.smithsonianmag.com/rss/travel/',         label: 'smithsonian-travel',     categoryId: CATEGORY.PEOPLE_PLACES },
  { url: 'https://www.smithsonianmag.com/rss/smart-news/',     label: 'smithsonian-news',       categoryId: null }, // inferred below
];

// ── Category inference for smart-news items ───────────────────────────────────
function inferCategory(title, description) {
  const text = `${title ?? ''} ${description ?? ''}`.toLowerCase();
  if (/\bscience\b|research|study|biology|physics|space|climate|fossil|gene|species|evolution|chemistry|astronomy/.test(text)) return CATEGORY.SCIENCE;
  if (/\bhistory\b|ancient|archaeolog|war\b|civil war|revolution|museum|artifact|empire|dynasty|colonial/.test(text)) return CATEGORY.HISTORY_IDEAS;
  if (/\btech\b|software|ai\b|robot|computer|engineer|invention|patent|digital/.test(text)) return CATEGORY.TECHNOLOGY;
  if (/\bart\b|music|painting|sculpture|film|photography|design|fashion|exhibit|gallery/.test(text)) return CATEGORY.ARTS_CULTURE;
  if (/\btravel\b|country|city|national park|landmark|destination|tourism|voyage/.test(text)) return CATEGORY.PEOPLE_PLACES;
  if (/\bhealth\b|medicine|mental|brain|body|disease|nutrition|exercise|therapy/.test(text)) return CATEGORY.MIND_BODY;
  return CATEGORY.SCIENCE; // Smithsonian leans heavily science; safest default
}

// ── RSS parser ────────────────────────────────────────────────────────────────
function parseRSS(xml, feed) {
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
    // Smithsonian Magazine uses <enclosure url="..."> for thumbnails
    const imgMatch   = block.match(/<enclosure[^>]+url="([^"]+)"/i)
      ?? block.match(/<media:content[^>]+url="([^"]+)"/i)
      ?? block.match(/<media:thumbnail[^>]+url="([^"]+)"/i);
    const pubDateMatch = block.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/i);

    const url = linkMatch?.[1]?.trim();
    if (!url || !url.startsWith('http')) continue;

    // Age filter
    if (pubDateMatch) {
      const pubDate = new Date(pubDateMatch[1].trim());
      if (!isNaN(pubDate.getTime()) && pubDate < cutoffDate) continue;
    }

    const title = titleMatch
      ? titleMatch[1]
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, '').trim()
      : null;

    if (!title) continue;

    const rawDesc   = descMatch?.[1] ?? null;
    const description = rawDesc
      ? rawDesc.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ').trim().slice(0, 500)
      : null;

    const og_image_url = imgMatch?.[1]?.trim() ?? null;

    const categoryId = feed.categoryId ?? inferCategory(title, description);

    items.push({
      url,
      title,
      description:   description || null,
      og_image_url:  og_image_url || null,
      category_id:   categoryId,
      source:        feed.label,
    });
  }

  return items;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });

  let rows;

  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    console.log('[smithsonianmag] Loading from cache...');
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[smithsonianmag] ${rows.length} rows loaded from cache`);
  } else {
    rows = [];

    for (let i = 0; i < FEEDS.length; i++) {
      const feed = FEEDS[i];
      console.log(`[smithsonianmag] Feed ${i + 1}/${FEEDS.length}: ${feed.label}`);

      try {
        const res = await fetchWithRetry(
          feed.url,
          {
            headers: {
              'User-Agent': 'Roam-Seeder/1.0 (+https://roamtheweb.app)',
              Accept:       'application/rss+xml, application/xml, text/xml, */*',
            },
          },
          { retries: 3, base: 2000 },
        );

        if (!res.ok) {
          console.warn(`[smithsonianmag]   HTTP ${res.status} — skipping`);
          continue;
        }

        const xml   = await res.text();
        const items = parseRSS(xml, feed);
        console.log(`[smithsonianmag]   +${items.length} items`);
        rows.push(...items);
      } catch (err) {
        console.warn(`[smithsonianmag]   Error: ${err.message} — skipping`);
      }

      if (i < FEEDS.length - 1) await sleep(DELAY_MS);
    }

    // Deduplicate by URL (a URL can appear in both latest_articles and a section feed)
    const seen = new Set();
    rows = rows.filter((r) => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    console.log(`[smithsonianmag] Total after dedup: ${rows.length}`);

    writeFileSync(CACHE_FILE, JSON.stringify(rows, null, 2));
    console.log(`[smithsonianmag] Cache saved → ${CACHE_FILE}`);
  }

  if (rows.length === 0) {
    console.log('[smithsonianmag] No rows to upsert.');
    return;
  }

  const byLabel = {};
  for (const r of rows) byLabel[r.source] = (byLabel[r.source] ?? 0) + 1;
  for (const [src, count] of Object.entries(byLabel)) {
    console.log(`[smithsonianmag]   ${src}: ${count}`);
  }

  console.log(`[smithsonianmag] Upserting ${rows.length} rows...`);

  const result = await upsertUrls(rows, { checkLive: true,  fetchOg: false, verbose: true });

  console.log(
    `[smithsonianmag] Done. Inserted: ${result?.inserted ?? '?'}, Skipped: ${result?.skipped ?? '?'}`,
  );
}

main().catch((err) => {
  console.error('[smithsonianmag] Fatal error:', err);
  process.exit(1);
});
