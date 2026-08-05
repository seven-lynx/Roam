/**
 * seed-cloudhiker.mjs — Cloudhiker best-websites seeder
 *
 * Fetches the top-liked URLs from each of Cloudhiker's 20 category pages
 * at https://cloudhiker.net/best-websites/<slug> and upserts them into Roam.
 *
 * Only the public /best-websites pages are scraped (not disallowed by
 * robots.txt). No login or API key required.
 *
 * Run from repo root:
 *   node scripts/seed-cloudhiker.mjs
 *   node scripts/seed-cloudhiker.mjs --no-cache
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'cloudhiker.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const DELAY_MS = 1500; // polite delay between page fetches
const sleep    = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Cloudhiker slug → Roam category mapping ───────────────────────────────────
// Cloudhiker has 20 categories; map each to the closest Roam category.
const CATEGORIES = [
  { slug: 'arts-fashion',        categoryId: CATEGORY.ARTS_CULTURE    },
  { slug: 'business-economics',  categoryId: CATEGORY.HISTORY_IDEAS   },
  { slug: 'culture-society',     categoryId: CATEGORY.PEOPLE_PLACES   },
  { slug: 'education-learning',  categoryId: CATEGORY.HISTORY_IDEAS   },
  { slug: 'food',                categoryId: CATEGORY.GAMES_HOBBIES   },
  { slug: 'fun',                 categoryId: CATEGORY.WEIRD_WONDERFUL  },
  { slug: 'gaming',              categoryId: CATEGORY.GAMES_HOBBIES   },
  { slug: 'health',              categoryId: CATEGORY.MIND_BODY       },
  { slug: 'history',             categoryId: CATEGORY.HISTORY_IDEAS   },
  { slug: 'home-living',         categoryId: CATEGORY.GAMES_HOBBIES   },
  { slug: 'internet-software',   categoryId: CATEGORY.TECHNOLOGY      },
  { slug: 'literature',          categoryId: CATEGORY.ARTS_CULTURE    },
  { slug: 'music',               categoryId: CATEGORY.ARTS_CULTURE    },
  { slug: 'nature-animals',      categoryId: CATEGORY.SCIENCE         },
  { slug: 'other',               categoryId: CATEGORY.WEIRD_WONDERFUL  },
  { slug: 'philosophy',          categoryId: CATEGORY.HISTORY_IDEAS   },
  { slug: 'science-math',        categoryId: CATEGORY.SCIENCE         },
  { slug: 'sports',              categoryId: CATEGORY.GAMES_HOBBIES   },
  { slug: 'technology',          categoryId: CATEGORY.TECHNOLOGY      },
  { slug: 'tv-movies',           categoryId: CATEGORY.ARTS_CULTURE    },
];

// ── HTML entity decode ────────────────────────────────────────────────────────
function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

// ── Parse the best-websites page HTML ────────────────────────────────────────
// Each entry is a ranked site card rendered as an anchor pointing to the
// external URL. The inner text starts with a rank prefix like "1# Title …".
// Nav and footer links are unranked — we skip anything without that prefix.
function parsePage(html) {
  const results = [];

  const anchorRe = /<a\s[^>]*href="(https?:\/\/(?!cloudhiker\.net)[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  let m;
  while ((m = anchorRe.exec(html)) !== null) {
    const href = m[1].trim();
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    // Only ranked entries (e.g. "1# Title https://...") are real site cards.
    // Nav/footer links have no rank prefix and are discarded.
    const titleMatch = text.match(/^\d+#\s*(.+?)\s+https?:\/\//);
    if (!titleMatch) continue;

    const title = decodeEntities(titleMatch[1].trim());
    if (!title || title.length < 3) continue;

    const descMatch = text.match(/https?:\/\/\S+\s+(.+)/);
    const description = descMatch ? decodeEntities(descMatch[1].trim().slice(0, 500)) : null;

    results.push({ url: href, title, description: description || null });
  }

  return results;
}

// ── Fetch one category page ────────────────────────────────────────────────
async function fetchCategory(slug) {
  const url = `https://cloudhiker.net/best-websites/${slug}`;
  let res;
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)',
        'Accept':     'text/html',
      },
    });
  } catch (err) {
    console.warn(`[cloudhiker] ${slug}: ${err.message}`);
    return [];
  }

  if (!res.ok) {
    console.warn(`[cloudhiker] ${slug}: HTTP ${res.status}`);
    return [];
  }

  const html = await res.text();
  return parsePage(html);
}

// ── Collect all URLs ──────────────────────────────────────────────────────────
async function fetchAll() {
  console.log(`\n[cloudhiker] Fetching ${CATEGORIES.length} category pages...`);
  const allRows = [];
  const seen    = new Set();

  for (let i = 0; i < CATEGORIES.length; i++) {
    const { slug, categoryId } = CATEGORIES[i];
    const results = await fetchCategory(slug);
    let added = 0;

    for (const { url, title, description } of results) {
      if (seen.has(url)) continue;
      seen.add(url);
      allRows.push({ url, title, description, og_image_url: null, category_id: categoryId, source: 'cloudhiker' });
      added++;
    }

    console.log(`[cloudhiker] ${i + 1}/${CATEGORIES.length}  ${slug}: ${added} URLs  (total=${allRows.length})`);

    if (i < CATEGORIES.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\n[cloudhiker] Total unique URLs collected: ${allRows.length}`);
  return allRows;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Cloudhiker best-websites seeder ===');

  let rows;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[cloudhiker] Loaded ${rows.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    rows = await fetchAll();
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(rows));
    console.log(`[cloudhiker] Cached ${rows.length} rows to ${CACHE_FILE}`);
  }

  console.log(`\n[cloudhiker] Upserting ${rows.length} rows (with OG fetch)...`);
  const result = await upsertUrls(rows, { checkLive: true,  fetchOg: true, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
