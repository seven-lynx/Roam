/**
 * seed-pubmed.js — PubMed seeder
 *
 * Pulls biomedical literature from NCBI PubMed via the Entrez API.
 * Features:
 *   - Persistent progress tracking (resumable across crashes)
 *   - Smart multi-category mapping based on MeSH terms
 *   - Batch processing with per-phase checkpointing
 *   - Caches results for fast resumption
 *
 * No API key required (public access, ~3 req/s limit).
 * Queries by MeSH terms and maps to appropriate categories beyond just Mind & Body.
 *
 * Run from repo root:
 *   node scripts/seed-pubmed.js                # resume or start
 *   node scripts/seed-pubmed.js --no-cache    # re-fetch from API
 *   node scripts/seed-pubmed.js --reset       # clear progress and start over
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { config as dotenvConfig } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { upsertUrls, CATEGORY, SUBCATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'pubmed-data.json');
const PROGRESS_FILE = resolve(CACHE_DIR, 'pubmed-progress.json');
const NO_CACHE   = process.argv.includes('--no-cache');
const RESET      = process.argv.includes('--reset');

// Initialize Supabase for upsert operations
dotenvConfig({ path: resolve(__dirname, '../../.env') });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const DELAY_MS = 350; // ~3 req/s to be conservative (NCBI guideline: 3/sec max for public)
const RESULTS_PER_QUERY = 100; // per page
const BATCH_SIZE = 50;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── MeSH terms mapped to categories ────────────────────────────────────────
// Each term maps to one or more categories it best fits, plus a subcategory
// for the primary (first) category.

const MESH_TERMS = [
  // Neuroscience & Psychology → MIND_BODY
  { term: 'Neuroscience',    categories: ['MIND_BODY', 'SCIENCE'], subcategory: SUBCATEGORY.NEUROSCIENCE },
  { term: 'Psychiatry',      categories: ['MIND_BODY'],            subcategory: SUBCATEGORY.MENTAL_HEALTH },
  { term: 'Psychology',      categories: ['MIND_BODY'],            subcategory: SUBCATEGORY.PSYCHOLOGY_BEHAVIOUR },
  { term: 'Neurotransmitters', categories: ['MIND_BODY', 'SCIENCE'], subcategory: SUBCATEGORY.NEUROSCIENCE },
  { term: 'Brain',           categories: ['MIND_BODY', 'SCIENCE'], subcategory: SUBCATEGORY.NEUROSCIENCE },
  { term: 'Cognition',       categories: ['MIND_BODY'],            subcategory: SUBCATEGORY.PSYCHOLOGY_BEHAVIOUR },
  { term: 'Learning',        categories: ['MIND_BODY'],            subcategory: SUBCATEGORY.PSYCHOLOGY_BEHAVIOUR },
  { term: 'Memory',          categories: ['MIND_BODY'],            subcategory: SUBCATEGORY.PSYCHOLOGY_BEHAVIOUR },
  { term: 'Sleep',           categories: ['MIND_BODY'],            subcategory: SUBCATEGORY.SLEEP_RECOVERY },
  { term: 'Mental Health',   categories: ['MIND_BODY'],            subcategory: SUBCATEGORY.MENTAL_HEALTH },
  { term: 'Stress',          categories: ['MIND_BODY'],            subcategory: SUBCATEGORY.MENTAL_HEALTH },
  { term: 'Anxiety',         categories: ['MIND_BODY'],            subcategory: SUBCATEGORY.MENTAL_HEALTH },
  { term: 'Depression',      categories: ['MIND_BODY'],            subcategory: SUBCATEGORY.MENTAL_HEALTH },

  // Health & Wellness → MIND_BODY
  { term: 'Nutrition',  categories: ['MIND_BODY'], subcategory: SUBCATEGORY.NUTRITION_HEALTH },
  { term: 'Health',     categories: ['MIND_BODY'], subcategory: SUBCATEGORY.NUTRITION_HEALTH },
  { term: 'Exercise',   categories: ['MIND_BODY'], subcategory: SUBCATEGORY.FITNESS_MOVEMENT },
  { term: 'Diet',       categories: ['MIND_BODY'], subcategory: SUBCATEGORY.NUTRITION_HEALTH },

  // Biomedical sciences → SCIENCE + MIND_BODY
  { term: 'Pharmacology',  categories: ['MIND_BODY', 'SCIENCE'], subcategory: SUBCATEGORY.MEDICINE_HEALTH_SCIENCE },
  { term: 'Immunology',    categories: ['SCIENCE'],              subcategory: SUBCATEGORY.BIOLOGY_EVOLUTION },
  { term: 'Genetics',      categories: ['SCIENCE'],              subcategory: SUBCATEGORY.BIOLOGY_EVOLUTION },
  { term: 'Cell Biology',  categories: ['SCIENCE'],              subcategory: SUBCATEGORY.BIOLOGY_EVOLUTION },
  { term: 'Physiology',    categories: ['SCIENCE', 'MIND_BODY'], subcategory: SUBCATEGORY.BIOLOGY_EVOLUTION },
  { term: 'Medicine',      categories: ['MIND_BODY'],            subcategory: SUBCATEGORY.MEDICINE_HEALTH_SCIENCE },
  { term: 'Disease',       categories: ['MIND_BODY'],            subcategory: SUBCATEGORY.MEDICINE_HEALTH_SCIENCE },
];

// ── Progress checkpoint functions ─────────────────────────────────────────

function loadProgress() {
  if (RESET) {
    console.log('[pubmed] --reset flag: starting from beginning\n');
    return { phase: 'search', searchComplete: false, fetchComplete: false, upsertComplete: false, papersById: {}, startedAt: new Date().toISOString() };
  }

  if (!existsSync(PROGRESS_FILE)) {
    return { phase: 'search', searchComplete: false, fetchComplete: false, upsertComplete: false, papersById: {}, startedAt: new Date().toISOString() };
  }

  try {
    const data = JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
    console.log(`[pubmed] Resuming from checkpoint...`);
    console.log(`[pubmed]   Phase: ${data.phase}`);
    console.log(`[pubmed]   Search complete: ${data.searchComplete} (found ${Object.keys(data.papersById).length} unique papers)`);
    console.log(`[pubmed]   Fetch complete: ${data.fetchComplete}`);
    console.log(`[pubmed]   Upsert complete: ${data.upsertComplete}\n`);
    return data;
  } catch (err) {
    console.error('[pubmed] Failed to parse progress file, starting fresh:', err.message);
    return { phase: 'search', searchComplete: false, fetchComplete: false, upsertComplete: false, papersById: {}, startedAt: new Date().toISOString() };
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

// ── Fetch from NCBI Entrez API ─────────────────────────────────────────────

/**
 * Search PubMed for papers matching a MeSH term
 * Returns array of paper IDs found
 */
async function searchPubMed(meshTerm) {
  const results = [];
  const query = encodeURIComponent(`${meshTerm}[MESH]`);

  for (let page = 0; page < 20; page++) {
    const retstart = page * RESULTS_PER_QUERY;
    const url =
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi` +
      `?db=pubmed` +
      `&term=${query}` +
      `&retstart=${retstart}` +
      `&retmax=${RESULTS_PER_QUERY}` +
      `&retmode=json`;

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)' },
      });
      const json = await res.json();

      if (!json.esearchresult || !json.esearchresult.idlist) {
        console.log(`  [pubmed] ${meshTerm}: no results on page ${page}`);
        break;
      }

      const ids = json.esearchresult.idlist;
      if (!ids.length) break; // no more results

      results.push(...ids);
      console.log(`  [pubmed] ${meshTerm}: fetched ${ids.length} IDs (page ${page + 1}/20)`);

      await sleep(DELAY_MS);
    } catch (err) {
      console.error(`  [pubmed] Error fetching ${meshTerm} page ${page}:`, err.message);
      break;
    }
  }

  return results;
}

/**
 * Fetch detailed metadata for paper IDs
 * Batches IDs in groups of 100 to reduce requests
 */
async function fetchPaperDetails(ids) {
  const papers = {};

  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const idList = batch.join(',');
    // Use esummary (not efetch) — esummary supports retmode=json for PubMed
    const url =
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi` +
      `?db=pubmed` +
      `&id=${idList}` +
      `&retmode=json`;

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)' },
      });
      // NCBI sometimes returns XML error pages on rate limiting — check before parsing
      const text = await res.text();
      if (text.trimStart().startsWith('<')) {
        throw new Error(`NCBI returned XML (likely rate-limited) at batch ${Math.floor(i / 100) + 1}`);
      }
      const json = JSON.parse(text);

      if (json.result && json.result.uids) {
        for (const uid of json.result.uids) {
          const article = json.result[uid];
          if (article && article.uid) {
            const paperUrl = `https://pubmed.ncbi.nlm.nih.gov/${article.uid}/`;
            const title = article.title || `PubMed ${article.uid}`;
            // esummary has no abstract; build description from journal + date + authors
            const authors = Array.isArray(article.authors)
              ? article.authors.slice(0, 3).map((a) => a.name).join(', ')
              : '';
            const journal = article.fulljournalname || article.source || '';
            const pubdate = article.pubdate || '';
            const description = [authors, journal, pubdate].filter(Boolean).join(' · ');

            papers[article.uid] = {
              url: paperUrl,
              title,
              description,
              source: 'pubmed',
            };
          }
        }
      }

      console.log(`    [pubmed] Fetched details for batch ${Math.floor(i / 100) + 1}/${Math.ceil(ids.length / 100)}`);
      await sleep(DELAY_MS);
    } catch (err) {
      console.error(`    [pubmed] Error fetching batch:`, err.message);
      // Back off longer on rate-limit errors to let NCBI recover
      if (err.message.includes('XML') || err.message.includes('rate')) {
        await sleep(5000);
      }
    }
  }

  return papers;
}

// ── Mapping function ──────────────────────────────────────────────────────────

/**
 * Given a set of MeSH terms that found a paper,
 * return the primary category to insert it with.
 * Prioritize MIND_BODY if the paper matches any Mind & Body term,
 * otherwise pick the first matching category.
 */
function mapTermsToCategory(termCategories) {
  if (!termCategories || termCategories.length === 0) {
    return CATEGORY.MIND_BODY; // default
  }

  // If MIND_BODY is in any of the term's categories, prioritize it
  for (const categories of termCategories) {
    if (categories.includes('MIND_BODY')) {
      return CATEGORY.MIND_BODY;
    }
  }

  // Otherwise pick the first category from the first term
  const firstCategory = termCategories[0]?.[0];
  if (firstCategory === 'MIND_BODY') return CATEGORY.MIND_BODY;
  if (firstCategory === 'SCIENCE') return CATEGORY.SCIENCE;
  if (firstCategory === 'TECHNOLOGY') return CATEGORY.TECHNOLOGY;

  return CATEGORY.MIND_BODY; // fallback
}

// ── Main seeder ───────────────────────────────────────────────────────────────

async function seedPubMed() {
  console.log('\n========== PubMed Seeder (with resumable checkpoints) ==========\n');

  let progress = loadProgress();

  // ──────────────────────────────────────────────────────────────────────
  // Phase 1: Search for papers by MeSH term
  // ──────────────────────────────────────────────────────────────────────
  if (!progress.searchComplete) {
    console.log(`[pubmed] Starting search phase (${MESH_TERMS.length} MeSH terms)...\n`);

    // Track: which terms have been searched, and what papers they found
    // papersById[id] = { url, title, description, source, foundByTerms: [...] }
    const papersById = progress.papersById || {};

    const startIndex = Object.keys(papersById).length > 0
      ? MESH_TERMS.findIndex((mt) => mt.term === (progress.lastSearchedTerm || ''))
      : -1;

    for (let i = startIndex + 1; i < MESH_TERMS.length; i++) {
      const { term, categories, subcategory } = MESH_TERMS[i];
      console.log(`\n[pubmed] Searching for "${term}"...`);

      const ids = await searchPubMed(term);

      // Track which papers came from which term (for multi-category mapping)
      for (const id of ids) {
        if (!papersById[id]) {
          papersById[id] = { foundByTerms: [], foundBySubcategory: [] };
        }
        papersById[id].foundByTerms.push(categories);
        if (subcategory) papersById[id].foundBySubcategory.push(subcategory);
      }

      progress.papersById = papersById;
      progress.lastSearchedTerm = term;
      progress.searchedTermCount = (progress.searchedTermCount || 0) + 1;
      saveProgress(progress);

      console.log(`[pubmed] Total unique papers found: ${Object.keys(papersById).length}`);
    }

    progress.phase = 'fetch';
    progress.searchComplete = true;
    saveProgress(progress);

    console.log(`\n[pubmed] Search phase complete: found ${Object.keys(papersById).length} unique papers`);
  } else {
    console.log(`[pubmed] Search phase already complete (${Object.keys(progress.papersById).length} papers found)\n`);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Phase 2: Fetch detailed metadata
  // ──────────────────────────────────────────────────────────────────────
  if (!progress.fetchComplete) {
    console.log(`[pubmed] Starting fetch phase...\n`);

    const idList = Object.keys(progress.papersById);
    const fetchedPapers = await fetchPaperDetails(idList);

    // Merge fetched metadata with tracked papers
    for (const [id, paperData] of Object.entries(fetchedPapers)) {
      if (progress.papersById[id]) {
        progress.papersById[id] = {
          ...progress.papersById[id],
          ...paperData,
        };
      }
    }

    progress.phase = 'upsert';
    progress.fetchComplete = true;
    saveProgress(progress);

    console.log(`\n[pubmed] Fetch phase complete: fetched details for ${Object.keys(fetchedPapers).length} papers`);
  } else {
    console.log(`[pubmed] Fetch phase already complete\n`);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Phase 3: Upsert to database
  // ──────────────────────────────────────────────────────────────────────
  if (!progress.upsertComplete) {
    console.log(`[pubmed] Starting upsert phase...\n`);

    // Build rows with proper category mapping
    const rows = [];
    for (const [id, paper] of Object.entries(progress.papersById)) {
      if (paper.url && paper.title) {
        const categoryId    = mapTermsToCategory(paper.foundByTerms);
        const subcategoryId = paper.foundBySubcategory?.[0] ?? null;
        rows.push({
          url: paper.url,
          original_url: paper.url,
          title: paper.title,
          description: paper.description || null,
          category_id:    categoryId,
          subcategory_id: subcategoryId,
          source: 'pubmed',
        });
      }
    }

    console.log(`[pubmed] Prepared ${rows.length} rows for upsert`);

    // Upsert in batches with progress tracking
    let upsertedCount = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error, count } = await supabase
        .from('urls')
        .upsert(batch, { onConflict: 'url', ignoreDuplicates: true })
        .select('id', { count: 'exact', head: true });

      if (error) {
        console.error(`[pubmed] Upsert error on batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
        throw new Error(`Batch failed: ${error.message}`);
      }

      upsertedCount += count ?? batch.length;
      console.log(`[pubmed] Batch ${Math.floor(i / BATCH_SIZE) + 1}: upserted ${batch.length} rows`);

      progress.upsertedCount = upsertedCount;
      saveProgress(progress);
    }

    progress.phase = 'complete';
    progress.upsertComplete = true;
    saveProgress(progress);

    console.log(`\n[pubmed] ✅ Upsert phase complete: ${upsertedCount} papers inserted`);
  } else {
    console.log(`[pubmed] Upsert phase already complete\n`);
  }

  console.log(`[pubmed] 🎉 PubMed seeding complete!\n`);
}

seedPubMed().catch((err) => {
  console.error('[pubmed] Fatal error:', err.message);
  console.error(err);
  process.exit(1);
});
