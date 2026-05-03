/**
 * seed-lesswrong.mjs — LessWrong seeder
 *
 * Pulls top-rated posts from LessWrong via their public GraphQL API.
 * LessWrong is a community focused on rationality, AI alignment, philosophy,
 * and applied epistemics. Top posts are carefully curated by karma.
 *
 * No API key required.
 *
 * Run from repo root:
 *   node scripts/seed-lesswrong.mjs
 *   node scripts/seed-lesswrong.mjs --no-cache
 *   node scripts/seed-lesswrong.mjs --min-karma 100   # default: 50
 *   node scripts/seed-lesswrong.mjs --limit 500       # default: 1000
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { config as dotenvConfig } from 'dotenv';
import { upsertUrls, CATEGORY, fetchWithRetry } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../.env') });

const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'lesswrong.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const karmaIdx  = process.argv.indexOf('--min-karma');
const MIN_KARMA = karmaIdx >= 0 ? Math.max(1, parseInt(process.argv[karmaIdx + 1], 10)) : 50;

const limitIdx = process.argv.indexOf('--limit');
const LIMIT    = limitIdx >= 0 ? Math.max(1, parseInt(process.argv[limitIdx + 1], 10)) : 1000;

const PAGE_SIZE = 50;  // LessWrong GraphQL returns up to 50 posts per query
const DELAY_MS  = 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const GQL_ENDPOINT = 'https://www.lesswrong.com/graphql';

// ── Tag → Roam category ───────────────────────────────────────────────────────
// LessWrong core tags mapped to closest Roam pillar
const TAG_CATEGORY = {
  'AI':                      CATEGORY.TECHNOLOGY,
  'Machine Learning':        CATEGORY.TECHNOLOGY,
  'Computer Science':        CATEGORY.TECHNOLOGY,
  'Programming':             CATEGORY.TECHNOLOGY,
  'Forecasting & Prediction':CATEGORY.SCIENCE,
  'Math':                    CATEGORY.SCIENCE,
  'Statistics':              CATEGORY.SCIENCE,
  'Physics':                 CATEGORY.SCIENCE,
  'Biology':                 CATEGORY.SCIENCE,
  'Neuroscience':            CATEGORY.MIND_BODY,
  'Psychology':              CATEGORY.MIND_BODY,
  'Mental Health':           CATEGORY.MIND_BODY,
  'Productivity':            CATEGORY.MIND_BODY,
  'Philosophy':              CATEGORY.HISTORY_IDEAS,
  'Ethics':                  CATEGORY.HISTORY_IDEAS,
  'History':                 CATEGORY.HISTORY_IDEAS,
  'Economics':               CATEGORY.HISTORY_IDEAS,
  'Politics':                CATEGORY.HISTORY_IDEAS,
};

function tagsToCategory(tags) {
  for (const tag of (tags ?? [])) {
    const cat = TAG_CATEGORY[tag.name];
    if (cat) return cat;
  }
  return CATEGORY.HISTORY_IDEAS; // rationality/philosophy default
}

// ── GraphQL query ─────────────────────────────────────────────────────────────
function buildQuery(offset) {
  return JSON.stringify({
    query: `
      {
        posts(input: {
          terms: {
            view: "top",
            limit: ${PAGE_SIZE},
            offset: ${offset}
          }
        }) {
          results {
            _id
            title
            pageUrl
            baseScore
            tags { name }
            postedAt
          }
        }
      }
    `,
  });
}

// ── Fetch one page ────────────────────────────────────────────────────────────
async function fetchPage(offset) {
  const res = await fetchWithRetry(GQL_ENDPOINT, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent':   'Roam-Seeder/1.0 (+https://roamtheweb.app)',
    },
    body: buildQuery(offset),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json?.data?.posts?.results ?? [];
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== LessWrong seeder ===');
  console.log(`    Min karma: ${MIN_KARMA}`);
  console.log(`    Limit:     ${LIMIT}\n`);

  let all;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    all = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[lesswrong] Loaded ${all.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    all = [];
    const seen = new Set();
    let offset = 0;

    while (all.length < LIMIT) {
      let posts;
      try {
        posts = await fetchPage(offset);
      } catch (err) {
        console.warn(`[lesswrong] Fetch error at offset ${offset}: ${err.message}`);
        break;
      }

      if (posts.length === 0) break;

      for (const post of posts) {
        const url = post.pageUrl;
        if (!url || seen.has(url)) continue;
        seen.add(url);

        all.push({
          url,
          title:        post.title ?? null,
          description:  post.excerpt ? post.excerpt.slice(0, 500) : null,
          og_image_url: null,
          category_id:  tagsToCategory(post.tags),
          source:       'lesswrong',
          seeder_score: Math.min((post.baseScore ?? 0) / 1000, 1.0),
          published_at: post.postedAt ?? null,  // ISO 8601 from GraphQL
        });
      }

      process.stdout.write(`\r[lesswrong] Fetched ${all.length} posts (offset ${offset})  `);
      offset += PAGE_SIZE;

      if (posts.length < PAGE_SIZE) break; // last page
      await sleep(DELAY_MS);
    }

    console.log(`\n[lesswrong] Total collected: ${all.length}`);
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(all));
  }

  console.log(`\n[lesswrong] Total: ${all.length} — upserting...`);
  const result = await upsertUrls(all, { fetchOg: true, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
