/**
 * seed-semanticscholar.js — Semantic Scholar seeder
 *
 * Pulls academic papers from the Semantic Scholar public API.
 * No API key required (1 req/s). With a free key: 10 req/s.
 *
 * API docs: https://api.semanticscholar.org/api-docs/
 *
 * Run from repo root:
 *   node scripts/seed-semanticscholar.js
 *   node scripts/seed-semanticscholar.js --no-cache
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY, fetchWithRetry } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'semanticscholar.json');
const NO_CACHE   = process.argv.includes('--no-cache');

// Optional: set SEMANTIC_SCHOLAR_API_KEY in .env for 10 req/s instead of 1 req/s
const API_KEY   = process.env.SEMANTIC_SCHOLAR_API_KEY ?? null;
const DELAY_MS  = API_KEY ? 150 : 1100; // stay under rate limit
const PAGE_SIZE = 100; // max allowed
const PAGES     = 10;  // 100 × 10 = 1,000 papers per query

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Search queries → Roam categories ─────────────────────────────────────────
const QUERIES = [
  // Science
  { q: 'astronomy astrophysics',         categoryId: CATEGORY.SCIENCE },
  { q: 'climate change environment',     categoryId: CATEGORY.SCIENCE },
  { q: 'evolutionary biology',           categoryId: CATEGORY.SCIENCE },
  { q: 'quantum physics',                categoryId: CATEGORY.SCIENCE },
  { q: 'neuroscience brain',             categoryId: CATEGORY.SCIENCE },
  { q: 'mathematics topology',           categoryId: CATEGORY.SCIENCE },
  { q: 'chemistry materials',            categoryId: CATEGORY.SCIENCE },
  { q: 'genetics genomics',              categoryId: CATEGORY.SCIENCE },
  { q: 'oceanography marine biology',    categoryId: CATEGORY.SCIENCE },
  { q: 'particle physics',               categoryId: CATEGORY.SCIENCE },

  // Technology
  { q: 'machine learning deep learning', categoryId: CATEGORY.TECHNOLOGY },
  { q: 'natural language processing',    categoryId: CATEGORY.TECHNOLOGY },
  { q: 'computer vision image recognition', categoryId: CATEGORY.TECHNOLOGY },
  { q: 'cryptography security privacy',  categoryId: CATEGORY.TECHNOLOGY },
  { q: 'robotics autonomous systems',    categoryId: CATEGORY.TECHNOLOGY },
  { q: 'distributed systems blockchain', categoryId: CATEGORY.TECHNOLOGY },
  { q: 'human computer interaction UX',  categoryId: CATEGORY.TECHNOLOGY },
  { q: 'software engineering programming languages', categoryId: CATEGORY.TECHNOLOGY },
  { q: 'computer networks internet',     categoryId: CATEGORY.TECHNOLOGY },
  { q: 'quantum computing',              categoryId: CATEGORY.TECHNOLOGY },

  // History & Ideas
  { q: 'philosophy ethics morality',     categoryId: CATEGORY.HISTORY_IDEAS },
  { q: 'ancient history archaeology',    categoryId: CATEGORY.HISTORY_IDEAS },
  { q: 'economics inequality',           categoryId: CATEGORY.HISTORY_IDEAS },
  { q: 'political science democracy',    categoryId: CATEGORY.HISTORY_IDEAS },
  { q: 'linguistics language cognition', categoryId: CATEGORY.HISTORY_IDEAS },
  { q: 'sociology culture society',      categoryId: CATEGORY.HISTORY_IDEAS },
  { q: 'anthropology human evolution',   categoryId: CATEGORY.HISTORY_IDEAS },

  // Arts & Culture
  { q: 'music cognition perception',     categoryId: CATEGORY.ARTS_CULTURE },
  { q: 'computational creativity art',   categoryId: CATEGORY.ARTS_CULTURE },
  { q: 'film media studies',             categoryId: CATEGORY.ARTS_CULTURE },

  // Mind & Body
  { q: 'psychology mental health',       categoryId: CATEGORY.MIND_BODY },
  { q: 'meditation mindfulness wellbeing', categoryId: CATEGORY.MIND_BODY },
  { q: 'nutrition diet health',          categoryId: CATEGORY.MIND_BODY },
  { q: 'sleep cognition performance',    categoryId: CATEGORY.MIND_BODY },
  { q: 'exercise physical activity',     categoryId: CATEGORY.MIND_BODY },

  // Weird & Wonderful
  { q: 'consciousness perception reality', categoryId: CATEGORY.WEIRD_WONDERFUL },
  { q: 'origin of life emergence',       categoryId: CATEGORY.WEIRD_WONDERFUL },
  { q: 'astrobiology extraterrestrial',  categoryId: CATEGORY.WEIRD_WONDERFUL },
];

// ── Fetch one page of search results ─────────────────────────────────────────
async function fetchPage(q, offset) {
  const params = new URLSearchParams({
    query:            q,
    offset:           String(offset),
    limit:            String(PAGE_SIZE),
    fields:           'paperId,title,abstract,year,openAccessPdf,externalIds,citationCount',
    minCitationCount: '5',  // skip zero-citation preprints with no peer engagement
  });

  const headers = { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)' };
  if (API_KEY) headers['x-api-key'] = API_KEY;

  let res;
  try {
    res = await fetchWithRetry(
      `https://api.semanticscholar.org/graph/v1/paper/search?${params}`,
      { headers },
    );
  } catch (err) {
    console.warn(`[s2] Fetch error: ${err.message}`);
    return [];
  }

  if (!res?.ok) return [];

  const json = await res.json();
  return json.data ?? [];
}

// ── Convert a S2 paper to a Roam row ─────────────────────────────────────────
function paperToRow(paper, categoryId) {
  if (!paper.paperId || !paper.title) return null;

  // Prefer open-access PDF URL, fall back to S2 page
  const pdfUrl   = paper.openAccessPdf?.url ?? null;
  const s2Url    = `https://www.semanticscholar.org/paper/${paper.paperId}`;
  const url      = pdfUrl ?? s2Url;

  const description = paper.abstract
    ? paper.abstract.trim().slice(0, 500)
    : (paper.year ? `Published ${paper.year}` : null);

  return {
    url,
    title:        paper.title.trim(),
    description,
    og_image_url: null,
    category_id:  categoryId,
    source:       'semanticscholar',
    seeder_score: Math.min((paper.citationCount ?? 0) / 500, 1.0),  // 500 = highly cited; was 1000
    published_at: paper.year ? `${paper.year}-01-01T00:00:00Z` : null,
  };
}

// ── Main fetch loop ───────────────────────────────────────────────────────────
async function fetchSemanticScholar() {
  console.log(`\n[s2] Fetching ${QUERIES.length} queries × ${PAGES} pages...`);
  const allRows  = [];
  const seen     = new Set();

  for (const { q, categoryId } of QUERIES) {
    let added = 0;

    for (let page = 0; page < PAGES; page++) {
      const papers = await fetchPage(q, page * PAGE_SIZE);

      for (const paper of papers) {
        const row = paperToRow(paper, categoryId);
        if (!row || seen.has(row.url)) continue;
        seen.add(row.url);
        allRows.push(row);
        added++;
      }

      if (papers.length < PAGE_SIZE) break; // no more results
      await sleep(DELAY_MS);
    }

    console.log(`[s2]   "${q}": ${added} papers`);
    await sleep(DELAY_MS);
  }

  console.log(`\n[s2] Total unique papers collected: ${allRows.length}`);
  return allRows;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Semantic Scholar seeder ===');
  if (API_KEY) {
    console.log('[s2] Using API key — 10 req/s rate limit');
  } else {
    console.log('[s2] No API key — 1 req/s rate limit (add SEMANTIC_SCHOLAR_API_KEY to .env to speed up)');
  }

  let rows;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[s2] Loaded ${rows.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    rows = await fetchSemanticScholar();
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(rows));
    console.log(`[s2] Cached ${rows.length} rows to ${CACHE_FILE}`);
  }

  console.log(`\n[s2] Total: ${rows.length} — upserting...`);
  const result = await upsertUrls(rows, { fetchOg: false, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
