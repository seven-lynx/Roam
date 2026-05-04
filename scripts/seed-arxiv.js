/**
 * seed-arxiv.js — arXiv seeder
 *
 * Pulls recent papers from curated arXiv subject categories via the Atom API.
 * No API key required. arXiv asks for 3 seconds between requests.
 *
 * Run from repo root:
 *   node scripts/seed-arxiv.js
 *   node scripts/seed-arxiv.js --no-cache   # re-fetch from API
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY, SUBCATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'arxiv.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const RESULTS_PER_QUERY = 300;   // safe page size (max 2000, but large responses are slow)
const DELAY_MS           = 3000; // arXiv guidelines: 3s between requests
const MAX_AGE_YEARS      = 5;    // skip papers not updated in the past 5 years

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── arXiv subject category → Roam category ───────────────────────────────────
const SUBJECT_MAP = [
  // Technology
  { subject: 'cs.AI',          categoryId: CATEGORY.TECHNOLOGY, subcategoryId: SUBCATEGORY.AI_MACHINE_LEARNING },   // Artificial Intelligence
  { subject: 'cs.LG',          categoryId: CATEGORY.TECHNOLOGY, subcategoryId: SUBCATEGORY.AI_MACHINE_LEARNING },   // Machine Learning
  { subject: 'cs.CL',          categoryId: CATEGORY.TECHNOLOGY, subcategoryId: SUBCATEGORY.AI_MACHINE_LEARNING },   // Computation & Language (NLP)
  { subject: 'cs.CV',          categoryId: CATEGORY.TECHNOLOGY, subcategoryId: SUBCATEGORY.AI_MACHINE_LEARNING },   // Computer Vision
  { subject: 'cs.CR',          categoryId: CATEGORY.TECHNOLOGY, subcategoryId: SUBCATEGORY.CYBERSECURITY_PRIVACY }, // Cryptography & Security
  { subject: 'cs.SE',          categoryId: CATEGORY.TECHNOLOGY, subcategoryId: SUBCATEGORY.PROGRAMMING_SOFTWARE },  // Software Engineering
  { subject: 'cs.NI',          categoryId: CATEGORY.TECHNOLOGY, subcategoryId: SUBCATEGORY.INTERNET_CULTURE },      // Networking & Internet
  { subject: 'cs.RO',          categoryId: CATEGORY.TECHNOLOGY, subcategoryId: SUBCATEGORY.ROBOTICS_AUTOMATION },   // Robotics
  { subject: 'cs.HC',          categoryId: CATEGORY.TECHNOLOGY, subcategoryId: SUBCATEGORY.DESIGN_UX },             // Human-Computer Interaction
  { subject: 'eess.SP',        categoryId: CATEGORY.TECHNOLOGY, subcategoryId: SUBCATEGORY.HARDWARE_ELECTRONICS },  // Signal Processing

  // Science
  { subject: 'astro-ph.GA',    categoryId: CATEGORY.SCIENCE,    subcategoryId: SUBCATEGORY.SPACE_ASTRONOMY },        // Galaxies
  { subject: 'astro-ph.EP',    categoryId: CATEGORY.SCIENCE,    subcategoryId: SUBCATEGORY.SPACE_ASTRONOMY },        // Earth & Planetary Science
  { subject: 'astro-ph.SR',    categoryId: CATEGORY.SCIENCE,    subcategoryId: SUBCATEGORY.SPACE_ASTRONOMY },        // Solar & Stellar Astrophysics
  { subject: 'quant-ph',       categoryId: CATEGORY.SCIENCE,    subcategoryId: SUBCATEGORY.PHYSICS_CHEMISTRY },      // Quantum Physics
  { subject: 'cond-mat.mtrl-sci', categoryId: CATEGORY.SCIENCE, subcategoryId: SUBCATEGORY.PHYSICS_CHEMISTRY },      // Materials Science
  { subject: 'physics.bio-ph', categoryId: CATEGORY.SCIENCE,    subcategoryId: SUBCATEGORY.BIOLOGY_EVOLUTION },      // Biological Physics
  { subject: 'physics.chem-ph',categoryId: CATEGORY.SCIENCE,    subcategoryId: SUBCATEGORY.PHYSICS_CHEMISTRY },      // Chemical Physics
  { subject: 'math.NT',        categoryId: CATEGORY.SCIENCE,    subcategoryId: SUBCATEGORY.MATHEMATICS_LOGIC },      // Number Theory
  { subject: 'math.CO',        categoryId: CATEGORY.SCIENCE,    subcategoryId: SUBCATEGORY.MATHEMATICS_LOGIC },      // Combinatorics
  { subject: 'q-bio.GN',       categoryId: CATEGORY.SCIENCE,    subcategoryId: SUBCATEGORY.BIOLOGY_EVOLUTION },      // Genomics

  // Health & Wellness → Mind & Body
  { subject: 'q-bio.NC',       categoryId: CATEGORY.MIND_BODY,  subcategoryId: SUBCATEGORY.NEUROSCIENCE },           // Neurons & Cognition
  { subject: 'q-bio.PE',       categoryId: CATEGORY.SCIENCE,    subcategoryId: SUBCATEGORY.BIOLOGY_EVOLUTION },      // Populations & Evolution
];

// ── XML helpers ───────────────────────────────────────────────────────────────

/** Extract all <entry> blocks from Atom XML */
function parseEntries(xml) {
  const entries = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  while ((match = entryRe.exec(xml)) !== null) {
    entries.push(match[1]);
  }
  return entries;
}

function extractTag(entry, tag) {
  const m = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].trim().replace(/\s+/g, ' ') : null;
}

/** Normalise arXiv abstract URL — strip version suffix */
function arxivUrl(rawId) {
  // rawId is like http://arxiv.org/abs/2301.00001v2
  return rawId
    .replace(/^http:/, 'https:')
    .replace(/v\d+$/, '');
}

// ── Fetch from arXiv API ──────────────────────────────────────────────────────

async function fetchSubject({ subject, categoryId, subcategoryId }) {
  const url =
    `https://export.arxiv.org/api/query` +
    `?search_query=cat:${encodeURIComponent(subject)}` +
    `&max_results=${RESULTS_PER_QUERY}` +
    `&sortBy=submittedDate&sortOrder=descending`;

  let xml;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app; seeder bot)' },
    });
    if (!res.ok) {
      console.warn(`[arxiv]   ${subject}: HTTP ${res.status}`);
      return [];
    }
    xml = await res.text();
  } catch (err) {
    console.warn(`[arxiv]   ${subject}: fetch error — ${err.message}`);
    return [];
  }

  const entries = parseEntries(xml);
  const rows = [];
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - MAX_AGE_YEARS);

  for (const entry of entries) {
    const rawId = extractTag(entry, 'id');
    if (!rawId || !rawId.includes('arxiv.org')) continue;

    // Skip papers not updated within the past MAX_AGE_YEARS years
    const updatedStr = extractTag(entry, 'updated');
    if (updatedStr) {
      const updatedDate = new Date(updatedStr);
      if (!isNaN(updatedDate.getTime()) && updatedDate < cutoff) continue;
    }

    const title   = extractTag(entry, 'title');
    const summary = extractTag(entry, 'summary');

    rows.push({
      url:          arxivUrl(rawId),
      title:        title ?? null,
      description:  summary ? summary.slice(0, 500) : null,
      og_image_url: null,  // papers don't have OG images; skip the fetch
      category_id:    categoryId,
      subcategory_id: subcategoryId ?? null,
      source:       'arxiv',
      published_at: updatedStr ?? null,
    });
  }

  return rows;
}

async function fetchAllSubjects() {
  console.log(`\n[arxiv] Fetching ${SUBJECT_MAP.length} subject categories...`);
  const rows = [];

  for (const subject of SUBJECT_MAP) {
    console.log(`[arxiv]   ${subject.subject}`);
    const batch = await fetchSubject(subject);
    rows.push(...batch);
    console.log(`[arxiv]     -> ${batch.length} papers`);
    await sleep(DELAY_MS);
  }

  console.log(`[arxiv] Total collected: ${rows.length}`);
  return rows;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== arXiv seeder ===');

  let rows;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[arxiv] Loaded ${rows.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    rows = await fetchAllSubjects();
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(rows));
    console.log(`[arxiv] Cached ${rows.length} rows to ${CACHE_FILE}`);
  }

  // Papers have title + abstract already — no OG fetch needed
  console.log(`\n[arxiv] Total: ${rows.length} — upserting...`);
  const result = await upsertUrls(rows, { fetchOg: false, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
