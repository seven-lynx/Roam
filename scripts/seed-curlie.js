/**
 * seed-curlie.js — Curlie (DMOZ successor) seeder
 *
 * Downloads the Curlie directory dump (~1.2M URLs) from curlie.org
 * and imports with intelligent category mapping to Roam's 8 pillars.
 *
 * Features:
 *   - Persistent progress tracking across crashes/reboots
 *   - Extracts once, caches to JSONL for fast resumption
 *   - Per-batch checkpoint during upsert phase
 *   - Graceful error handling and recovery
 *   - Category mapping based on filename (language/region)
 *
 * Curlie data is free under open source license (CC-BY-SA-4.0).
 * All imported rows are tagged source = 'curlie'.
 *
 * Format: TSV (tab-separated values), tar/gzip compressed.
 * Files: content-*.tsv files (structure files skipped; category mapping by filename).
 *
 * Run from repo root:
 *   node scripts/seed-curlie.js             # resume or start
 *   node scripts/seed-curlie.js --no-cache  # re-download tar.gz
 *   node scripts/seed-curlie.js --reset     # clear progress and start over
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync, createWriteStream, createReadStream, appendFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { extract } from 'tar';
import { config as dotenvConfig } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { upsertUrls, CATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const EXTRACT_DIR = resolve(CACHE_DIR, 'curlie-extracted');
const CACHE_FILE = resolve(CACHE_DIR, 'curlie-rdf-all.tar.gz');
const PROGRESS_FILE = resolve(CACHE_DIR, 'curlie-progress.json');
const EXTRACTED_ROWS_FILE = resolve(CACHE_DIR, 'curlie-extracted-rows.jsonl');
const NO_CACHE   = process.argv.includes('--no-cache');
const RESET      = process.argv.includes('--reset');

// Initialize Supabase client
dotenvConfig({ path: resolve(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const CURLIE_DUMP_URL = 'https://vm-138-246-238-70.cloud.mwn.de:9000/curlie/curlie-rdf-all.tar.gz';
const DELAY_MS = 500;
const BATCH_SIZE = 50;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Curlie category → Roam category mapping ──────────────────────────────────
// Strategy: Curlie uses a hierarchical category structure (e.g., "Top/Computers/Software")
// We map top-level and second-level categories to Roam's 8 pillars.
// Format: { curliePathPrefix, roamCategoryId }

const CATEGORY_MAP = [
  // ─────────────────────────────────────────────────────────────────────────
  // SCIENCE
  // ─────────────────────────────────────────────────────────────────────────
  { prefix: 'Top/Science',                            roamCategoryId: CATEGORY.SCIENCE },

  // ─────────────────────────────────────────────────────────────────────────
  // TECHNOLOGY / COMPUTERS
  // ─────────────────────────────────────────────────────────────────────────
  { prefix: 'Top/Computers',                          roamCategoryId: CATEGORY.TECHNOLOGY },

  // ─────────────────────────────────────────────────────────────────────────
  // ARTS & CULTURE
  // ─────────────────────────────────────────────────────────────────────────
  { prefix: 'Top/Arts',                               roamCategoryId: CATEGORY.ARTS_CULTURE },

  // ─────────────────────────────────────────────────────────────────────────
  // HISTORY & IDEAS / SOCIETY
  // ─────────────────────────────────────────────────────────────────────────
  { prefix: 'Top/Society',                            roamCategoryId: CATEGORY.HISTORY_IDEAS },

  // ─────────────────────────────────────────────────────────────────────────
  // GAMES & HOBBIES / RECREATION
  // ─────────────────────────────────────────────────────────────────────────
  { prefix: 'Top/Recreation',                         roamCategoryId: CATEGORY.GAMES_HOBBIES },
  { prefix: 'Top/Sports',                             roamCategoryId: CATEGORY.GAMES_HOBBIES },

  // ─────────────────────────────────────────────────────────────────────────
  // WEIRD & WONDERFUL (News, crime, paranormal themes)
  // ─────────────────────────────────────────────────────────────────────────
  { prefix: 'Top/News',                               roamCategoryId: CATEGORY.WEIRD_WONDERFUL },

  // ─────────────────────────────────────────────────────────────────────────
  // PEOPLE & PLACES / REGIONAL
  // ─────────────────────────────────────────────────────────────────────────
  { prefix: 'Top/Regional',                           roamCategoryId: CATEGORY.PEOPLE_PLACES },

  // ─────────────────────────────────────────────────────────────────────────
  // MIND & BODY / HEALTH
  // ─────────────────────────────────────────────────────────────────────────
  { prefix: 'Top/Health',                             roamCategoryId: CATEGORY.MIND_BODY },
  { prefix: 'Top/Home',                               roamCategoryId: CATEGORY.MIND_BODY },
];

// ── Progress checkpoint functions ───────────────────────────────────────────

function loadProgress() {
  if (RESET) {
    console.log('[curlie] --reset flag: starting from beginning\n');
    return { phase: 'extraction', extractionComplete: false, upsertComplete: false, upsertedCount: 0, lastBatchNumber: 0, startedAt: new Date().toISOString() };
  }

  if (!existsSync(PROGRESS_FILE)) {
    return { phase: 'extraction', extractionComplete: false, upsertComplete: false, upsertedCount: 0, lastBatchNumber: 0, startedAt: new Date().toISOString() };
  }

  try {
    const data = JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
    console.log(`[curlie] Resuming from checkpoint...`);
    console.log(`[curlie]   Phase: ${data.phase}`);
    console.log(`[curlie]   Extraction complete: ${data.extractionComplete}`);
    console.log(`[curlie]   Upsert complete: ${data.upsertComplete}`);
    if (data.phase === 'upsert') {
      console.log(`[curlie]   Last successful batch: ${data.lastBatchNumber}`);
      console.log(`[curlie]   Total upserted so far: ${data.upsertedCount}\n`);
    }
    return data;
  } catch (err) {
    console.error('[curlie] Failed to parse progress file, starting fresh:', err.message);
    return { phase: 'extraction', extractionComplete: false, upsertComplete: false, upsertedCount: 0, lastBatchNumber: 0, startedAt: new Date().toISOString() };
  }
}

function saveProgress(data) {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }

  const checkpoint = {
    ...data,
    lastUpdated: new Date().toISOString(),
  };

  writeFileSync(PROGRESS_FILE, JSON.stringify(checkpoint, null, 2));
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapCurlieCategory(curliePathFull) {
  if (!curliePathFull) return null;

  for (const { prefix, roamCategoryId } of CATEGORY_MAP) {
    if (curliePathFull === prefix || curliePathFull.startsWith(prefix + '/')) {
      return roamCategoryId;
    }
  }

  return null; // unmapped
}

/**
 * Download Curlie tar.gz dump
 */
async function downloadCurlieDump() {
  console.log(`\n[curlie] Downloading Curlie dump from ${CURLIE_DUMP_URL}...`);
  console.log('[curlie] (File is ~200MB, may take 1-3 minutes...)\n');

  try {
    const res = await fetch(CURLIE_DUMP_URL, {
      headers: {
        'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app; seeder bot)',
      },
      // Longer timeout for large download
      timeout: 5 * 60 * 1000, // 5 minutes
    });

    if (!res.ok) {
      console.error(`[curlie] HTTP ${res.status} downloading dump`);
      return null;
    }

    // Create cache directory if needed
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

    // Save to cache (streaming, not in memory)
    console.log('[curlie] Saving to cache...');
    const file = createWriteStream(CACHE_FILE);
    await pipeline(res.body, file);

    console.log(`[curlie] Saved to ${CACHE_FILE}`);
    return CACHE_FILE;
  } catch (err) {
    console.error('[curlie] Download failed:', err.message);
    return null;
  }
}

/**
 * Extract tar.gz, parse content files directly
 * Map to categories based on filename (which language/region)
 * Streams extracted rows to JSONL file for resumability.
 */
async function extractAndParseTsv() {
  if (!existsSync(CACHE_FILE)) {
    console.error('[curlie] Cache file not found:', CACHE_FILE);
    return [];
  }

  // If extraction was already complete, load from cached JSONL file
  if (existsSync(EXTRACTED_ROWS_FILE)) {
    console.log('[curlie] Loading previously extracted rows from cache...');
    try {
      const rows = [];
      const lines = readFileSync(EXTRACTED_ROWS_FILE, 'utf-8').split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        rows.push(JSON.parse(line));
      }
      console.log(`[curlie] Loaded ${rows.length} rows from extraction cache`);
      return rows;
    } catch (err) {
      console.error('[curlie] Failed to load extraction cache, re-extracting:', err.message);
      // Fall through to re-extract
    }
  }

  console.log('[curlie] Extracting tar.gz...');

  try {
    // Extract to temp directory
    if (!existsSync(EXTRACT_DIR)) mkdirSync(EXTRACT_DIR, { recursive: true });

    await pipeline(
      createReadStream(CACHE_FILE),
      createGunzip(),
      extract({ cwd: EXTRACT_DIR })
    );

    console.log('[curlie] Extracted. Loading file list...');

    const fs = await import('fs/promises');
    const curliePath = resolve(EXTRACT_DIR, 'curlie-rdf');
    
    if (!existsSync(curliePath)) {
      console.error('[curlie] curlie-rdf subdirectory not found');
      return [];
    }

    const files = await fs.readdir(curliePath);
    const contentFiles = files.filter((f) => f.endsWith('-c.tsv'));

    console.log(`[curlie] Found ${contentFiles.length} content files`);

    // ──────────────────────────────────────────────────────────────────────
    // Parse content files directly and map by filename
    // ──────────────────────────────────────────────────────────────────────
    let rowCount = 0;
    const rows = [];

    // Clear any previous extraction cache
    if (existsSync(EXTRACTED_ROWS_FILE)) {
      writeFileSync(EXTRACTED_ROWS_FILE, '');
    }

    // Map filenames to default categories (most generic mapping)
    const filenameToCategory = {
      'rdf-Arts-c.tsv': CATEGORY.ARTS_CULTURE,
      'rdf-Business-c.tsv': CATEGORY.TECHNOLOGY,
      'rdf-Computers-c.tsv': CATEGORY.TECHNOLOGY,
      'rdf-Deutsch-c.tsv': CATEGORY.TECHNOLOGY,  // Default to tech
      'rdf-Europe-c.tsv': CATEGORY.PEOPLE_PLACES,
      'rdf-Français-c.tsv': CATEGORY.TECHNOLOGY,
      'rdf-Italiano-c.tsv': CATEGORY.TECHNOLOGY,
      'rdf-Japanese-c.tsv': CATEGORY.TECHNOLOGY,
      'rdf-KT-c.tsv': CATEGORY.GAMES_HOBBIES,
      'rdf-NorthAmerica-c.tsv': CATEGORY.PEOPLE_PLACES,
      'rdf-Regional-c.tsv': CATEGORY.PEOPLE_PLACES,
      'rdf-Society-c.tsv': CATEGORY.HISTORY_IDEAS,
      'rdf-Top-c.tsv': CATEGORY.SCIENCE,  // Miscellaneous
      'rdf-World-c.tsv': CATEGORY.PEOPLE_PLACES,
      'rdf-Adult-c.tsv': null,  // Skip adult content
    };

    for (const file of contentFiles) {
      const categoryId = filenameToCategory[file];
      if (!categoryId) {
        console.log(`[curlie] Skipping ${file} (no category mapping)`);
        continue;
      }

      console.log(`[curlie] Parsing content: ${file}...`);
      const filePath = resolve(curliePath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        // Content file format: url \t title \t description \t categoryId
        const parts = line.split('\t');
        if (parts.length < 1) continue;

        const url = parts[0]?.trim();

        // Validate URL
        if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) continue;

        // Clean strings: remove only control characters that break line-based parsing
        const cleanString = (str) => {
          if (!str) return null;
          return str
            .replace(/[\n\r\x00-\x1f\x7f]/g, '')  // Remove all control characters including newlines
            .trim();
        };

        const title = cleanString(parts[1]) || null;
        const description = cleanString(parts[2]) || null;
        const cleanUrl = cleanString(url);

        if (!cleanUrl) continue;  // Skip if URL becomes empty after cleaning

        const row = {
          url: cleanUrl,
          title,
          description,
          category_id: categoryId,
          source: 'curlie',
        };

        try {
          // JSON.stringify handles all escaping automatically
          const jsonStr = JSON.stringify(row);
          appendFileSync(EXTRACTED_ROWS_FILE, jsonStr + '\n');
        } catch (err) {
          // Skip rows that can't be serialized to JSON
          continue;
        }
        rows.push(row);
        rowCount++;
      }

      if (rowCount % 10000 === 0) {
        console.log(`[curlie]   Total extracted so far: ${rowCount}`);
      }
    }

    console.log(`[curlie] Extraction complete: ${rowCount} URLs extracted and cached`);
    return rows;
  } catch (err) {
    console.error('[curlie] Extraction/parsing failed:', err.message);
    console.error(err);
    return [];
  }
}

/**
 * Upsert URLs from JSONL file with per-batch checkpointing for resumability.
 * Streams the file line-by-line to avoid loading entire file into memory.
 */
async function upsertUrlsWithProgressStreaming(jsonlFile, progress) {
  const readline = await import('readline');
  const fs = await import('fs');

  let inserted = 0;
  let skipped = 0;
  let batchNumber = 0;
  let currentBatch = [];

  const rl = readline.createInterface({
    input: fs.createReadStream(jsonlFile),
    crlfDelay: Infinity,
  });

  const startBatch = progress.lastBatchNumber;

  let badLines = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;

    let row;
    try {
      row = JSON.parse(line);
    } catch (err) {
      badLines++;
      console.warn(`[curlie] Skipping malformed JSON line (${err.message}): ${line.slice(0, 80)}...`);
      continue;
    }

    // Normalise URL
    const normalisedUrl = normaliseUrl(row.url);
    if (!normalisedUrl) continue;

    row.url = normalisedUrl;
    currentBatch.push(row);

    // When batch is full, process it
    if (currentBatch.length === BATCH_SIZE) {
      batchNumber++;

      // Skip already-processed batches on resume
      if (batchNumber <= startBatch) {
        if (batchNumber % 1000 === 0) {
          console.log(`[curlie] Fast-forwarding... (batch ${batchNumber} / ${startBatch})`);
        }
        currentBatch = [];
        continue;
      }

      // Upsert this batch
      const batchResult = await upsertBatch(currentBatch, batchNumber, progress);
      inserted += batchResult.inserted;
      skipped += batchResult.skipped;
      currentBatch = [];
    }
  }

  // Process remaining rows in final batch
  if (currentBatch.length > 0) {
    batchNumber++;

    if (batchNumber > startBatch) {
      const batchResult = await upsertBatch(currentBatch, batchNumber, progress);
      inserted += batchResult.inserted;
      skipped += batchResult.skipped;
    }
  }

  if (badLines > 0) console.warn(`[curlie] Skipped ${badLines} malformed JSON lines total`);
  return { inserted, skipped };
}

/**
 * Upsert a single batch of rows — retries up to 5 times on transient errors
 */
async function upsertBatch(rows, batchNumber, progress) {
  // Map to Supabase schema — no pre-check needed, upsert handles duplicates via ignoreDuplicates
  const batch = rows.map((r) => ({
    url:            r.url,
    original_url:   r.url,
    title:          r.title        ?? null,
    description:    r.description  ?? null,
    og_image_url:   r.og_image_url ?? null,
    category_id:    r.category_id  ?? null,
    subcategory_id: r.subcategory_id ?? null,
    source:         r.source       ?? 'curlie',
    approved:       true,
    wilson_score:   0,
    upvotes:        0,
    downvotes:      0,
  }));

  // Retry up to 5 times with exponential backoff for transient errors
  const MAX_RETRIES = 5;
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const { error, count } = await supabase
      .from('urls')
      .upsert(batch, { onConflict: 'url', ignoreDuplicates: true })
      .select('id', { count: 'exact', head: true });

    if (!error) {
      const result = { inserted: count ?? batch.length, skipped: 0 };
      console.log(`[curlie] Batch ${batchNumber}: upserted ${batch.length} rows`);

      // Save checkpoint after each successful batch
      progress.phase = 'upsert';
      progress.lastBatchNumber = batchNumber;
      progress.upsertedCount = (progress.upsertedCount || 0) + (count ?? batch.length);
      saveProgress(progress);

      return result;
    }

    lastError = error;
    const delay = attempt * 5000; // 5s, 10s, 15s, 20s, 25s
    console.warn(`[curlie] Batch ${batchNumber} attempt ${attempt}/${MAX_RETRIES} failed: ${error.message} — retrying in ${delay / 1000}s`);
    await new Promise((r) => setTimeout(r, delay));
  }

  console.error(`[curlie] Batch ${batchNumber} permanently failed after ${MAX_RETRIES} attempts: ${lastError.message} — skipping`);
  return { inserted: 0, skipped: rows.length };
}


/**
 * Normalise URL (copied from lib/seed.js to maintain consistency)
 */
function normaliseUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    url.protocol = 'https:';
    
    // Strip www
    let hostname = url.hostname;
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }
    url.hostname = hostname;

    // Strip tracking params
    const TRACKING_PARAMS = new Set([
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'utm_id', 'utm_reader', 'utm_name', 'utm_brand',
      'fbclid', 'gclid', 'msclkid', 'dclid', 'zanpid', 'igshid',
      'mc_cid', 'mc_eid', 'ref', 'referrer', '_ga', 'twclid',
      'yclid', 's_cid', 'ncid', 'nr_email_referer',
    ]);
    Array.from(url.searchParams.keys()).forEach((key) => {
      if (TRACKING_PARAMS.has(key)) {
        url.searchParams.delete(key);
      }
    });

    url.hash = '';
    const normalised = url.href.replace(/\/$/, '').toLowerCase();
    return normalised;
  } catch {
    return null;
  }
}

async function loadCurlieData() {
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    console.log(`[curlie] Using cached dump: ${CACHE_FILE}`);
    const rows = await extractAndParseTsv();
    return rows;
  }

  const cachePath = await downloadCurlieDump();
  if (!cachePath) return [];

  const rows = await extractAndParseTsv();
  return rows;
}

/**
 * Main seeder function
 */
async function seedCurlie() {
  console.log('\n========== Curlie Seeder (with resumable checkpoints) ==========\n');

  // Load progress checkpoint
  let progress = loadProgress();

  // Phase 1: Extraction
  if (!progress.extractionComplete) {
    console.log('[curlie] Starting extraction phase...\n');
    const rows = await loadCurlieData();
    
    if (!rows || rows.length === 0) {
      console.error('[curlie] Failed to load data. Exiting.');
      process.exit(1);
    }

    console.log(`[curlie] Extraction complete: ${rows.length} URLs extracted and cached`);
    
    // Update progress
    progress.phase = 'extraction_complete';
    progress.extractionComplete = true;
    progress.extractedCount = rows.length;
    saveProgress(progress);
    console.log('[curlie] Progress checkpoint saved.\n');
  } else {
    console.log('[curlie] Extraction already complete, skipping to upsert phase.\n');
  }

  // Phase 2: Upsert
  if (!progress.upsertComplete) {
    console.log('[curlie] Starting upsert phase...');
    console.log(`[curlie] (Resuming from batch ${progress.lastBatchNumber})\n`);

    try {
      const result = await upsertUrlsWithProgressStreaming(EXTRACTED_ROWS_FILE, progress);
      
      console.log(`\n[curlie] Upsert phase complete.`);
      console.log(`        Inserted: ${result.inserted}`);
      console.log(`        Skipped:  ${result.skipped}`);
      console.log(`        Total Curlie URLs in system: ~${result.inserted + result.skipped}`);
      
      // Mark as complete
      progress.phase = 'complete';
      progress.upsertComplete = true;
      saveProgress(progress);
    } catch (err) {
      console.error(`[curlie] Upsert failed: ${err.message}`);
      console.error('[curlie] Progress saved. Run again to resume from checkpoint.');
      process.exit(1);
    }
  } else {
    console.log('[curlie] Upsert already complete!\n');
  }

  console.log('[curlie] ✅ All tagged as source = "curlie" for identification\n');
  console.log(`[curlie] 🎉 Curlie seeding complete!\n`);
}

// ── Run seeder ───────────────────────────────────────────────────────────────

seedCurlie().catch((err) => {
  console.error('[curlie] Fatal error:', err.message);
  console.error(err);
  process.exit(1);
});

