/**
 * backfill-og-metadata.mjs — Backfill missing OG metadata for pooled URLs
 *
 * Finds approved, active URLs where og_image_url IS NULL or description IS NULL
 * (or language IS NULL), fetches OG metadata for each, and updates only the
 * columns that are currently null — never overwrites existing data.
 *
 * Usage (from repo root)
 * ──────────────────────
 *   node scripts/backfill-og-metadata.mjs                  # dry run, all sources
 *   node scripts/backfill-og-metadata.mjs --commit         # write to DB
 *   node scripts/backfill-og-metadata.mjs --source curlie  # scope to one source
 *   node scripts/backfill-og-metadata.mjs --no-resume      # start from scratch
 *   node scripts/backfill-og-metadata.mjs --rps 5          # raise req/s (default 2)
 *   node scripts/backfill-og-metadata.mjs --concurrency 8  # parallel fetches (default 4)
 *
 * Estimated scope: ~30–40% of pooled URLs have missing metadata.
 * At 2 req/s this will take many hours — run per source in stages.
 * Recommended first target: --source curlie (largest structured corpus).
 *
 * Checkpoint is saved to .cache/backfill-og-progress.json after every batch.
 * If interrupted, re-running without --no-resume picks up where it left off.
 *
 * Requires: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in root .env
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { config as dotenvConfig } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fetchOgMeta } from './lib/seed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../.env') });

// ── CLI args ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);

const COMMIT    = argv.includes('--commit');
const NO_RESUME = argv.includes('--no-resume');

const sourceIdx = argv.indexOf('--source');
const SOURCE_FILTER = sourceIdx >= 0 ? argv[sourceIdx + 1] : null;

const rpsIdx = argv.indexOf('--rps');
const RPS = rpsIdx >= 0 ? Math.max(1, parseFloat(argv[rpsIdx + 1])) : 2;
const DELAY_MS = Math.ceil(1000 / RPS);

const concurrencyIdx = argv.indexOf('--concurrency');
const CONCURRENCY = concurrencyIdx >= 0 ? Math.max(1, parseInt(argv[concurrencyIdx + 1], 10)) : 4;

const PAGE_SIZE    = 500;
const DB_BATCH_SIZE = 100; // rows per UPDATE call

// ── Checkpoint ────────────────────────────────────────────────────────────────
const CACHE_DIR         = resolve(__dirname, '.cache');
const CHECKPOINT_FILE   = resolve(CACHE_DIR, 'backfill-og-progress.json');

function loadCheckpoint() {
  if (NO_RESUME || !existsSync(CHECKPOINT_FILE)) return { lastId: null, processed: 0, updated: 0 };
  try { return JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8')); } catch { return { lastId: null, processed: 0, updated: 0 }; }
}

function saveCheckpoint(cp) {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2));
}

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ── Fetch one page of URLs needing OG backfill ────────────────────────────────
async function fetchBatch(afterId) {
  let query = supabase
    .from('urls')
    .select('id, url, og_image_url, description, language')
    .eq('approved', true)
    .eq('inactive', false)
    .or('og_image_url.is.null,description.is.null,language.is.null')
    .order('id', { ascending: true })
    .limit(PAGE_SIZE);

  if (SOURCE_FILTER) query = query.eq('source', SOURCE_FILTER);
  if (afterId)       query = query.gt('id', afterId);

  const { data, error } = await query;
  if (error) throw new Error(`Supabase query failed: ${error.message}`);
  return data ?? [];
}

// ── Apply DB updates for a batch of filled rows ───────────────────────────────
async function applyUpdates(updates) {
  // updates = [{ id, og_image_url?, description?, language? }]
  // Process in DB_BATCH_SIZE chunks; each row needs an individual update because
  // Supabase .update() applies the same values to all matched rows.
  let count = 0;
  for (const row of updates) {
    const { id, ...fields } = row;
    const { error } = await supabase.from('urls').update(fields).eq('id', id);
    if (error) {
      console.warn(`\n  [backfill] Update failed for ${id}: ${error.message}`);
    } else {
      count++;
    }
  }
  return count;
}

// ── Bounded concurrency pool ──────────────────────────────────────────────────
async function runWithConcurrency(items, fn, concurrency) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

// ── Per-domain rate limiter ───────────────────────────────────────────────────
const domainLastMs = new Map();

async function rateLimitedFetch(url) {
  let hostname;
  try { hostname = new URL(url).hostname; } catch { hostname = url; }
  const now  = Date.now();
  const last = domainLastMs.get(hostname) ?? 0;
  const gap  = DELAY_MS - (now - last);
  if (gap > 0) await new Promise((r) => setTimeout(r, gap));
  domainLastMs.set(hostname, Date.now());
  return fetchOgMeta(url);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  }

  console.log('=== Roam OG metadata backfill ===');
  console.log(`  Mode:        ${COMMIT ? 'COMMIT (writes to DB)' : 'DRY RUN (no writes)'}`);
  if (SOURCE_FILTER) console.log(`  Source:      ${SOURCE_FILTER}`);
  console.log(`  Rate:        ${RPS} req/s`);
  console.log(`  Concurrency: ${CONCURRENCY}\n`);

  if (!COMMIT) {
    console.log('  ⚠  DRY RUN — pass --commit to write changes to the database.\n');
  }

  const cp = loadCheckpoint();
  if (cp.lastId && !NO_RESUME) {
    console.log(`  Resuming from checkpoint: processed=${cp.processed}, updated=${cp.updated}\n`);
  }

  let { lastId, processed, updated } = cp;
  let batchNum = 0;

  while (true) {
    const batch = await fetchBatch(lastId);
    if (batch.length === 0) break;
    batchNum++;

    process.stdout.write(
      `\r[backfill] batch ${batchNum}  fetched=${batch.length}  processed=${processed}  updated=${updated}  `,
    );

    // Fetch OG metadata in parallel with bounded concurrency
    const metaResults = await runWithConcurrency(
      batch,
      async (row) => {
        const meta = await rateLimitedFetch(row.url);
        return { row, meta };
      },
      CONCURRENCY,
    );

    // Build list of DB updates — only fill in null columns
    const updates = [];
    for (const { row, meta } of metaResults) {
      const patch = {};
      if (!row.og_image_url && meta.image)       patch.og_image_url = meta.image;
      if (!row.description  && meta.description) patch.description  = meta.description;
      if (!row.language     && meta.language)    patch.language     = meta.language;

      if (Object.keys(patch).length > 0) {
        updates.push({ id: row.id, ...patch });
      }
    }

    if (COMMIT && updates.length > 0) {
      const wrote = await applyUpdates(updates);
      updated += wrote;
    } else {
      updated += updates.length; // count in dry-run for reporting
    }

    lastId    = batch[batch.length - 1].id;
    processed += batch.length;
    saveCheckpoint({ lastId, processed, updated });
  }

  console.log(`\n\n=== Backfill complete ===`);
  console.log(`  Processed: ${processed} URLs`);
  console.log(`  Updated:   ${updated} rows had at least one field filled`);
  if (!COMMIT && updated > 0) {
    console.log(`\n  Re-run with --commit to write these ${updated} updates to the database.`);
  }
  if (COMMIT) {
    // Clear checkpoint on successful full run
    writeFileSync(CHECKPOINT_FILE, JSON.stringify({ lastId: null, processed: 0, updated: 0 }, null, 2));
  }
}

main().catch((err) => {
  console.error('\n[backfill] Fatal error:', err.message);
  process.exit(1);
});
