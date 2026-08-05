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
import { upsertUrls, CATEGORY, SUBCATEGORY } from './lib/seed.js';

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
// Strategy: match the longest prefix first (most specific → least specific).
// Format: { prefix, roamCategoryId, roamSubcategoryId }
// Entries are ordered longest-first within each pillar so the loop short-circuits
// at the right level. mapCurlieCategory() iterates in order and returns on first match.

const CATEGORY_MAP = [
  // ─────────────────────────────────────────────────────────────────────────
  // SCIENCE — second-level paths first
  // ─────────────────────────────────────────────────────────────────────────
  { prefix: 'Top/Science/Astronomy',        roamCategoryId: CATEGORY.SCIENCE, roamSubcategoryId: SUBCATEGORY.SPACE_ASTRONOMY },
  { prefix: 'Top/Science/Biology',          roamCategoryId: CATEGORY.SCIENCE, roamSubcategoryId: SUBCATEGORY.BIOLOGY_EVOLUTION },
  { prefix: 'Top/Science/Evolution',        roamCategoryId: CATEGORY.SCIENCE, roamSubcategoryId: SUBCATEGORY.BIOLOGY_EVOLUTION },
  { prefix: 'Top/Science/Physics',          roamCategoryId: CATEGORY.SCIENCE, roamSubcategoryId: SUBCATEGORY.PHYSICS_CHEMISTRY },
  { prefix: 'Top/Science/Chemistry',        roamCategoryId: CATEGORY.SCIENCE, roamSubcategoryId: SUBCATEGORY.PHYSICS_CHEMISTRY },
  { prefix: 'Top/Science/Earth_Sciences',   roamCategoryId: CATEGORY.SCIENCE, roamSubcategoryId: SUBCATEGORY.GEOLOGY_EARTH_SCIENCE },
  { prefix: 'Top/Science/Environment',      roamCategoryId: CATEGORY.SCIENCE, roamSubcategoryId: SUBCATEGORY.ENVIRONMENT_CLIMATE },
  { prefix: 'Top/Science/Math',             roamCategoryId: CATEGORY.SCIENCE, roamSubcategoryId: SUBCATEGORY.MATHEMATICS_LOGIC },
  { prefix: 'Top/Science/Math_and_Statistics', roamCategoryId: CATEGORY.SCIENCE, roamSubcategoryId: SUBCATEGORY.MATHEMATICS_LOGIC },
  { prefix: 'Top/Science/Medicine',         roamCategoryId: CATEGORY.SCIENCE, roamSubcategoryId: SUBCATEGORY.MEDICINE_HEALTH_SCIENCE },
  { prefix: 'Top/Science/Paleontology',     roamCategoryId: CATEGORY.SCIENCE, roamSubcategoryId: SUBCATEGORY.PALEONTOLOGY_NATURAL_HISTORY },
  { prefix: 'Top/Science/Oceans',           roamCategoryId: CATEGORY.SCIENCE, roamSubcategoryId: SUBCATEGORY.OCEANOGRAPHY_MARINE_LIFE },
  // Top-level Science fallback
  { prefix: 'Top/Science',                  roamCategoryId: CATEGORY.SCIENCE, roamSubcategoryId: null },

  // ─────────────────────────────────────────────────────────────────────────
  // TECHNOLOGY — second-level paths first
  // ─────────────────────────────────────────────────────────────────────────
  { prefix: 'Top/Computers/Artificial_Intelligence', roamCategoryId: CATEGORY.TECHNOLOGY, roamSubcategoryId: SUBCATEGORY.AI_MACHINE_LEARNING },
  { prefix: 'Top/Computers/Security',                roamCategoryId: CATEGORY.TECHNOLOGY, roamSubcategoryId: SUBCATEGORY.CYBERSECURITY_PRIVACY },
  { prefix: 'Top/Computers/Programming',             roamCategoryId: CATEGORY.TECHNOLOGY, roamSubcategoryId: SUBCATEGORY.PROGRAMMING_SOFTWARE },
  { prefix: 'Top/Computers/Software',                roamCategoryId: CATEGORY.TECHNOLOGY, roamSubcategoryId: SUBCATEGORY.PROGRAMMING_SOFTWARE },
  { prefix: 'Top/Computers/Open_Source',             roamCategoryId: CATEGORY.TECHNOLOGY, roamSubcategoryId: SUBCATEGORY.OPEN_SOURCE },
  { prefix: 'Top/Computers/Robotics',                roamCategoryId: CATEGORY.TECHNOLOGY, roamSubcategoryId: SUBCATEGORY.ROBOTICS_AUTOMATION },
  { prefix: 'Top/Computers/Hardware',                roamCategoryId: CATEGORY.TECHNOLOGY, roamSubcategoryId: SUBCATEGORY.HARDWARE_ELECTRONICS },
  { prefix: 'Top/Computers/Internet',                roamCategoryId: CATEGORY.TECHNOLOGY, roamSubcategoryId: SUBCATEGORY.INTERNET_CULTURE },
  { prefix: 'Top/Computers/Graphics',                roamCategoryId: CATEGORY.TECHNOLOGY, roamSubcategoryId: SUBCATEGORY.DESIGN_UX },
  // Top-level Computers fallback
  { prefix: 'Top/Computers',                         roamCategoryId: CATEGORY.TECHNOLOGY, roamSubcategoryId: null },

  // ─────────────────────────────────────────────────────────────────────────
  // ARTS & CULTURE — second-level paths first
  // ─────────────────────────────────────────────────────────────────────────
  { prefix: 'Top/Arts/Music',              roamCategoryId: CATEGORY.ARTS_CULTURE, roamSubcategoryId: SUBCATEGORY.MUSIC },
  { prefix: 'Top/Arts/Movies',             roamCategoryId: CATEGORY.ARTS_CULTURE, roamSubcategoryId: SUBCATEGORY.FILM_TELEVISION },
  { prefix: 'Top/Arts/Television',         roamCategoryId: CATEGORY.ARTS_CULTURE, roamSubcategoryId: SUBCATEGORY.FILM_TELEVISION },
  { prefix: 'Top/Arts/Visual_Arts',        roamCategoryId: CATEGORY.ARTS_CULTURE, roamSubcategoryId: SUBCATEGORY.VISUAL_ART },
  { prefix: 'Top/Arts/Photography',        roamCategoryId: CATEGORY.ARTS_CULTURE, roamSubcategoryId: SUBCATEGORY.PHOTOGRAPHY },
  { prefix: 'Top/Arts/Comics',             roamCategoryId: CATEGORY.ARTS_CULTURE, roamSubcategoryId: SUBCATEGORY.COMICS_ILLUSTRATION },
  { prefix: 'Top/Arts/Animation',          roamCategoryId: CATEGORY.ARTS_CULTURE, roamSubcategoryId: SUBCATEGORY.FILM_TELEVISION },
  { prefix: 'Top/Arts/Literature',         roamCategoryId: CATEGORY.ARTS_CULTURE, roamSubcategoryId: SUBCATEGORY.LITERATURE_WRITING },
  { prefix: 'Top/Arts/Writers_Resources',  roamCategoryId: CATEGORY.ARTS_CULTURE, roamSubcategoryId: SUBCATEGORY.LITERATURE_WRITING },
  { prefix: 'Top/Arts/Architecture',       roamCategoryId: CATEGORY.ARTS_CULTURE, roamSubcategoryId: SUBCATEGORY.ARCHITECTURE_URBAN },
  { prefix: 'Top/Arts/Performing_Arts',    roamCategoryId: CATEGORY.ARTS_CULTURE, roamSubcategoryId: SUBCATEGORY.THEATRE_PERFORMANCE },
  { prefix: 'Top/Arts/Fashion',            roamCategoryId: CATEGORY.ARTS_CULTURE, roamSubcategoryId: SUBCATEGORY.FASHION_TEXTILES },
  // Top-level Arts fallback
  { prefix: 'Top/Arts',                    roamCategoryId: CATEGORY.ARTS_CULTURE, roamSubcategoryId: null },

  // ─────────────────────────────────────────────────────────────────────────
  // HISTORY & IDEAS — from Society
  // ─────────────────────────────────────────────────────────────────────────
  { prefix: 'Top/Society/History',         roamCategoryId: CATEGORY.HISTORY_IDEAS, roamSubcategoryId: SUBCATEGORY.MODERN_HISTORY },
  { prefix: 'Top/Society/Philosophy',      roamCategoryId: CATEGORY.HISTORY_IDEAS, roamSubcategoryId: SUBCATEGORY.PHILOSOPHY_ETHICS },
  { prefix: 'Top/Society/Religion',        roamCategoryId: CATEGORY.HISTORY_IDEAS, roamSubcategoryId: SUBCATEGORY.RELIGION_MYTHOLOGY },
  { prefix: 'Top/Society/Politics',        roamCategoryId: CATEGORY.HISTORY_IDEAS, roamSubcategoryId: SUBCATEGORY.POLITICS_GEOPOLITICS },
  { prefix: 'Top/Society/Economics',       roamCategoryId: CATEGORY.HISTORY_IDEAS, roamSubcategoryId: SUBCATEGORY.ECONOMICS_HISTORY },
  { prefix: 'Top/Society/Archaeology',     roamCategoryId: CATEGORY.HISTORY_IDEAS, roamSubcategoryId: SUBCATEGORY.ANTHROPOLOGY_ARCHAEOLOGY },
  { prefix: 'Top/Society/Military',        roamCategoryId: CATEGORY.HISTORY_IDEAS, roamSubcategoryId: SUBCATEGORY.MILITARY_HISTORY },
  // Top-level Society fallback
  { prefix: 'Top/Society',                 roamCategoryId: CATEGORY.HISTORY_IDEAS, roamSubcategoryId: null },

  // ─────────────────────────────────────────────────────────────────────────
  // GAMES & HOBBIES — from Recreation + Sports
  // ─────────────────────────────────────────────────────────────────────────
  { prefix: 'Top/Recreation/Games',        roamCategoryId: CATEGORY.GAMES_HOBBIES, roamSubcategoryId: SUBCATEGORY.VIDEO_GAMES },
  { prefix: 'Top/Recreation/Video_Games',  roamCategoryId: CATEGORY.GAMES_HOBBIES, roamSubcategoryId: SUBCATEGORY.VIDEO_GAMES },
  { prefix: 'Top/Recreation/Board_Games',  roamCategoryId: CATEGORY.GAMES_HOBBIES, roamSubcategoryId: SUBCATEGORY.BOARD_GAMES_TABLETOP },
  { prefix: 'Top/Recreation/Food',         roamCategoryId: CATEGORY.GAMES_HOBBIES, roamSubcategoryId: SUBCATEGORY.COOKING_FOOD },
  { prefix: 'Top/Recreation/Crafts',       roamCategoryId: CATEGORY.GAMES_HOBBIES, roamSubcategoryId: SUBCATEGORY.CRAFTS_DIY_MAKING },
  { prefix: 'Top/Recreation/Collecting',   roamCategoryId: CATEGORY.GAMES_HOBBIES, roamSubcategoryId: SUBCATEGORY.COLLECTING },
  { prefix: 'Top/Recreation/Outdoors',     roamCategoryId: CATEGORY.GAMES_HOBBIES, roamSubcategoryId: SUBCATEGORY.OUTDOOR_ADVENTURE },
  { prefix: 'Top/Recreation/Gardening',    roamCategoryId: CATEGORY.GAMES_HOBBIES, roamSubcategoryId: SUBCATEGORY.GARDENING_HORTICULTURE },
  { prefix: 'Top/Recreation/Puzzles',      roamCategoryId: CATEGORY.GAMES_HOBBIES, roamSubcategoryId: SUBCATEGORY.PUZZLES_BRAIN_TEASERS },
  { prefix: 'Top/Recreation',              roamCategoryId: CATEGORY.GAMES_HOBBIES, roamSubcategoryId: null },
  { prefix: 'Top/Sports',                  roamCategoryId: CATEGORY.GAMES_HOBBIES, roamSubcategoryId: SUBCATEGORY.SPORTS_ATHLETICS },

  // ─────────────────────────────────────────────────────────────────────────
  // WEIRD & WONDERFUL (News, crime, paranormal themes)
  // ─────────────────────────────────────────────────────────────────────────
  { prefix: 'Top/News',                    roamCategoryId: CATEGORY.WEIRD_WONDERFUL, roamSubcategoryId: null },

  // ─────────────────────────────────────────────────────────────────────────
  // PEOPLE & PLACES — from Regional
  // ─────────────────────────────────────────────────────────────────────────
  { prefix: 'Top/Regional',                roamCategoryId: CATEGORY.PEOPLE_PLACES, roamSubcategoryId: null },

  // ─────────────────────────────────────────────────────────────────────────
  // MIND & BODY — from Health + Home
  // ─────────────────────────────────────────────────────────────────────────
  { prefix: 'Top/Health/Mental_Health',    roamCategoryId: CATEGORY.MIND_BODY, roamSubcategoryId: SUBCATEGORY.MENTAL_HEALTH },
  { prefix: 'Top/Health/Fitness',          roamCategoryId: CATEGORY.MIND_BODY, roamSubcategoryId: SUBCATEGORY.FITNESS_MOVEMENT },
  { prefix: 'Top/Health/Nutrition',        roamCategoryId: CATEGORY.MIND_BODY, roamSubcategoryId: SUBCATEGORY.NUTRITION_HEALTH },
  { prefix: 'Top/Health',                  roamCategoryId: CATEGORY.MIND_BODY, roamSubcategoryId: null },
  { prefix: 'Top/Home',                    roamCategoryId: CATEGORY.MIND_BODY, roamSubcategoryId: null },
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

  for (const { prefix, roamCategoryId, roamSubcategoryId } of CATEGORY_MAP) {
    if (curliePathFull === prefix || curliePathFull.startsWith(prefix + '/')) {
      return { categoryId: roamCategoryId, subcategoryId: roamSubcategoryId ?? null };
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
    // category + explicit language tag per Curlie dump file
    // Language-specific files are kept (not excluded) so users who opt-in
    // to those languages can discover them via user_settings.
    const filenameToMeta = {
      'rdf-Arts-c.tsv':        { category: CATEGORY.ARTS_CULTURE,    language: 'en' },
      'rdf-Business-c.tsv':   { category: null,                     language: 'en' }, // skip — local businesses/services
      'rdf-Computers-c.tsv':  { category: CATEGORY.TECHNOLOGY,      language: 'en' },
      'rdf-Deutsch-c.tsv':    { category: CATEGORY.TECHNOLOGY,      language: 'de' },
      'rdf-Europe-c.tsv':     { category: CATEGORY.PEOPLE_PLACES,   language: 'en' }, // mixed; English index
      'rdf-Français-c.tsv':   { category: CATEGORY.ARTS_CULTURE,    language: 'fr' },
      'rdf-Italiano-c.tsv':   { category: CATEGORY.ARTS_CULTURE,    language: 'it' },
      'rdf-Japanese-c.tsv':   { category: CATEGORY.ARTS_CULTURE,    language: 'ja' },
      'rdf-KT-c.tsv':         { category: CATEGORY.GAMES_HOBBIES,   language: 'en' },
      'rdf-NorthAmerica-c.tsv': { category: null,                   language: 'en' }, // skip — local city/business directories
      'rdf-Regional-c.tsv':   { category: null,                     language: 'en' }, // skip — local geographic business directories
      'rdf-Society-c.tsv':    { category: CATEGORY.HISTORY_IDEAS,   language: 'en' },
      'rdf-Top-c.tsv':        { category: CATEGORY.SCIENCE,         language: 'en' },
      'rdf-World-c.tsv':      { category: CATEGORY.PEOPLE_PLACES,   language: 'en' }, // mixed; English index
      'rdf-Adult-c.tsv':      { category: null,                     language: 'en' }, // skip
    };
    // Legacy alias so the loop below can use a single name
    const filenameToCategory = Object.fromEntries(
      Object.entries(filenameToMeta).map(([k, v]) => [k, v.category])
    );

    // Files whose file-level language tag is 'en' but which actually contain
    // non-English content (Top/World/, Top/Regional/ etc.).  For these we
    // apply TLD-based language detection per URL to get a more accurate tag.
    const MIXED_LANGUAGE_FILES = new Set([
      'rdf-World-c.tsv',
      'rdf-Europe-c.tsv',
      'rdf-Regional-c.tsv',
      'rdf-Top-c.tsv',
    ]);

    // Map country-code TLDs to BCP-47 language codes.
    // Deliberately conservative: only TLDs with a single dominant language.
    const TLD_LANGUAGE = {
      de: 'de', at: 'de',
      fr: 'fr',
      es: 'es', mx: 'es', ar: 'es',
      it: 'it',
      nl: 'nl',
      pl: 'pl',
      ru: 'ru',
      jp: 'ja',
      cn: 'zh', tw: 'zh',
      kr: 'ko',
      pt: 'pt', br: 'pt',
      se: 'sv',
      no: 'no',
      dk: 'da',
      fi: 'fi',
      cz: 'cs',
      hu: 'hu',
      ro: 'ro',
      gr: 'el',
      tr: 'tr',
    };

    function detectLanguageFromTld(url) {
      try {
        const hostname = new URL(url).hostname.toLowerCase();
        const tld = hostname.split('.').pop();
        return TLD_LANGUAGE[tld] ?? null;
      } catch { return null; }
    }

    for (const file of contentFiles) {
      const categoryId = filenameToCategory[file];
      if (!categoryId) {
        console.log(`[curlie] Skipping ${file} (no category mapping)`);
        continue;
      }
      const language = filenameToMeta[file]?.language ?? 'en';

      console.log(`[curlie] Parsing content: ${file} (lang=${language})...`);
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
        const curliePath = cleanString(parts[3]) || null;
        const cleanUrl = cleanString(url);

        if (!cleanUrl) continue;  // Skip if URL becomes empty after cleaning

        // Attempt fine-grained mapping using the per-row Curlie path (parts[3]).
        // Fall back to the file-level categoryId when the path is absent or unmapped.
        const pathMapping = curliePath ? mapCurlieCategory(curliePath) : null;
        const rowCategoryId    = pathMapping?.categoryId    ?? categoryId;
        const rowSubcategoryId = pathMapping?.subcategoryId ?? null;

        const row = {
          url: cleanUrl,
          title,
          description,
          category_id:    rowCategoryId,
          subcategory_id: rowSubcategoryId,
          // For mixed-language files tagged 'en', attempt TLD detection so
          // non-English sites are served to the right audience.
          language: (language === 'en' && MIXED_LANGUAGE_FILES.has(file))
            ? (detectLanguageFromTld(cleanUrl) ?? 'en')
            : language,
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

