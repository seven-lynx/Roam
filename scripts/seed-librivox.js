/**
 * seed-librivox.js — LibriVox seeder
 *
 * Pulls public domain audiobook records from the LibriVox API (no key required).
 * Each book links to its LibriVox page with title, description, and author.
 * English-language books only.
 *
 * API docs: https://librivox.org/api/info
 * Endpoint: https://librivox.org/api/feed/audiobooks/?format=json&limit=50&offset=N
 *
 * Run from repo root:
 *   node scripts/seed-librivox.js
 *   node scripts/seed-librivox.js --no-cache   # re-fetch from API
 *   node scripts/seed-librivox.js --reset       # delete checkpoint and start over
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY } from './lib/seed.js';

const __dirname       = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR       = resolve(__dirname, '.cache');
const CACHE_FILE      = resolve(CACHE_DIR, 'librivox.json');
const PROGRESS_FILE   = resolve(CACHE_DIR, 'librivox-progress.json');
const NO_CACHE        = process.argv.includes('--no-cache');
const RESET           = process.argv.includes('--reset');

const LIMIT    = 50;   // LibriVox API max per page
const DELAY_MS = 1500; // polite crawl delay between pages

const API_BASE = 'https://librivox.org/api/feed/audiobooks/';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Text → Roam category mapping ────────────────────────────────────────────
// LibriVox API does not return genre data, so we match against title+description.
// Patterns are checked in order; first match wins.
// Default is ARTS_CULTURE (most LibriVox content is classic literature).
const TEXT_MAP = [
  // Science (check before History to catch "natural history" etc.)
  { pattern: /natural history|\bphysics\b|\bchemistry\b|\bbiology\b|\bastronomy\b|\bmathematics?\b|\bgeology\b|\becology\b|\bevolution\b|\bneuroscience\b/i, categoryId: CATEGORY.SCIENCE },

  // Technology
  { pattern: /\btechnology\b|\bengineering\b|\belectronics\b|\brobotic/i, categoryId: CATEGORY.TECHNOLOGY },

  // Mind & Body
  { pattern: /\bpsycholog|\bmeditation\b|\bself.help\b|\bmental health\b|\bwellness\b|\bfitness\b/i, categoryId: CATEGORY.MIND_BODY },

  // People & Places
  { pattern: /\btravel\b|\bexplor|\bgeography\b|\bexpedition\b/i, categoryId: CATEGORY.PEOPLE_PLACES },

  // History & Ideas
  { pattern: /\bhistory\b|\bhistorical\b|\bbiograph|\bautobiograph|\bphilosoph|\bpolitics\b|\breligion\b|\btheolog|\beconomics\b|\bwar\b|\bmilitary\b|\bancient\b|\bcivilization\b/i, categoryId: CATEGORY.HISTORY_IDEAS },

  // Weird & Wonderful
  { pattern: /\bhorror\b|\bghost\b|\bsupernatural\b|\bmyth\b|\blegend\b|fairy tale|\boccult\b|\bhumor\b|\bhumour\b|\bcomedy\b|\bsatire\b|\bgothic\b|\bparanormal\b/i, categoryId: CATEGORY.WEIRD_WONDERFUL },

  // Games & Hobbies
  { pattern: /science fiction|\bfantasy\b|\badventure\b|\bmystery\b|\bdetective\b|\bthriller\b|\bwestern\b|\bcooking\b|\bgardening\b|\bsport\b/i, categoryId: CATEGORY.GAMES_HOBBIES },

  // Arts & Culture (default — poetry, drama, novels, etc.)
  { pattern: /.*/,                                                            categoryId: CATEGORY.ARTS_CULTURE },
];

function textToCategory(title, description) {
  const text = `${title || ''} ${description || ''}`;
  for (const { pattern, categoryId } of TEXT_MAP) {
    if (pattern.test(text)) return categoryId;
  }
  return CATEGORY.ARTS_CULTURE;
}

// ── Strip HTML tags from description ─────────────────────────────────────────
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Fetch one page of books ───────────────────────────────────────────────────
async function fetchPage(offset) {
  const params = new URLSearchParams({
    format: 'json',
    fields: 'id,title,description,url_librivox,language,copyright_year,authors',  // genres field not supported by API
    limit:  String(LIMIT),
    offset: String(offset),
  });
  const url = `${API_BASE}?${params}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'RoamSeeder/1.0 (hobby project; contact via GitHub)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for offset ${offset}`);
  const data = await res.json();
  // API returns { books: [...] } or { error: "..." } when no more results
  if (data.error || !Array.isArray(data.books)) return [];
  return data.books;
}

// ── Convert a book record to a Roam row ───────────────────────────────────────
function bookToRow(book) {
  const url = book.url_librivox;
  if (!url || !url.startsWith('http')) return null;

  const authorName = Array.isArray(book.authors) && book.authors.length > 0
    ? book.authors.map((a) => `${a.first_name} ${a.last_name}`.trim()).join(', ')
    : null;

  const rawDesc = stripHtml(book.description || '');
  // Prepend author attribution for better discovery context
  const description = authorName
    ? `${authorName} · ${rawDesc}`.slice(0, 500)
    : rawDesc.slice(0, 500);

  return {
    url,
    title:       book.title || `LibriVox #${book.id}`,
    description,
    category_id: textToCategory(book.title, rawDesc),
    source:      'librivox',
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });

  if (RESET) {
    if (existsSync(CACHE_FILE))    writeFileSync(CACHE_FILE, '[]');
    if (existsSync(PROGRESS_FILE)) writeFileSync(PROGRESS_FILE, '{}');
    console.log('[librivox] Reset — cache and progress cleared.');
  }

  console.log('=== LibriVox seeder ===\n');

  // ── Phase 1: Fetch all books ───────────────────────────────────────────────
  let allBooks = [];

  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    allBooks = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[librivox] Loaded ${allBooks.length} books from cache.\n`);
  } else {
    let progress = existsSync(PROGRESS_FILE)
      ? JSON.parse(readFileSync(PROGRESS_FILE, 'utf8'))
      : {};

    let offset = progress.offset ?? 0;

    // Resume from cache if we have partial results
    if (offset > 0 && existsSync(CACHE_FILE)) {
      allBooks = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
      console.log(`[librivox] Resuming from offset ${offset} (${allBooks.length} books already fetched).\n`);
    } else {
      console.log('[librivox] Fetching all English-language audiobooks...\n');
    }

    let page = Math.floor(offset / LIMIT) + 1;

    while (true) {
      let books;
      try {
        books = await fetchPage(offset);
      } catch (err) {
        console.error(`[librivox] Error at offset ${offset}:`, err.message);
        await sleep(5000);
        continue;
      }

      if (books.length === 0) {
        console.log(`[librivox] No more results at offset ${offset} — done fetching.`);
        break;
      }

      // Filter English only
      const english = books.filter((b) => b.language === 'English');
      allBooks.push(...english);

      console.log(`[librivox]   Page ${page}: ${books.length} books (${english.length} English) — total ${allBooks.length}`);

      offset += LIMIT;
      page++;

      // Save checkpoint
      writeFileSync(CACHE_FILE, JSON.stringify(allBooks));
      writeFileSync(PROGRESS_FILE, JSON.stringify({ offset }));

      if (books.length < LIMIT) {
        // Last page
        break;
      }

      await sleep(DELAY_MS);
    }

    console.log(`\n[librivox] Fetched ${allBooks.length} English books total.\n`);
    writeFileSync(CACHE_FILE, JSON.stringify(allBooks));
    writeFileSync(PROGRESS_FILE, JSON.stringify({ offset, complete: true }));
  }

  // ── Phase 2: Convert to Roam rows ─────────────────────────────────────────
  const rows = allBooks
    .map(bookToRow)
    .filter(Boolean);

  console.log(`[librivox] Total: ${rows.length} rows — upserting...\n`);

  // ── Phase 3: Upsert ────────────────────────────────────────────────────────
  const { inserted, skipped } = await upsertUrls(rows);

  console.log(`\n=== Done: inserted ${inserted}, skipped ${skipped} ===\n`);
}

main().catch((err) => {
  console.error('[librivox] Fatal error:', err);
  process.exit(1);
});
