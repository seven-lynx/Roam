/**
 * seed-curlie.js — Curlie (DMOZ successor) seeder
 *
 * Downloads the Curlie directory dump (2.9M URLs) from curlie.org
 * and imports with intelligent category mapping to Roam's 8 pillars.
 *
 * Curlie data is free under open source license (CC-BY-SA-4.0).
 * All imported rows are tagged source = 'curlie'.
 *
 * Format: TSV (tab-separated values), tar/gzip compressed.
 * Files: categories-*.tsv, content-*.tsv with matching category IDs.
 *
 * Run from repo root:
 *   node scripts/seed-curlie.js
 *   node scripts/seed-curlie.js --no-cache    # re-download
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync, createWriteStream, createReadStream } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { extract } from 'tar';
import { upsertUrls, CATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const EXTRACT_DIR = resolve(CACHE_DIR, 'curlie-extracted');
const CACHE_FILE = resolve(CACHE_DIR, 'curlie-rdf-all.tar.gz');
const NO_CACHE   = process.argv.includes('--no-cache');

const CURLIE_DUMP_URL = 'https://vm-138-246-238-70.cloud.mwn.de:9000/curlie/curlie-rdf-all.tar.gz';
const DELAY_MS = 500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Curlie category → Roam category mapping ──────────────────────────────────
// Strategy: Curlie uses a hierarchical category structure (e.g., "Top/Computers/Software")
// We map top-level and second-level categories to Roam's 8 pillars.
// Format: { curliePathPrefix, roamCategoryId }

const CATEGORY_MAP = [
  // ─────────────────────────────────────────────────────────────────────────
  // SCIENCE
  // ─────────────────────────────────────────────────────────────────────────
  { prefix: 'Science',                                roamCategoryId: CATEGORY.SCIENCE },

  // ─────────────────────────────────────────────────────────────────────────
  // TECHNOLOGY / COMPUTERS
  // ─────────────────────────────────────────────────────────────────────────
  { prefix: 'Computers',                              roamCategoryId: CATEGORY.TECHNOLOGY },

  // ─────────────────────────────────────────────────────────────────────────
  // ARTS & CULTURE
  // ─────────────────────────────────────────────────────────────────────────
  { prefix: 'Arts',                                   roamCategoryId: CATEGORY.ARTS_CULTURE },

  // ─────────────────────────────────────────────────────────────────────────
  // HISTORY & IDEAS / SOCIETY
  // ─────────────────────────────────────────────────────────────────────────
  { prefix: 'Society',                                roamCategoryId: CATEGORY.HISTORY_IDEAS },

  // ─────────────────────────────────────────────────────────────────────────
  // GAMES & HOBBIES / RECREATION
  // ─────────────────────────────────────────────────────────────────────────
  { prefix: 'Recreation',                             roamCategoryId: CATEGORY.GAMES_HOBBIES },
  { prefix: 'Sports',                                 roamCategoryId: CATEGORY.GAMES_HOBBIES },

  // ─────────────────────────────────────────────────────────────────────────
  // WEIRD & WONDERFUL (News, crime, paranormal themes)
  // ─────────────────────────────────────────────────────────────────────────
  { prefix: 'News',                                   roamCategoryId: CATEGORY.WEIRD_WONDERFUL },

  // ─────────────────────────────────────────────────────────────────────────
  // PEOPLE & PLACES / REGIONAL
  // ─────────────────────────────────────────────────────────────────────────
  { prefix: 'Regional',                               roamCategoryId: CATEGORY.PEOPLE_PLACES },

  // ─────────────────────────────────────────────────────────────────────────
  // MIND & BODY / HEALTH
  // ─────────────────────────────────────────────────────────────────────────
  { prefix: 'Health',                                 roamCategoryId: CATEGORY.MIND_BODY },
  { prefix: 'Home',                                   roamCategoryId: CATEGORY.MIND_BODY },
];

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
 * Extract tar.gz, parse structure (ID→path), then parse content (URL entries)
 */
async function extractAndParseTsv() {
  if (!existsSync(CACHE_FILE)) {
    console.error('[curlie] Cache file not found:', CACHE_FILE);
    return [];
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
    const structureFiles = files.filter((f) => f.endsWith('-s.tsv'));
    const contentFiles = files.filter((f) => f.endsWith('-c.tsv'));

    console.log(`[curlie] Found ${structureFiles.length} structure files and ${contentFiles.length} content files`);

    // ──────────────────────────────────────────────────────────────────────
    // Step 1: Build categoryId → fullPath mapping from structure files
    // ──────────────────────────────────────────────────────────────────────
    const categoryMap = new Map(); // categoryId → fullPath (e.g., "123456" → "Top/Science")

    for (const file of structureFiles) {
      console.log(`[curlie] Parsing structure: ${file}...`);
      const filePath = resolve(curliePath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        // Structure file format: id \t description \t fullPath
        const parts = line.split('\t');
        if (parts.length < 3) continue;

        const id = parts[0]?.trim();
        const fullPath = parts[1]?.trim();

        if (id && fullPath) {
          categoryMap.set(id, fullPath);
        }
      }
    }

    console.log(`[curlie] Built map of ${categoryMap.size} category IDs → paths`);

    // ──────────────────────────────────────────────────────────────────────
    // Step 2: Parse content files using the category map
    // ──────────────────────────────────────────────────────────────────────
    const rows = [];

    for (const file of contentFiles) {
      console.log(`[curlie] Parsing content: ${file}...`);
      const filePath = resolve(curliePath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        // Content file format: url \t title \t description \t categoryId
        const parts = line.split('\t');
        if (parts.length < 4) continue;

        const url = parts[0]?.trim();
        const title = parts[1]?.trim();
        const description = parts[1]?.trim();
        const categoryId = parts[3]?.trim();

        // Validate URL
        if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) continue;

        // Look up the category path from the ID
        const categoryPath = categoryMap.get(categoryId);
        if (!categoryPath) continue;

        // Map Curlie path to Roam category
        const roamCategoryId = mapCurlieCategory(categoryPath);
        if (!roamCategoryId) continue; // Unmapped category

        rows.push({
          url,
          title: title || null,
          description: description || null,
          category_id: roamCategoryId,
          source: 'curlie',
        });
      }

      if (rows.length % 1000 === 0) {
        console.log(`[curlie]   Total extracted so far: ${rows.length}`);
      }
    }

    return rows;
  } catch (err) {
    console.error('[curlie] Extraction/parsing failed:', err.message);
    console.error(err);
    return [];
  }
}

/**
 * Load Curlie data from cache or download
 */
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
  console.log('\n========== Curlie Seeder ==========\n');

  // Load or download TSV data
  const rows = await loadCurlieData();
  if (!rows || rows.length === 0) {
    console.error('[curlie] Failed to load data. Exiting.');
    process.exit(1);
  }

  console.log(`[curlie] Extracted ${rows.length} URLs with mapped categories`);

  // Upsert to database (skip OG fetching — Curlie data already has good descriptions)
  console.log('[curlie] Upserting to database...');
  const result = await upsertUrls(rows, { fetchOg: false, verbose: true });

  console.log(`\n[curlie] Complete.`);
  console.log(`        Inserted: ${result.inserted}`);
  console.log(`        Skipped:  ${result.skipped}`);
  console.log(`\n        Total Curlie URLs in system: ~${result.inserted + result.skipped}`);
  console.log(`        All tagged as source = 'curlie' for identification\n`);
}

// ── Run seeder ───────────────────────────────────────────────────────────────

seedCurlie().catch((err) => {
  console.error('[curlie] Fatal error:', err.message);
  process.exit(1);
});

