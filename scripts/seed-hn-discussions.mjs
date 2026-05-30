/**
 * seed-hn-discussions.mjs — Hacker News Ask HN seeder
 *
 * Seeds high-quality Ask HN threads via the Algolia HN Search API.
 * Ask HN posts are the community's collective intelligence: career advice,
 * reading lists, technical deep-dives, retrospectives, and open questions
 * that generate hundreds of thoughtful replies.
 *
 * Unlike the main HN seeder (which collects external linked articles with
 * points > 200), this seeder targets Ask HN posts themselves — the HN
 * discussion page is the content. Only threads with ≥ 200 points AND
 * ≥ 100 comments are included to ensure genuine depth.
 *
 * No API key required. Algolia API: https://hn.algolia.com/api
 *
 * Run from repo root:
 *   node scripts/seed-hn-discussions.mjs
 *   node scripts/seed-hn-discussions.mjs --no-cache
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { config as dotenvConfig } from 'dotenv';
import { upsertUrls, CATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../.env') });

const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'hn-discussions.json');
const NO_CACHE   = process.argv.includes('--no-cache');

// Fetch enough pages to cover the best Ask HN threads of all time.
// Algolia returns up to 1000 results per page; 3 pages × 1000 = 3 000 candidates.
const PAGES          = 3;
const HITS_PER_PAGE  = 1000;
const MIN_POINTS     = 200;
const MIN_COMMENTS   = 100; // genuine discussion only

const fmtEta = (done, total, startMs) => {
  if (done === 0) return '?';
  const s = Math.round(((Date.now() - startMs) / done) * (total - done) / 1000);
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
};

// ── Keyword → Roam category ───────────────────────────────────────────────────
function inferCategory(title) {
  const t = (title ?? '').toLowerCase();

  if (/\bask hn: who (is|are) hiring\b|\bjob\b|\bhiring\b|\brecruiting\b/.test(t)) {
    return null; // skip job threads — not discoverable content
  }
  if (/\bscience\b|physics|biology|climate|space|astronomy|math|research|study|evolution|nature/.test(t))
    return CATEGORY.SCIENCE;
  if (/\bai\b|machine learning|neural|llm|gpt|deep learning|robotics/.test(t))
    return CATEGORY.TECHNOLOGY;
  if (/\btech\b|software|internet|algorithm|computer|code|programming|data|startup|engineer/.test(t))
    return CATEGORY.TECHNOLOGY;
  if (/\bhistory\b|philosophy|politics|economics|society|essay|ideas|democracy|book/.test(t))
    return CATEGORY.HISTORY_IDEAS;
  if (/\bgame\b|hobby|food|recipe|sport|cooking|travel|hiking|garden/.test(t))
    return CATEGORY.GAMES_HOBBIES;
  if (/\bhealth\b|mental|meditation|sleep|exercise|wellness|psychology|anxiety|habit/.test(t))
    return CATEGORY.MIND_BODY;
  if (/\bplace\b|city|country|map|community|culture|language/.test(t))
    return CATEGORY.PEOPLE_PLACES;
  if (/\bwhat are you|what do you|favourite|favorite|recommend|resource|learn|read/.test(t))
    return CATEGORY.TECHNOLOGY; // most HN recommendation threads skew tech

  return CATEGORY.TECHNOLOGY; // default — most Ask HN is tech-adjacent
}

// ── Fetch Ask HN threads from Algolia ────────────────────────────────────────
async function fetchAskHN() {
  console.log(`\n[hn-discussions] Fetching Ask HN threads (points > ${MIN_POINTS}, comments > ${MIN_COMMENTS})...`);
  const rows = [];
  const seen = new Set();
  const startMs = Date.now();

  for (let page = 0; page < PAGES; page++) {
    const url =
      `https://hn.algolia.com/api/v1/search` +
      `?tags=ask_hn` +
      `&hitsPerPage=${HITS_PER_PAGE}` +
      `&numericFilters=points%3E${MIN_POINTS},num_comments%3E${MIN_COMMENTS}` +
      `&page=${page}`;

    let data;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Roam-Seeder/1.0 (+https://roamtheweb.app)' },
      });
      if (!res.ok) { console.warn(`[hn-discussions]   page ${page}: HTTP ${res.status}`); continue; }
      data = await res.json();
    } catch (err) {
      console.warn(`[hn-discussions]   page ${page}: fetch error — ${err.message}`);
      continue;
    }

    const hits = data?.hits ?? [];
    console.log(`[hn-discussions]   page ${page + 1}/${PAGES}: ${hits.length} hits  (total=${rows.length}, eta=${fmtEta(page + 1, PAGES, startMs)})`);

    for (const hit of hits) {
      if (!hit.objectID || seen.has(hit.objectID)) continue;

      const category = inferCategory(hit.title);
      if (category === null) continue; // skip job threads

      const hnUrl = `https://news.ycombinator.com/item?id=${hit.objectID}`;
      seen.add(hit.objectID);

      rows.push({
        url:          hnUrl,
        title:        hit.title ?? null,
        description:  null, // OG fetch retrieves discussion summary
        og_image_url: null,
        category_id:  category,
        source:       'hn-ask',
        seeder_score: Math.min((hit.points ?? 0) / 1000, 1.0), // 1 000 pts = top-tier thread
        published_at: hit.created_at ?? null,
        language:     'en',
      });
    }

    // Algolia has no strict rate limit, but add a small pause to be polite
    if (page < PAGES - 1) await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`[hn-discussions] Threads collected: ${rows.length}`);
  return rows;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Hacker News Discussions seeder ===');

  let rows;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[hn-discussions] Loaded ${rows.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    rows = await fetchAskHN();
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(rows));
    console.log(`[hn-discussions] Cached ${rows.length} rows`);
  }

  console.log(`\n[hn-discussions] Total: ${rows.length} — upserting...`);
  // fetchOg=true: each HN discussion page has a meaningful og:title/description.
  const result = await upsertUrls(rows, { fetchOg: true, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
