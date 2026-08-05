/**
 * seed-kottke.mjs — Kottke.org seeder
 *
 * Pulls posts from Jason Kottke's RSS feed. Kottke.org is one of the oldest
 * and most consistently curated personal blogs on the web — essays, links,
 * and observations across science, culture, design, and ideas since 1998.
 *
 * Kottke posts are typically short link-posts pointing to external articles;
 * we seed the *linked* external URL (not the kottke.org permalink) so users
 * discover the source content, which is Roam's model.
 *
 * No API key required. Content is freely readable.
 *
 * Run from repo root:
 *   node scripts/seed-kottke.mjs
 *   node scripts/seed-kottke.mjs --no-cache
 *   node scripts/seed-kottke.mjs --max-age-days 730
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { config as dotenvConfig } from 'dotenv';
import { upsertUrls, CATEGORY, fetchWithRetry } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../.env') });

const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'kottke.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const maxAgeIdx  = process.argv.indexOf('--max-age-days');
const MAX_AGE_DAYS = maxAgeIdx >= 0 ? Math.max(1, parseInt(process.argv[maxAgeIdx + 1], 10)) : 730;
const cutoffDate = new Date(Date.now() - MAX_AGE_DAYS * 86_400_000);

const DELAY_MS = 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Kottke uses an Atom feed at feeds.kottke.org
const FEEDS = [
  'https://feeds.kottke.org/main',
];

// ── Keyword → Roam category ───────────────────────────────────────────────────
// Kottke has no formal categories — infer from title/description keywords
function inferCategory(title, description) {
  const text = `${title ?? ''} ${description ?? ''}`.toLowerCase();

  if (/\bscience\b|physics|biology|climate|space|astronomy|math|research|study|nature|evolution/.test(text)) return CATEGORY.SCIENCE;
  if (/\btech\b|software|internet|ai\b|algorithm|computer|code|programming|data|startup/.test(text)) return CATEGORY.TECHNOLOGY;
  if (/\bfilm\b|movie|music|art\b|design|book\b|novel|poem|culture|exhibition|painting|theatre/.test(text)) return CATEGORY.ARTS_CULTURE;
  if (/\bhistory\b|philosophy|politics|economics|society|essay|ideas|democracy/.test(text)) return CATEGORY.HISTORY_IDEAS;
  if (/\bgame\b|hobby|food|recipe|sport|cooking|travel|hiking|garden/.test(text)) return CATEGORY.GAMES_HOBBIES;
  if (/\bhealth\b|mental|meditation|sleep|exercise|wellness|psychology|anxiety/.test(text)) return CATEGORY.MIND_BODY;
  if (/\bplace\b|city|town|country|map|people|community|culture|immigrant/.test(text)) return CATEGORY.PEOPLE_PLACES;

  return CATEGORY.WEIRD_WONDERFUL; // Kottke's natural home — curiosities and delight
}

// ── Heuristic: extract the first external link from post body ─────────────────
// Kottke's posts often contain <a href="..."> pointing to the external source.
// We prefer that over the kottke.org permalink itself.
function extractExternalLink(block, kottkePermalink) {
  const kottkeHost = 'kottke.org';

  // Find all href values in the block
  const hrefRe = /href="(https?:\/\/[^"]+)"/gi;
  let m;
  while ((m = hrefRe.exec(block)) !== null) {
    const href = m[1];
    try {
      const { hostname } = new URL(href);
      if (!hostname.includes(kottkeHost)) return href;
    } catch { /* skip malformed */ }
  }
  return null; // no external link found — fall back to kottke permalink
}

// ── RSS parser ────────────────────────────────────────────────────────────────
function parseRSS(xml) {
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
    const pubDateMatch = block.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/i);
    const contentMatch = block.match(/<content:encoded[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/i);

    const kottkePermalink = linkMatch?.[1]?.trim();
    if (!kottkePermalink || !kottkePermalink.startsWith('http')) continue;

    // Age filter
    if (pubDateMatch) {
      const pubDate = new Date(pubDateMatch[1].trim());
      if (!isNaN(pubDate.getTime()) && pubDate < cutoffDate) continue;
    }

    // Prefer the external link Kottke is linking to over his own permalink
    const bodyHtml = contentMatch?.[1] ?? descMatch?.[1] ?? '';
    const externalUrl = extractExternalLink(bodyHtml, kottkePermalink);
    const url = externalUrl ?? kottkePermalink;

    const title = titleMatch
      ? titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, '').trim()
      : null;

    const rawDesc = descMatch?.[1] ?? null;
    const description = rawDesc
      ? rawDesc.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ').trim().slice(0, 500)
      : null;

    items.push({ url, title, description });
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

    // <link rel="alternate" href="..."/> or <link href="..."/>
    const linkMatch = block.match(/<link[^>]+href="([^"]+)"/i);
    const titleMatch = block.match(/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i)
      ?? block.match(/<title[^>]*>([^<]+)<\/title>/i);
    const publishedMatch = block.match(/<published[^>]*>([^<]+)<\/published>/i)
      ?? block.match(/<updated[^>]*>([^<]+)<\/updated>/i);
    const contentMatch = block.match(/<content[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/content>/i)
      ?? block.match(/<summary[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/summary>/i);

    const kottkePermalink = linkMatch?.[1]?.trim();
    if (!kottkePermalink || !kottkePermalink.startsWith('http')) continue;

    // Age filter
    if (publishedMatch) {
      const pubDate = new Date(publishedMatch[1].trim());
      if (!isNaN(pubDate.getTime()) && pubDate < cutoffDate) continue;
    }

    const bodyHtml = contentMatch?.[1] ?? '';
    const externalUrl = extractExternalLink(bodyHtml, kottkePermalink);
    const url = externalUrl ?? kottkePermalink;

    const title = titleMatch
      ? titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, '').trim()
      : null;

    const description = bodyHtml
      ? bodyHtml.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, ' ').trim().slice(0, 500)
      : null;

    items.push({ url, title, description });
  }

  return items;
}

// ── Parse either RSS or Atom ──────────────────────────────────────────────────
function parseFeed(xml) {
  // Atom feeds have <feed> root; RSS feeds have <rss> or <channel>/<item>
  if (/<feed\b/i.test(xml)) return parseAtom(xml);
  return parseRSS(xml);
}

// ── Fetch RSS feeds ───────────────────────────────────────────────────────────
async function fetchKottke() {
  const all = [];
  const seen = new Set();

  for (const feedUrl of FEEDS) {
    let res;
    try {
      res = await fetchWithRetry(feedUrl, {
        headers: { 'User-Agent': 'Roam-Seeder/1.0 (+https://roamtheweb.app)' },
      });
    } catch (err) {
      console.warn(`[kottke] ${feedUrl}: ${err.message}`);
      continue;
    }

    if (!res.ok) {
      console.warn(`[kottke] ${feedUrl}: HTTP ${res.status}`);
      continue;
    }

    const xml   = await res.text();
    const items = parseFeed(xml);

    for (const { url, title, description } of items) {
      if (!seen.has(url)) {
        seen.add(url);
        all.push({
          url,
          title,
          description,
          og_image_url: null,
          category_id:  inferCategory(title, description),
          source:       'kottke',
        });
      }
    }

    console.log(`[kottke] ${feedUrl}: ${items.length} posts`);
    await sleep(DELAY_MS);
  }

  return all;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Kottke.org seeder ===');
  console.log(`    Max age: ${MAX_AGE_DAYS} days\n`);

  let all;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    all = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[kottke] Loaded ${all.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    all = await fetchKottke();
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(all));
    console.log(`[kottke] Cached ${all.length} rows`);
  }

  console.log(`\n[kottke] Total: ${all.length} — upserting...`);
  const result = await upsertUrls(all, { checkLive: true,  fetchOg: true, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
