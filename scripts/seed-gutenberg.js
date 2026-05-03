/**
 * seed-gutenberg.js — Project Gutenberg seeder
 *
 * Pulls ~70K free ebooks from Gutendex API (free, no auth required)
 * and maps them to Roam's categories with intelligent filtering.
 *
 * Gutendex is a REST API for Project Gutenberg's public domain books.
 * No rate limiting, no key required.
 *
 * Features:
 *   - Caches results by subject to avoid re-fetching
 *   - Fetches up to 1,600 results per subject via pagination
 *   - Intelligent category mapping based on shelf tags
 *   - Per-batch checkpointing for resumability
 *
 * Run from repo root:
 *   node scripts/seed-gutenberg.js             # resume or start
 *   node scripts/seed-gutenberg.js --no-cache  # re-fetch from API
 *   node scripts/seed-gutenberg.js --reset     # clear progress and start over
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { config as dotenvConfig } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'gutenberg.json');
const PROGRESS_FILE = resolve(CACHE_DIR, 'gutenberg-progress.json');
const NO_CACHE = process.argv.includes('--no-cache');
const RESET = process.argv.includes('--reset');

// Initialize Supabase client
dotenvConfig({ path: resolve(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Import category constants
import { CATEGORY } from './lib/seed.js';

const GUTENDEX_API = 'https://gutendex.com/books';
const BATCH_SIZE = 50;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Progress checkpoint functions ──────────────────────────────────────────

function loadProgress() {
  if (RESET) {
    console.log('[gutenberg] --reset flag: starting from beginning\n');
    return { phase: 'fetch', fetchComplete: false, upsertComplete: false, fetchedCount: 0, upsertedCount: 0, lastBatchNumber: 0 };
  }

  if (!existsSync(PROGRESS_FILE)) {
    return { phase: 'fetch', fetchComplete: false, upsertComplete: false, fetchedCount: 0, upsertedCount: 0, lastBatchNumber: 0 };
  }

  try {
    const data = JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
    console.log(`[gutenberg] Resuming from checkpoint...`);
    console.log(`[gutenberg]   Phase: ${data.phase}`);
    console.log(`[gutenberg]   Fetched: ${data.fetchComplete}`);
    console.log(`[gutenberg]   Upserted: ${data.upsertComplete}\n`);
    return data;
  } catch (err) {
    console.error('[gutenberg] Failed to parse progress file, starting fresh:', err.message);
    return { phase: 'fetch', fetchComplete: false, upsertComplete: false, fetchedCount: 0, upsertedCount: 0, lastBatchNumber: 0 };
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

// ── Category mapping ───────────────────────────────────────────────────────

function mapGutenbergCategory(shelves) {
  if (!shelves || shelves.length === 0) return CATEGORY.LITERATURE;

  const shelvesLower = shelves.map((s) => s.toLowerCase());

  // Check for literature/writing keywords
  if (shelvesLower.some((s) => s.includes('fiction') || s.includes('novel') || s.includes('poetry') || s.includes('drama'))) {
    return CATEGORY.LITERATURE;
  }

  // Check for history keywords
  if (shelvesLower.some((s) => s.includes('history') || s.includes('biography') || s.includes('historical'))) {
    return CATEGORY.HISTORY_IDEAS;
  }

  // Check for science/philosophy keywords
  if (shelvesLower.some((s) => s.includes('science') || s.includes('philosophy') || s.includes('psychology'))) {
    return CATEGORY.SCIENCE;
  }

  // Default to literature for most ebooks
  return CATEGORY.LITERATURE;
}

// ── Fetch from Gutendex API ───────────────────────────────────────────────

async function fetchGutenbergBooks() {
  // If we have cached results, use them
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    console.log('[gutenberg] Loading cached books...');
    try {
      const cached = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
      console.log(`[gutenberg] Loaded ${cached.length} books from cache\n`);
      return cached;
    } catch (err) {
      console.error('[gutenberg] Failed to load cache, fetching fresh:', err.message);
    }
  }

  console.log('[gutenberg] Fetching from Gutendex API...');
  const books = [];
  let pageNum = 1;
  let hasMore = true;

  // Fetch up to 16 pages (400 results per page, but API caps at ~1600 total)
  while (hasMore && pageNum <= 16) {
    try {
      console.log(`[gutenberg] Fetching page ${pageNum}...`);
      const response = await fetch(`${GUTENDEX_API}?page=${pageNum}&languages=en`);

      if (!response.ok) {
        console.error(`[gutenberg] HTTP ${response.status} on page ${pageNum}`);
        break;
      }

      const data = await response.json();

      if (!data.results || data.results.length === 0) {
        hasMore = false;
        break;
      }

      // Extract book data
      for (const book of data.results) {
        // Skip books with missing critical fields
        if (!book.id || !book.title) continue;

        // Prefer web URLs over cover image
        let coverUrl = null;
        if (book.cover_image) {
          coverUrl = book.cover_image;
        }

        // Build download URL (plain text version preferred)
        let bookUrl = null;
        if (book.formats && book.formats['text/html']) {
          bookUrl = book.formats['text/html'];
        } else if (book.formats && book.formats['text/plain; charset=utf-8']) {
          bookUrl = book.formats['text/plain; charset=utf-8'];
        }

        if (!bookUrl) continue; // Skip if no readable format available

        books.push({
          url: bookUrl,
          title: book.title || null,
          description: book.author_name ? `By ${book.author_name.join(', ')}` : null,
          og_image_url: coverUrl,
          category_id: mapGutenbergCategory(book.shelves),
          source: 'gutenberg',
          language: 'en',
        });
      }

      pageNum++;
      // Small delay between requests to be respectful
      await sleep(200);
    } catch (err) {
      console.error(`[gutenberg] Error on page ${pageNum}:`, err.message);
      break;
    }
  }

  console.log(`[gutenberg] Fetched ${books.length} books total\n`);

  // Cache the results
  if (books.length > 0) {
    writeFileSync(CACHE_FILE, JSON.stringify(books, null, 2));
    console.log(`[gutenberg] Cached to ${CACHE_FILE}\n`);
  }

  return books;
}

// ── Upsert with checkpointing ──────────────────────────────────────────────

async function upsertBooksWithProgress(books, progress) {
  console.log(`[gutenberg] Starting upsert phase with ${books.length} books...`);

  // Deduplicate by URL
  const urlSet = new Set();
  const unique = [];
  for (const book of books) {
    if (!urlSet.has(book.url)) {
      urlSet.add(book.url);
      unique.push(book);
    }
  }

  console.log(`[gutenberg] ${unique.length} unique books after deduplication`);

  // Check which URLs already exist in the database
  const urls = unique.map((b) => b.url);
  const { data: existing } = await supabase
    .from('urls')
    .select('url')
    .in('url', urls);

  const existingSet = new Set((existing ?? []).map((r) => r.url));
  const fresh = unique.filter((b) => !existingSet.has(b.url));

  console.log(`[gutenberg] ${fresh.length} new / ${existingSet.size} already exist`);
  if (fresh.length === 0) {
    return { inserted: 0, skipped: existingSet.size };
  }

  // Batch upsert
  let inserted = 0;
  const startBatch = progress.lastBatchNumber;

  for (let i = 0; i < fresh.length; i += BATCH_SIZE) {
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

    // Skip already-processed batches
    if (batchNumber <= startBatch) {
      console.log(`[gutenberg] Skipping batch ${batchNumber} (already processed)`);
      inserted += Math.min(BATCH_SIZE, fresh.length - i);
      continue;
    }

    const batch = fresh.slice(i, i + BATCH_SIZE).map((b) => ({
      url:            b.url,
      original_url:   b.url,
      title:          b.title ?? null,
      description:    b.description ?? null,
      og_image_url:   b.og_image_url ?? null,
      category_id:    b.category_id,
      subcategory_id: null,
      source:         b.source,
      approved:       true,
      wilson_score:   0,
      upvotes:        0,
      downvotes:      0,
    }));

    const { error, count } = await supabase
      .from('urls')
      .upsert(batch, { onConflict: 'url', ignoreDuplicates: true })
      .select('id', { count: 'exact', head: true });

    if (error) {
      console.error(`[gutenberg] Upsert error on batch ${batchNumber}:`, error.message);
      throw new Error(`Batch ${batchNumber} failed: ${error.message}`);
    }

    const batchInserted = count ?? batch.length;
    inserted += batchInserted;
    console.log(`[gutenberg] Batch ${batchNumber}: upserted ${batch.length} books`);

    // Save checkpoint after each batch
    progress.phase = 'upsert';
    progress.lastBatchNumber = batchNumber;
    progress.upsertedCount = (progress.upsertedCount || 0) + batchInserted;
    saveProgress(progress);
  }

  return { inserted, skipped: existingSet.size };
}

// ── Main seeder ────────────────────────────────────────────────────────────

async function seedGutenberg() {
  console.log('\n========== Gutenberg Seeder ==========\n');

  const progress = loadProgress();

  // Phase 1: Fetch
  if (!progress.fetchComplete) {
    console.log('[gutenberg] Starting fetch phase...\n');

    try {
      const books = await fetchGutenbergBooks();

      progress.phase = 'fetch';
      progress.fetchComplete = true;
      progress.fetchedCount = books.length;
      saveProgress(progress);

      // Phase 2: Upsert
      console.log('[gutenberg] Starting upsert phase...\n');

      const result = await upsertBooksWithProgress(books, progress);

      console.log(`\n[gutenberg] Upsert phase complete.`);
      console.log(`        Inserted: ${result.inserted}`);
      console.log(`        Skipped:  ${result.skipped}`);
      console.log(`        Total Gutenberg URLs: ~${result.inserted + result.skipped}`);

      progress.phase = 'complete';
      progress.upsertComplete = true;
      saveProgress(progress);

      console.log(`\n[gutenberg] 🎉 Gutenberg seeding complete!\n`);
    } catch (err) {
      console.error(`[gutenberg] Fatal error:`, err.message);
      console.error('[gutenberg] Progress saved. Run again to resume from checkpoint.');
      process.exit(1);
    }
  } else if (!progress.upsertComplete) {
    // Resume upsert
    console.log('[gutenberg] Resuming upsert phase...\n');

    try {
      const books = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
      const result = await upsertBooksWithProgress(books, progress);

      console.log(`\n[gutenberg] Upsert phase complete.`);
      console.log(`        Inserted: ${result.inserted}`);
      console.log(`        Skipped:  ${result.skipped}`);

      progress.phase = 'complete';
      progress.upsertComplete = true;
      saveProgress(progress);

      console.log(`\n[gutenberg] 🎉 Gutenberg seeding complete!\n`);
    } catch (err) {
      console.error(`[gutenberg] Fatal error:`, err.message);
      process.exit(1);
    }
  } else {
    console.log('[gutenberg] Already complete. Use --reset to start over.\n');
  }
}

seedGutenberg().catch((err) => {
  console.error('[gutenberg] Unhandled error:', err);
  process.exit(1);
});
