/**
 * seed-nyt.js — New York Times seeder (Archive API)
 *
 * Pulls full-month article metadata via the NYT Archive API.
 * One request per month returns every article published that month.
 * This yields thousands of articles vs. the ~500 the Top Stories API gives.
 *
 * Note: NYT articles are paywalled. Users with "Skip paywalled sites" enabled
 * will not see these URLs. Subscribers can opt in.
 *
 * Requires: NYT_API_KEY in root .env
 *   Get one free at https://developer.nytimes.com/ (instant)
 *   Add to .env: NYT_API_KEY=your_key
 *
 * Rate limits: 10 req/min, 4000 req/day
 *
 * Run from repo root:
 *   node scripts/seed-nyt.js              # resume / use cache
 *   node scripts/seed-nyt.js --no-cache   # re-fetch from API
 *   node scripts/seed-nyt.js --years 3    # how many years back (default: 5)
 */

import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY, fetchWithRetry } from './lib/seed.js';
import { createCache } from './lib/cache.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const NO_CACHE   = process.argv.includes('--no-cache');
const cache      = createCache('nyt', { noCache: NO_CACHE });

const YEARS_BACK = (() => {
  // Support both --years N and --max-age-days N (days takes precedence)
  const di = process.argv.indexOf('--max-age-days');
  if (di >= 0) return Math.max(1, parseInt(process.argv[di + 1], 10)) / 365;
  const i = process.argv.indexOf('--years');
  return i >= 0 ? Math.max(1, parseInt(process.argv[i + 1], 10)) : 5;
})();

const DELAY_MS = 6500; // 10 req/min — add buffer
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── section_name / news_desk → Roam category ─────────────────────────────────
const SECTION_CATEGORY = {
  science:      CATEGORY.SCIENCE,
  health:       CATEGORY.MIND_BODY,
  well:         CATEGORY.MIND_BODY,
  technology:   CATEGORY.TECHNOLOGY,
  business:     CATEGORY.TECHNOLOGY,
  arts:         CATEGORY.ARTS_CULTURE,
  books:        CATEGORY.ARTS_CULTURE,
  'books/review': CATEGORY.ARTS_CULTURE,
  movies:       CATEGORY.ARTS_CULTURE,
  theater:      CATEGORY.ARTS_CULTURE,
  music:        CATEGORY.ARTS_CULTURE,
  dance:        CATEGORY.ARTS_CULTURE,
  fashion:      CATEGORY.ARTS_CULTURE,
  style:        CATEGORY.ARTS_CULTURE,
  travel:       CATEGORY.PEOPLE_PLACES,
  nyregion:     CATEGORY.PEOPLE_PLACES,
  world:        CATEGORY.HISTORY_IDEAS,
  opinion:      CATEGORY.HISTORY_IDEAS,
  us:           CATEGORY.HISTORY_IDEAS,
  politics:     CATEGORY.HISTORY_IDEAS,
  sports:       CATEGORY.GAMES_HOBBIES,
  food:         CATEGORY.GAMES_HOBBIES,
  dining:       CATEGORY.GAMES_HOBBIES,
  home:         CATEGORY.GAMES_HOBBIES,
  realestate:   CATEGORY.PEOPLE_PLACES,
  obituaries:   CATEGORY.HISTORY_IDEAS,
  magazine:     CATEGORY.WEIRD_WONDERFUL,
  t:            CATEGORY.WEIRD_WONDERFUL,
};

function mapSection(sectionName, newsDesk) {
  const s = (sectionName ?? '').toLowerCase().replace(/ /g, '');
  const d = (newsDesk ?? '').toLowerCase().replace(/ /g, '');
  return SECTION_CATEGORY[s] ?? SECTION_CATEGORY[d] ?? CATEGORY.HISTORY_IDEAS;
}

// ── Fetch one month from the Archive API ──────────────────────────────────────
async function fetchMonth(apiKey, year, month) {
  let res;
  try {
    res = await fetchWithRetry(
      `https://api.nytimes.com/svc/archive/v1/${year}/${month}.json?api-key=${apiKey}`,
      { headers: { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)' } },
      { retries: 3, base: 65000 },
    );
  } catch (err) {
    console.warn(`[nyt]   ${year}/${month}: ${err.message}`);
    return [];
  }
  if (!res.ok) {
    console.warn(`[nyt]   ${year}/${month}: HTTP ${res.status}`);
    return [];
  }
  const json = await res.json();
  const docs = json?.response?.docs ?? [];

  return docs
    .filter((d) =>
      d.web_url &&
      !d.web_url.includes('/video/') &&
      !d.web_url.includes('/interactive/') &&
      d.document_type === 'article',
    )
    .map((d) => {
      const multimedia = d.multimedia ?? [];
      const img = multimedia.find(
        (m) => m.subtype === 'mediumThreeByTwo210' || m.subtype === 'xlarge',
      );
      return {
        url:         d.web_url,
        title:       d.headline?.main ?? null,
        description: d.abstract ? d.abstract.trim().slice(0, 500) : null,
        ogImage:     img ? `https://static01.nyt.com/${img.url}` : null,
        sectionName: d.section_name ?? null,
        newsDesk:    d.news_desk ?? null,
      };
    });
}

// ── Build list of (year, month) pairs going back YEARS_BACK years ─────────────
function getMonths(yearsBack) {
  const months = [];
  const now    = new Date();
  for (let i = 0; i < yearsBack * 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return months;
}

// ── Main fetch loop ───────────────────────────────────────────────────────────
async function fetchNYT() {
  const apiKey = process.env.NYT_API_KEY;
  if (!apiKey) throw new Error('NYT_API_KEY is not set in .env');

  const months = getMonths(YEARS_BACK);
  console.log(`\n[nyt] Fetching ${months.length} months (${YEARS_BACK} years) via Archive API...`);

  const allRows = [];
  const seen    = new Set();
  let monthsDone = 0;

  for (const { year, month } of months) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    let docs = cache.get(key);
    if (!docs) {
      docs = await fetchMonth(apiKey, year, month);
      cache.set(key, docs);
    }
    let added = 0;

    for (const { url, title, description, ogImage, sectionName, newsDesk } of docs) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      allRows.push({
        url,
        title,
        description,
        og_image_url: ogImage,
        category_id:  mapSection(sectionName, newsDesk),
        source:       'nyt',
      });
      added++;
    }

    monthsDone++;
    process.stdout.write(
      `\r[nyt]   ${year}/${String(month).padStart(2, '0')}: ${added} articles  (total ${allRows.length})  `,
    );
    await sleep(DELAY_MS);
  }

  console.log(`\n\n[nyt] Total unique articles: ${allRows.length}`);
  return allRows;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== NYT seeder (Archive API) ===');

  const rows = await fetchNYT();
  console.log(`\n[nyt] Total: ${rows.length} — upserting...`);
  const result = await upsertUrls(rows, { checkLive: true,  fetchOg: false, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
