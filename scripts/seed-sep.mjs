/**
 * seed-sep.mjs — Stanford Encyclopedia of Philosophy seeder
 *
 * Parses the SEP contents page to discover all published article entries,
 * then upserts each entry URL into Roam. The SEP is one of the most
 * rigorously peer-reviewed, openly accessible references in philosophy —
 * covering every major topic from analytic philosophy to Eastern traditions.
 *
 * ~1 800 articles as of 2025. No API key required.
 * Contents: https://plato.stanford.edu/contents.html
 *
 * Run from repo root:
 *   node scripts/seed-sep.mjs
 *   node scripts/seed-sep.mjs --no-cache
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { config as dotenvConfig } from 'dotenv';
import { upsertUrls, CATEGORY, SUBCATEGORY, fetchWithRetry } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../.env') });

const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'sep.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const DELAY_MS = 300; // SEP is a small academic server — be polite
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CONTENTS_URL = 'https://plato.stanford.edu/contents.html';
const BASE_URL     = 'https://plato.stanford.edu/';
// Relative href pattern on the contents page: entries/<slug>/
const ENTRY_HREF_RE = /^entries\/([^/"]+)\/?$/;

// ── Keyword → subcategory heuristics ─────────────────────────────────────────
// Broad buckets; OG fetch will extract descriptions on upsert.
function inferSubcategory(slug) {
  const s = slug.toLowerCase();

  // Logic & Mathematics
  if (/logic|set-theory|proof|modal|deduc|induct|formal|computab|decidab|math/.test(s))
    return SUBCATEGORY.MATHEMATICS_LOGIC;

  // Physics / Natural Philosophy
  if (/quantum|relativ|mechanic|space-time|causation|determinism|physics|thermody/.test(s))
    return SUBCATEGORY.PHYSICS_CHEMISTRY;

  // Biology / Evolution
  if (/evolution|species|fitness|natural-selection|heredit|genotype|organism/.test(s))
    return SUBCATEGORY.BIOLOGY_EVOLUTION;

  // Psychology / Mind / Behaviour
  if (/consciousness|mind|cognit|perception|belief|desire|emotion|mental|intentional/.test(s))
    return SUBCATEGORY.PSYCHOLOGY_BEHAVIOUR;

  // Religion & Mythology
  if (/god|theism|atheism|religion|divine|soul|afterlife|mysticism|theology/.test(s))
    return SUBCATEGORY.RELIGION_MYTHOLOGY;

  // Politics / Geopolitics
  if (/democracy|justice|rights|liberty|equality|sovereignty|political|law|punishment/.test(s))
    return SUBCATEGORY.POLITICS_GEOPOLITICS;

  // Social / Moral Philosophy
  if (/ethics|moral|virtue|consequential|deontolog|utilitari|social|feminism|race/.test(s))
    return SUBCATEGORY.SOCIAL_HISTORY;

  // Ancient & Medieval
  if (/plato|aristotle|socrat|stoic|epicur|presocrat|medieval|aquinas|augustine|ancient/.test(s))
    return SUBCATEGORY.ANCIENT_MEDIEVAL_HISTORY;

  // Default: Philosophy & Ethics
  return SUBCATEGORY.PHILOSOPHY_ETHICS;
}

// ── Parse contents.html ───────────────────────────────────────────────────────
function parseContents(html) {
  const seen = new Set();
  const urls = [];
  const hrefRe = /href="(entries\/[^"]+)"/gi;
  let m;
  while ((m = hrefRe.exec(html)) !== null) {
    const href = m[1].replace(/\/$/, ''); // strip trailing slash for dedup
    if (!ENTRY_HREF_RE.test(href + '/')) continue;
    const slug = href.replace(/^entries\//, '');
    if (seen.has(slug)) continue;
    seen.add(slug);
    urls.push(`${BASE_URL}${href}/`);
  }
  return urls;
}

// ── Derive a readable title from the SEP entry slug ──────────────────────────
// The OG fetch will overwrite this with the real article title; this is a
// sensible fallback so we never store an entry with an empty title.
function slugToTitle(slug) {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Stanford Encyclopedia of Philosophy seeder ===\n');

  let rows;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[sep] Loaded ${rows.length} entries from cache (use --no-cache to re-fetch)`);
  } else {
    console.log('[sep] Fetching contents page...');
    let html;
    try {
      const res = await fetchWithRetry(CONTENTS_URL, {
        headers: { 'User-Agent': 'Roam-Seeder/1.0 (+https://roamtheweb.app)' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
    } catch (err) {
      console.error(`[sep] Failed to fetch contents page: ${err.message}`);
      process.exit(1);
    }

    const entryUrls = parseContents(html);
    console.log(`[sep] Found ${entryUrls.length} article entries`);

    rows = entryUrls.map((url) => {
      const slug = url.replace(BASE_URL + 'entries/', '').replace(/\/$/, '');
      return {
        url,
        title:        slugToTitle(slug),
        description:  null, // will be fetched from OG meta by upsertUrls
        og_image_url: null,
        category_id:  CATEGORY.HISTORY_IDEAS,
        subcategory_id: inferSubcategory(slug),
        source:       'sep',
        language:     'en',
      };
    });

    await sleep(DELAY_MS); // brief pause after sitemap fetch

    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(rows));
    console.log(`[sep] Cached ${rows.length} rows`);
  }

  console.log(`\n[sep] Total: ${rows.length} — upserting (OG fetch will retrieve real titles)...`);
  // fetchOg=true: pulls the real article title and description from each entry page.
  // SEP pages are lightweight HTML so this is reasonably fast at 300ms/request.
  const result = await upsertUrls(rows, { checkLive: true,  fetchOg: true, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
