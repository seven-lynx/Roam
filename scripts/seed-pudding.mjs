/**
 * seed-pudding.mjs — The Pudding seeder
 *
 * Collects visual essays from The Pudding (pudding.cool) via their
 * SvelteKit page data endpoint, which returns a dehydrated flat array
 * of all essays with href, title, and description.
 *
 * No API key required.
 *
 * Run from repo root:
 *   node scripts/seed-pudding.mjs
 *   node scripts/seed-pudding.mjs --no-cache
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY, SUBCATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'pudding.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const DATA_URL = 'https://pudding.cool/__data.json';

// ── Deserialize SvelteKit dehydrated flat array ───────────────────────────────
// SvelteKit serializes page data as a flat values array. Object descriptors
// map field names to array indices, allowing deduplication of repeated values.
// The stories array is at data[1], each entry is an object descriptor at
// data[idx] whose values reference further indices in the flat array.
function deserializeStories(data) {
  const stories = [];
  // data[0] = { stories: 1, staff: N } — the root shape object
  // data[1] = array of starting indices for each story object
  const storyIndices = data[1];
  if (!Array.isArray(storyIndices)) return stories;

  for (const idx of storyIndices) {
    const shape = data[idx]; // e.g. { id: N, href: N, short: N, tease: N, ... }
    if (!shape || typeof shape !== 'object' || Array.isArray(shape)) continue;
    if (!('href' in shape)) continue;

    const href  = data[shape.href];
    const short = data[shape.short];
    const tease = data[shape.tease];

    if (typeof href !== 'string' || !href.startsWith('https://pudding.cool/')) continue;

    stories.push({ href, short: short ?? null, tease: tease ?? null });
  }
  return stories;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== The Pudding seeder ===');

  let rows;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[pudding] Loaded ${rows.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    const res = await fetch(DATA_URL, {
      headers: { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${DATA_URL}`);
    const json = await res.json();
    const data = json.nodes?.[1]?.data;
    if (!Array.isArray(data)) throw new Error('Unexpected __data.json shape');

    const stories = deserializeStories(data);
    console.log(`[pudding] Deserialized ${stories.length} stories`);

    rows = stories
      .map(({ href, short, tease }) => ({
        url:           href,
        title:         short ?? null,
        description:   tease ?? null,
        category_id:    CATEGORY.WEIRD_WONDERFUL,
        subcategory_id: SUBCATEGORY.ODDITIES_CURIOSITIES,
        source: 'pudding',
      }))
      .filter((r) => r.title);

    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(rows));
    console.log(`[pudding] Cached ${rows.length} rows to ${CACHE_FILE}`);
  }

  console.log(`\n[pudding] Total: ${rows.length} — upserting...`);
  const result = await upsertUrls(rows, { checkLive: true,  fetchOg: false, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
