/**
 * seed-mastodon.mjs — Mastodon Trending Links seeder
 *
 * Fetches trending links from the mastodon.social public trends API.
 * No authentication required. Returns URLs that many Mastodon accounts
 * have shared recently — a strong community-curation signal.
 *
 * API: GET https://mastodon.social/api/v1/trends/links
 * Returns up to 20 trending links; repeated runs fetch fresh data.
 *
 * Seeder score: sum of `uses` across the 7-day history window, capped at
 * 500 so links don't swamp the score distribution.
 *
 * Run from repo root:
 *   node scripts/seed-mastodon.mjs
 *   node scripts/seed-mastodon.mjs --no-cache
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { config as dotenvConfig } from 'dotenv';
import { upsertUrls, CATEGORY, fetchWithRetry } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../.env') });

const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'mastodon.json');
const NO_CACHE   = process.argv.includes('--no-cache');

// mastodon.social paginates trends; limit=40 is the max the API supports
const INSTANCES = [
  'https://mastodon.social/api/v1/trends/links?limit=40',
  'https://fosstodon.org/api/v1/trends/links?limit=40',
  'https://hachyderm.io/api/v1/trends/links?limit=40',
];

const DELAY_MS = 2000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Category inference from title / description ───────────────────────────────
function inferCategory(title, description) {
  const text = `${title ?? ''} ${description ?? ''}`.toLowerCase();

  if (/\bscience\b|research|study|biology|physics|climate|space|astronomy|math|evolution|nature/.test(text)) return CATEGORY.SCIENCE;
  if (/\btech\b|software|programming|code|ai\b|machine.learning|open.source|security|privacy|linux|foss/.test(text)) return CATEGORY.TECHNOLOGY;
  if (/\bfilm\b|movie|music|art\b|design|book\b|literature|culture|exhibition|photography|theatre/.test(text)) return CATEGORY.ARTS_CULTURE;
  if (/\bhistory\b|philosophy|politics|economics|essay|ideas|democracy|society/.test(text)) return CATEGORY.HISTORY_IDEAS;
  if (/\bgame\b|gaming|hobby|sport|recipe|cooking|craft|gardening/.test(text)) return CATEGORY.GAMES_HOBBIES;
  if (/\bhealth\b|mental.health|wellness|psychology|meditation|anxiety|therapy/.test(text)) return CATEGORY.MIND_BODY;
  if (/\bcity\b|travel|map|country|community|place\b|geography/.test(text)) return CATEGORY.PEOPLE_PLACES;

  return CATEGORY.WEIRD_WONDERFUL;
}

// ── Fetch trending links from one instance ────────────────────────────────────
async function fetchTrends(apiUrl) {
  const res = await fetchWithRetry(apiUrl, {
    headers: { 'User-Agent': 'Roam-seeder/1.0 (https://roamtheweb.app)' },
  });
  if (!res.ok) {
    console.warn(`  [mastodon] ${apiUrl} → ${res.status} — skipping`);
    return [];
  }
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function fetchMastodon() {
  let allLinks = [];

  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    try {
      allLinks = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
      console.log(`[mastodon] Loaded ${allLinks.length} cached links`);
    } catch {
      allLinks = [];
    }
  }

  if (allLinks.length === 0 || NO_CACHE) {
    console.log(`[mastodon] Fetching trends from ${INSTANCES.length} instances…`);
    const seen = new Set();

    for (let i = 0; i < INSTANCES.length; i++) {
      process.stdout.write(`\r  instance ${i + 1}/${INSTANCES.length}: ${INSTANCES[i].replace('https://', '').split('/')[0]}…`);
      const items = await fetchTrends(INSTANCES[i]);

      for (const item of items) {
        const url = item.url;
        if (typeof url !== 'string' || !url.startsWith('http') || seen.has(url)) continue;
        seen.add(url);

        // Sum total uses across the history window (up to 7 days), cap at 500
        const totalUses = (item.history ?? []).reduce((acc, h) => acc + parseInt(h.uses ?? 0, 10), 0);
        const seederScore = Math.min(500, totalUses);

        allLinks.push({
          url,
          title:       typeof item.title       === 'string' ? item.title       : null,
          description: typeof item.description === 'string' ? item.description : null,
          ogImage:     typeof item.image        === 'string' ? item.image        : null,
          seederScore,
        });
      }

      if (i < INSTANCES.length - 1) await sleep(DELAY_MS);
    }

    process.stdout.write('\n');
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(allLinks, null, 2));
    console.log(`[mastodon] Cached ${allLinks.length} links`);
  }

  // ── Map to Roam schema ───────────────────────────────────────────────────
  const rows = allLinks.map((item) => ({
    url:          item.url,
    title:        item.title ?? null,
    description:  item.description ?? null,
    og_image:     item.ogImage ?? null,
    category_id:  inferCategory(item.title, item.description),
    source:       'mastodon',
    seeder_score: item.seederScore ?? 0,
  }));

  console.log(`[mastodon] Upserting ${rows.length} rows…`);
  await upsertUrls(rows);
  console.log('[mastodon] Done.');
}

fetchMastodon().catch((err) => { console.error(err); process.exit(1); });
