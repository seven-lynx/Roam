/**
 * seed-nasa.js — NASA APOD seeder
 *
 * Pulls the entire Astronomy Picture of the Day archive (June 1995 → today).
 * Each entry has a title, explanation (description), and image — no OG fetch needed.
 *
 * Requires: NASA_API_KEY in root .env (free at https://api.nasa.gov)
 *
 * Run from repo root:
 *   node scripts/seed-nasa.js
 *   node scripts/seed-nasa.js --no-cache   # re-fetch from API
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'nasa.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const DELAY_MS     = 1000; // 1s between requests — early archive is slow to serve
const RETRY_DELAY  = 5000; // wait 5s before retrying a 5xx
const APOD_START   = '2000-01-01'; // skip unreliable pre-2000 API responses

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Convert YYYY-MM-DD to the APOD page URL */
function apodPageUrl(date) {
  const [yyyy, mm, dd] = date.split('-');
  return `https://apod.nasa.gov/apod/ap${yyyy.slice(2)}${mm}${dd}.html`;
}

/** Generate monthly date ranges from start to today */
function dateRanges(startDate) {
  const ranges = [];
  const today  = new Date();

  let from = new Date(startDate);
  while (from <= today) {
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 0); // last day of month

    ranges.push({
      start_date: from.toISOString().slice(0, 10),
      end_date:   (to > today ? today : to).toISOString().slice(0, 10),
    });

    from = new Date(from.getFullYear(), from.getMonth() + 1, 1); // first day of next month
  }
  return ranges;
}

// ── Fetch from NASA APOD API ──────────────────────────────────────────────────

async function fetchApod() {
  const apiKey = process.env.NASA_API_KEY;
  if (!apiKey) throw new Error('NASA_API_KEY is not set in .env');

  const ranges = dateRanges(APOD_START);
  console.log(`\n[nasa] Fetching APOD archive in ${ranges.length} yearly chunks...`);

  const rows = [];

  for (const { start_date, end_date } of ranges) {
    const url =
      `https://api.nasa.gov/planetary/apod` +
      `?api_key=${encodeURIComponent(apiKey)}` +
      `&start_date=${start_date}` +
      `&end_date=${end_date}` +
      `&thumbs=true`;

    let data;
    let attempts = 0;
    while (attempts < 3) {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app; seeder bot)' },
        });
        if (res.status === 429 || res.status >= 500) {
          attempts++;
          console.warn(`[nasa]   ${start_date}→${end_date}: HTTP ${res.status} — retry ${attempts}/3`);
          await sleep(RETRY_DELAY * attempts);
          continue;
        }
        if (!res.ok) {
          console.warn(`[nasa]   ${start_date}→${end_date}: HTTP ${res.status} — skipping`);
          break;
        }
        data = await res.json();
        break;
      } catch (err) {
        attempts++;
        console.warn(`[nasa]   ${start_date}→${end_date}: error — ${err.message} — retry ${attempts}/3`);
        await sleep(RETRY_DELAY * attempts);
      }
    }
    if (!data) continue;

    if (!Array.isArray(data)) continue;

    for (const entry of data) {
      // Use the image URL; for videos use thumbnail_url if available
      const image = entry.hdurl ?? entry.url ?? entry.thumbnail_url ?? null;
      // Skip entries with no usable image
      if (entry.media_type === 'video' && !entry.thumbnail_url) continue;

      rows.push({
        url:         apodPageUrl(entry.date),
        title:       entry.title ?? null,
        description: entry.explanation ? entry.explanation.slice(0, 500) : null,
        og_image_url: image,
        category_id: CATEGORY.SCIENCE,
        source:      'nasa',
      });
    }

    console.log(`[nasa]   ${start_date} → ${end_date}: ${data.length} entries`);
    await sleep(DELAY_MS);
  }

  console.log(`[nasa] Total collected: ${rows.length}`);
  return rows;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== NASA APOD seeder ===');

  let rows;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[nasa] Loaded ${rows.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    rows = await fetchApod();
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(rows));
    console.log(`[nasa] Cached ${rows.length} rows to ${CACHE_FILE}`);
  }

  // API provides title, description, and image — no OG fetch needed
  console.log(`\n[nasa] Total: ${rows.length} — upserting...`);
  const result = await upsertUrls(rows, { fetchOg: false, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
