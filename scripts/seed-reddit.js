/**
 * seed-reddit.js — Reddit seeder
 *
 * Fetches top posts from curated subreddits via Reddit's public JSON API.
 * No API key required. Uses reddit.com/r/<subreddit>/top.json.
 *
 * Only external URLs are collected (no self-posts, no reddit.com links).
 * Posts are sorted by all-time top to get the highest quality signal.
 *
 * Run from repo root:
 *   node scripts/seed-reddit.js             # resume or start
 *   node scripts/seed-reddit.js --no-cache  # re-fetch from API
 *   node scripts/seed-reddit.js --reset     # clear progress and start over
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY } from './lib/seed.js';

const __dirname   = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR   = resolve(__dirname, '.cache');
const CACHE_FILE  = resolve(CACHE_DIR, 'reddit.json');
const PROGRESS_FILE = resolve(CACHE_DIR, 'reddit-progress.json');
const NO_CACHE    = process.argv.includes('--no-cache');
const RESET       = process.argv.includes('--reset');

const BATCH_SIZE  = 50;
const SLEEP_MS    = 2000;  // 2s between subreddit requests — respectful rate limiting

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Subreddit list with category mapping ──────────────────────────────────────
// Each entry: [subreddit, category_id, limit]
// limit = number of top posts to fetch (max 100 per request, up to 1000 via pagination)

const SUBREDDITS = [
  // Technology
  ['programming',       CATEGORY.TECHNOLOGY,    500],
  ['webdev',            CATEGORY.TECHNOLOGY,    300],
  ['MachineLearning',   CATEGORY.TECHNOLOGY,    300],
  ['opensource',        CATEGORY.TECHNOLOGY,    200],
  ['netsec',            CATEGORY.TECHNOLOGY,    200],
  ['devops',            CATEGORY.TECHNOLOGY,    200],

  // Science
  ['science',           CATEGORY.SCIENCE,       500],
  ['space',             CATEGORY.SCIENCE,       300],
  ['Physics',           CATEGORY.SCIENCE,       200],
  ['biology',           CATEGORY.SCIENCE,       200],
  ['chemistry',         CATEGORY.SCIENCE,       200],

  // Mind & Body
  ['nutrition',         CATEGORY.MIND_BODY,     200],
  ['Fitness',           CATEGORY.MIND_BODY,     200],
  ['meditation',        CATEGORY.MIND_BODY,     200],
  ['psychology',        CATEGORY.MIND_BODY,     200],
  ['mentalhealth',      CATEGORY.MIND_BODY,     200],

  // History & Ideas
  ['history',           CATEGORY.HISTORY_IDEAS, 500],
  ['AskHistorians',     CATEGORY.HISTORY_IDEAS, 300],
  ['philosophy',        CATEGORY.HISTORY_IDEAS, 300],
  ['geopolitics',       CATEGORY.HISTORY_IDEAS, 200],

  // Literature & Writing (maps to ARTS_CULTURE)
  ['books',             CATEGORY.ARTS_CULTURE,  400],
  ['literature',        CATEGORY.ARTS_CULTURE,  200],
  ['writing',           CATEGORY.ARTS_CULTURE,  200],
  ['poetry',            CATEGORY.ARTS_CULTURE,  100],

  // Arts & Culture
  ['Art',               CATEGORY.ARTS_CULTURE,  300],
  ['design',            CATEGORY.ARTS_CULTURE,  200],
  ['architecture',      CATEGORY.ARTS_CULTURE,  200],
  ['movies',            CATEGORY.ARTS_CULTURE,  200],
  ['Music',             CATEGORY.ARTS_CULTURE,  200],

  // People & Places
  ['travel',            CATEGORY.PEOPLE_PLACES, 300],
  ['solotravel',        CATEGORY.PEOPLE_PLACES, 200],
  ['geography',         CATEGORY.PEOPLE_PLACES, 200],

  // Games & Hobbies
  ['boardgames',        CATEGORY.GAMES_HOBBIES, 200],
  ['chess',             CATEGORY.GAMES_HOBBIES, 200],
  ['DIY',               CATEGORY.GAMES_HOBBIES, 200],
  ['homebrewing',       CATEGORY.GAMES_HOBBIES, 150],
];

// Patterns to skip — reddit-internal and known noise
const SKIP_DOMAINS = /^https?:\/\/(www\.)?(reddit\.com|redd\.it|i\.redd\.it|v\.redd\.it)/i;

// ── Progress checkpoint ────────────────────────────────────────────────────────

function loadProgress() {
  if (RESET) {
    console.log('[reddit] --reset: starting from scratch\n');
    return { subredditsComplete: [], upsertedCount: 0 };
  }
  if (!existsSync(PROGRESS_FILE)) {
    return { subredditsComplete: [], upsertedCount: 0 };
  }
  try {
    const data = JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
    console.log(`[reddit] Resuming — ${data.subredditsComplete.length}/${SUBREDDITS.length} subreddits done, ${data.upsertedCount} rows inserted\n`);
    return data;
  } catch {
    return { subredditsComplete: [], upsertedCount: 0 };
  }
}

function saveProgress(data) {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(PROGRESS_FILE, JSON.stringify({ ...data, lastUpdated: new Date().toISOString() }, null, 2));
}

// ── Fetch one subreddit ────────────────────────────────────────────────────────

async function fetchSubreddit(subreddit, limit) {
  const rows = [];
  const seen = new Set();
  let after = null;
  const batchSize = 100;  // Reddit max per request
  let fetched = 0;

  while (fetched < limit) {
    const thisPage = Math.min(batchSize, limit - fetched);
    const url = `https://www.reddit.com/r/${subreddit}/top.json?limit=${thisPage}&t=all${after ? `&after=${after}` : ''}`;

    let data;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Roam-Seeder/1.0 (non-commercial hobby project; https://roamtheweb.app)' },
      });

      if (res.status === 429) {
        console.warn(`[reddit]   r/${subreddit}: rate limited, waiting 10s...`);
        await sleep(10000);
        continue;
      }

      if (res.status === 403 || res.status === 404) {
        console.warn(`[reddit]   r/${subreddit}: HTTP ${res.status} — skipping`);
        return rows;
      }

      if (!res.ok) {
        console.warn(`[reddit]   r/${subreddit}: HTTP ${res.status}`);
        return rows;
      }

      data = await res.json();
    } catch (err) {
      console.warn(`[reddit]   r/${subreddit}: fetch error — ${err.message}`);
      return rows;
    }

    const posts = data?.data?.children ?? [];
    if (posts.length === 0) break;

    for (const { data: post } of posts) {
      const rawUrl = post.url;
      if (!rawUrl || SKIP_DOMAINS.test(rawUrl) || seen.has(rawUrl)) continue;
      // Skip self-posts and low-engagement posts
      if (post.is_self) continue;
      if ((post.score ?? 0) < 50) continue;

      seen.add(rawUrl);
      rows.push({
        url:          rawUrl,
        title:        post.title?.trim() ?? null,
        description:  null,
        og_image_url: null,
        category_id:  null,   // set by caller
        source:       'reddit',
        seeder_score: Math.min((post.score ?? 0) / 5000, 1.0),
        published_at: post.created_utc
                        ? new Date(post.created_utc * 1000).toISOString()
                        : null,
      });
    }

    fetched += posts.length;
    after = data?.data?.after;
    if (!after) break;  // No more pages
  }

  return rows;
}

// ── Main seeder ────────────────────────────────────────────────────────────────

async function seedReddit() {
  console.log('\n========== Reddit Seeder ==========\n');

  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

  const progress = loadProgress();

  // Load existing cache or start fresh
  let allRows = [];
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    try {
      allRows = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
      console.log(`[reddit] Loaded ${allRows.length} cached rows\n`);
    } catch {
      allRows = [];
    }
  }

  // Fetch subreddits not yet complete
  for (const [subreddit, categoryId, limit] of SUBREDDITS) {
    if (progress.subredditsComplete.includes(subreddit)) {
      console.log(`[reddit] Skipping r/${subreddit} (already done)`);
      continue;
    }

    console.log(`[reddit] Fetching r/${subreddit} (top ${limit})...`);
    const rows = await fetchSubreddit(subreddit, limit);

    // Attach category
    const tagged = rows.map((r) => ({ ...r, category_id: categoryId }));
    allRows.push(...tagged);
    console.log(`[reddit]   r/${subreddit}: ${rows.length} URLs collected`);

    // Save checkpoint after each subreddit
    progress.subredditsComplete.push(subreddit);
    saveProgress(progress);

    // Write full cache
    writeFileSync(CACHE_FILE, JSON.stringify(allRows, null, 2));

    await sleep(SLEEP_MS);
  }

  console.log(`\n[reddit] Total URLs collected: ${allRows.length}`);
  console.log(`[reddit] Starting upsert...\n`);

  // Upsert in batches
  let upserted = 0;
  for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
    const batch = allRows.slice(i, i + BATCH_SIZE);
    try {
      const result = await upsertUrls(batch, { fetchOg: false });
      upserted += result?.inserted ?? batch.length;
    } catch (err) {
      console.error(`[reddit] Upsert error on batch ${Math.floor(i / BATCH_SIZE) + 1}:`, err.message);
    }
    progress.upsertedCount = upserted;
    saveProgress(progress);
  }

  console.log(`\n[reddit] Done. Upserted ${upserted} rows.`);
  console.log(`[reddit] Source: reddit.com/r/<subreddit>/top.json (public JSON API)\n`);
}

seedReddit().catch((err) => {
  console.error('[reddit] Fatal:', err);
  process.exit(1);
});
