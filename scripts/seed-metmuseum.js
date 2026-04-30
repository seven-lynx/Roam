/**
 * seed-metmuseum.js — Metropolitan Museum of Art seeder
 *
 * Pulls artwork records from the Met's public API (no key required).
 * Only includes objects with public-domain images (primaryImageSmall).
 *
 * Strategy:
 *  1. Per department: fetch all object IDs from /objects?departmentIds=X
 *  2. Randomly sample up to maxItems IDs per department
 *  3. Fetch each object record concurrently (10 at a time)
 *  4. Skip objects with no image; build description from artist/date/medium
 *  5. Upsert to Supabase
 *
 * API: https://metmuseum.github.io/ — limit: 80 req/s
 * License: CC0 (public domain dataset)
 *
 * Run from repo root:
 *   node scripts/seed-metmuseum.js
 *   node scripts/seed-metmuseum.js --no-cache   # re-fetch all IDs
 *   node scripts/seed-metmuseum.js --reset       # clear checkpoint and restart
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY } from './lib/seed.js';

const __dirname       = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR       = resolve(__dirname, '.cache');
const IDS_CACHE_FILE  = resolve(CACHE_DIR, 'metmuseum-ids.json');
const PROGRESS_FILE   = resolve(CACHE_DIR, 'metmuseum-progress.json');
const NO_CACHE        = process.argv.includes('--no-cache');
const RESET           = process.argv.includes('--reset');

const BASE_URL        = 'https://collectionapi.metmuseum.org/public/collection/v1';
const CONCURRENCY     = 1;    // sequential — Met API silently rate-limits concurrent bursts
const CHECKPOINT_EVERY = 500; // save progress every N objects
const DELAY_MS        = 120;  // ~8 req/s — comfortably under the 80/s limit

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(CACHE_DIR, { recursive: true });

// ── Department → Roam category mapping ───────────────────────────────────────
// maxItems: how many IDs to sample from that department (randomly shuffled)
const DEPARTMENTS = [
  // Arts & Culture
  { id: 11, name: 'European Paintings',               cat: CATEGORY.ARTS_CULTURE,  maxItems: 5000 },
  { id: 12, name: 'European Sculpture & Dec. Arts',   cat: CATEGORY.ARTS_CULTURE,  maxItems: 3000 },
  { id:  9, name: 'Drawings and Prints',              cat: CATEGORY.ARTS_CULTURE,  maxItems: 3000 },
  { id: 19, name: 'Photographs',                      cat: CATEGORY.ARTS_CULTURE,  maxItems: 3000 },
  { id: 21, name: 'Modern Art',                       cat: CATEGORY.ARTS_CULTURE,  maxItems: 3000 },
  { id:  8, name: 'The Costume Institute',            cat: CATEGORY.ARTS_CULTURE,  maxItems: 1000 },
  { id:  1, name: 'American Decorative Arts',         cat: CATEGORY.ARTS_CULTURE,  maxItems: 2000 },
  { id: 18, name: 'Musical Instruments',              cat: CATEGORY.ARTS_CULTURE,  maxItems: 1000 },
  { id: 15, name: 'Robert Lehman Collection',         cat: CATEGORY.ARTS_CULTURE,  maxItems: 2000 },
  // History & Ideas
  { id: 10, name: 'Egyptian Art',                     cat: CATEGORY.HISTORY_IDEAS, maxItems: 3000 },
  { id: 13, name: 'Greek and Roman Art',              cat: CATEGORY.HISTORY_IDEAS, maxItems: 3000 },
  { id: 17, name: 'Medieval Art',                     cat: CATEGORY.HISTORY_IDEAS, maxItems: 2000 },
  { id:  3, name: 'Ancient Near Eastern Art',         cat: CATEGORY.HISTORY_IDEAS, maxItems: 2000 },
  { id:  7, name: 'The Cloisters',                    cat: CATEGORY.HISTORY_IDEAS, maxItems: 1000 },
  { id:  4, name: 'Arms and Armor',                   cat: CATEGORY.HISTORY_IDEAS, maxItems: 1000 },
  { id: 14, name: 'Islamic Art',                      cat: CATEGORY.HISTORY_IDEAS, maxItems: 2000 },
  // People & Places
  { id:  6, name: 'Asian Art',                        cat: CATEGORY.PEOPLE_PLACES, maxItems: 3000 },
  { id:  5, name: 'Arts of Africa, Oceania & Americas', cat: CATEGORY.PEOPLE_PLACES, maxItems: 2000 },
];

// ── Fisher-Yates shuffle (in-place) ──────────────────────────────────────────
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Fetch all object IDs for a department (images only) ──────────────────────
// Uses the search endpoint with hasImages=true to avoid fetching non-public objects
async function fetchDeptIds(deptId) {
  // q=a matches virtually every record (nearly all have "a" somewhere in metadata)
  const url = `${BASE_URL}/search?hasImages=true&departmentId=${deptId}&q=a`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Roam-Seeder/1.0 (+https://roamtheweb.app)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for dept ${deptId}`);
  const data = await res.json();
  return data.objectIDs ?? [];
}

// ── Fetch a single object record ──────────────────────────────────────────────
async function fetchObject(id) {
  try {
    const res = await fetch(`${BASE_URL}/objects/${id}`, {
      headers: { 'User-Agent': 'Roam-Seeder/1.0 (+https://roamtheweb.app)' },
    });
    if (res.status === 429) throw new Error('rate limited');
    if (!res.ok) { fetchObject.errors = (fetchObject.errors ?? 0) + 1; return null; }
    return await res.json();
  } catch (err) {
    if (err.message === 'rate limited') {
      console.warn('[met] Rate limited — pausing 10s...');
      await sleep(10000);
    }
    fetchObject.errors = (fetchObject.errors ?? 0) + 1;
    return null;
  }
}

// ── Build a human-readable description from Met object fields ─────────────────
function buildDescription(obj) {
  const parts = [];
  if (obj.artistDisplayName) {
    const bio = obj.artistDisplayBio ? ` (${obj.artistDisplayBio})` : '';
    parts.push(`${obj.artistDisplayName}${bio}`);
  } else if (obj.culture) {
    parts.push(obj.culture);
  }
  if (obj.objectDate) parts.push(obj.objectDate);
  if (obj.medium)     parts.push(obj.medium);
  return parts.join(' · ').slice(0, 500) || null;
}

// ── Phase 1: collect IDs across all departments ───────────────────────────────
async function collectIds() {
  const plan = []; // [{ id, categoryId }]
  console.log('[met] Phase 1: fetching object IDs per department...');

  for (const dept of DEPARTMENTS) {
    process.stdout.write(`[met]   dept ${dept.id} (${dept.name})... `);
    try {
      const allIds = await fetchDeptIds(dept.id);
      shuffle(allIds);
      const sampled = allIds.slice(0, dept.maxItems);
      for (const id of sampled) plan.push({ id, categoryId: dept.cat });
      console.log(`${allIds.length} total → sampling ${sampled.length}`);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
    }
    await sleep(200); // small polite delay between dept requests
  }

  console.log(`[met] Phase 1 done: ${plan.length} IDs queued`);
  return plan;
}

// ── Phase 2: fetch object metadata concurrently ───────────────────────────────
async function fetchMetadata(plan, startIdx, existingRows) {
  const rows = [...existingRows];
  let processed = startIdx;

  console.log(`[met] Phase 2: fetching metadata (${plan.length - startIdx} remaining)...`);

  for (let i = startIdx; i < plan.length; i += CONCURRENCY) {
    const batch = plan.slice(i, i + CONCURRENCY);

    const results = await Promise.all(
      batch.map(({ id, categoryId }) =>
        fetchObject(id).then((obj) => ({ obj, categoryId }))
      )
    );

    for (const { obj, categoryId } of results) {
      if (!obj) continue;
      // Skip objects with no public-domain image
      if (!obj.primaryImageSmall) continue;

      rows.push({
        url:          obj.objectURL,
        title:        obj.title?.slice(0, 255) ?? null,
        description:  buildDescription(obj),
        og_image_url: obj.primaryImageSmall,
        category_id:  categoryId,
        source:       'metmuseum',
      });
    }

    processed += batch.length;

    if (processed % CHECKPOINT_EVERY === 0 || processed >= plan.length) {
      const errors = fetchObject.errors ?? 0;
      writeFileSync(PROGRESS_FILE, JSON.stringify({ processedIdx: processed, rows }));
      console.log(`[met]   ${processed} / ${plan.length} processed — ${rows.length} with images${errors ? ` (${errors} errors)` : ''}`);
    }

    await sleep(DELAY_MS);
  }

  return rows;
}

// ── Load / save checkpoint ─────────────────────────────────────────────────────
function loadProgress() {
  if (RESET || !existsSync(PROGRESS_FILE)) return { processedIdx: 0, rows: [] };
  try {
    return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8'));
  } catch {
    return { processedIdx: 0, rows: [] };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n========== Met Museum Seeder ==========\n');

  // ── Phase 1: get object ID plan ──
  let plan;
  if (!NO_CACHE && !RESET && existsSync(IDS_CACHE_FILE)) {
    plan = JSON.parse(readFileSync(IDS_CACHE_FILE, 'utf8'));
    console.log(`[met] Loaded ${plan.length} IDs from cache`);
  } else {
    plan = await collectIds();
    writeFileSync(IDS_CACHE_FILE, JSON.stringify(plan));
    console.log(`[met] Cached ${plan.length} IDs`);
  }

  // ── Phase 2: fetch metadata (resumable) ──
  const { processedIdx, rows: savedRows } = loadProgress();
  if (processedIdx > 0) {
    console.log(`[met] Resuming from index ${processedIdx} (${savedRows.length} rows already fetched)`);
  }

  const rows = await fetchMetadata(plan, processedIdx, savedRows);
  console.log(`\n[met] Fetch complete: ${rows.length} artworks with images`);

  // ── Phase 3: upsert ──
  console.log('[met] Upserting to Supabase...');
  const result = await upsertUrls(rows, { fetchOg: false, verbose: false });
  console.log(`\n[met] Done — ${result.inserted} inserted, ${result.skipped} skipped`);

  // Clear checkpoint on success
  writeFileSync(PROGRESS_FILE, JSON.stringify({ complete: true, total: rows.length }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
