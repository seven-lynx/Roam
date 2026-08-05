/**
 * seed-github.js — GitHub repository seeder
 *
 * Queries the GitHub Search API for popular repos by topic.
 * No API key required (10 req/min unauthenticated).
 * Optional: GITHUB_TOKEN in .env raises limit to 30 req/min.
 *
 * Rate limit: 6.5s between requests (unauthenticated), 2.5s (authenticated).
 *
 * Run from repo root:
 *   node scripts/seed-github.js
 *   node scripts/seed-github.js --no-cache   # re-fetch from API
 *   node scripts/seed-github.js --reset       # clear cache and restart
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'github.json');
const NO_CACHE   = process.argv.includes('--no-cache');
const RESET      = process.argv.includes('--reset');

// GitHub Search API returns max 1000 results per query (10 pages × 100)
const RESULTS_PER_PAGE = 100;
const PAGES_PER_TOPIC  = 3; // 300 repos per topic max
const MIN_STARS        = 500; // quality filter

// ── Topic → Roam category mapping ────────────────────────────────────────────
// Each entry: { topic, category_id }
// GitHub topics: https://github.com/topics
const TOPICS = [
  // Technology
  { topic: 'web',                category: CATEGORY.TECHNOLOGY },
  { topic: 'cli',                category: CATEGORY.TECHNOLOGY },
  { topic: 'devtools',           category: CATEGORY.TECHNOLOGY },
  { topic: 'developer-tools',    category: CATEGORY.TECHNOLOGY },
  { topic: 'open-source',        category: CATEGORY.TECHNOLOGY },
  { topic: 'security',           category: CATEGORY.TECHNOLOGY },
  { topic: 'networking',         category: CATEGORY.TECHNOLOGY },
  { topic: 'infrastructure',     category: CATEGORY.TECHNOLOGY },
  { topic: 'api',                category: CATEGORY.TECHNOLOGY },
  { topic: 'database',           category: CATEGORY.TECHNOLOGY },
  { topic: 'terminal',           category: CATEGORY.TECHNOLOGY },
  { topic: 'productivity',       category: CATEGORY.TECHNOLOGY },

  // Science & Nature
  { topic: 'bioinformatics',     category: CATEGORY.SCIENCE },
  { topic: 'astronomy',          category: CATEGORY.SCIENCE },
  { topic: 'physics',            category: CATEGORY.SCIENCE },
  { topic: 'chemistry',          category: CATEGORY.SCIENCE },
  { topic: 'scientific-computing', category: CATEGORY.SCIENCE },
  { topic: 'data-science',       category: CATEGORY.SCIENCE },
  { topic: 'machine-learning',   category: CATEGORY.SCIENCE },

  // Arts & Culture
  { topic: 'music',              category: CATEGORY.ARTS_CULTURE },
  { topic: 'audio',              category: CATEGORY.ARTS_CULTURE },
  { topic: 'creative-coding',    category: CATEGORY.ARTS_CULTURE },
  { topic: 'generative-art',     category: CATEGORY.ARTS_CULTURE },
  { topic: 'visualization',      category: CATEGORY.ARTS_CULTURE },
  { topic: 'photography',        category: CATEGORY.ARTS_CULTURE },

  // Games & Hobbies
  { topic: 'game',               category: CATEGORY.GAMES_HOBBIES },
  { topic: 'game-development',   category: CATEGORY.GAMES_HOBBIES },
  { topic: 'game-engine',        category: CATEGORY.GAMES_HOBBIES },
  { topic: '3d',                 category: CATEGORY.GAMES_HOBBIES },

  // Mind & Body
  { topic: 'health',             category: CATEGORY.MIND_BODY },
  { topic: 'healthcare',         category: CATEGORY.MIND_BODY },
  { topic: 'medical',            category: CATEGORY.MIND_BODY },
  { topic: 'mental-health',      category: CATEGORY.MIND_BODY },

  // Weird & Wonderful
  { topic: 'generative',         category: CATEGORY.WEIRD_WONDERFUL },
  { topic: 'creative',           category: CATEGORY.WEIRD_WONDERFUL },
  { topic: 'art',                category: CATEGORY.WEIRD_WONDERFUL },
  { topic: 'experimental',       category: CATEGORY.WEIRD_WONDERFUL },

  // History & Ideas
  { topic: 'education',          category: CATEGORY.HISTORY_IDEAS },
  { topic: 'learning',           category: CATEGORY.HISTORY_IDEAS },
  { topic: 'books',              category: CATEGORY.HISTORY_IDEAS },
  { topic: 'philosophy',         category: CATEGORY.HISTORY_IDEAS },

  // People & Places
  { topic: 'maps',               category: CATEGORY.PEOPLE_PLACES },
  { topic: 'geography',          category: CATEGORY.PEOPLE_PLACES },
  { topic: 'gis',                category: CATEGORY.PEOPLE_PLACES },
  { topic: 'travel',             category: CATEGORY.PEOPLE_PLACES },
];

// ── GitHub Search API ─────────────────────────────────────────────────────────

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchReposByTopic(topic, categoryId, delay) {
  const repos = [];
  const seen  = new Set();

  for (let page = 1; page <= PAGES_PER_TOPIC; page++) {
    const url =
      `https://api.github.com/search/repositories` +
      `?q=topic:${encodeURIComponent(topic)}+stars:>${MIN_STARS}+is:public` +
      `&sort=stars&order=desc` +
      `&per_page=${RESULTS_PER_PAGE}&page=${page}`;

    const headers = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    let data;
    try {
      await sleep(delay);
      const res = await fetch(url, { headers });

      // Handle rate limiting
      if (res.status === 403 || res.status === 429) {
        const resetAt = parseInt(res.headers.get('x-ratelimit-reset') || '0') * 1000;
        const waitMs  = Math.max(resetAt - Date.now(), 10000);
        console.warn(`[github]   Rate limited — waiting ${Math.ceil(waitMs / 1000)}s...`);
        await sleep(waitMs);
        // Retry once
        const retry = await fetch(url, { headers });
        if (!retry.ok) {
          console.warn(`[github]   topic=${topic} page=${page}: HTTP ${retry.status} after retry`);
          break;
        }
        data = await retry.json();
      } else if (!res.ok) {
        console.warn(`[github]   topic=${topic} page=${page}: HTTP ${res.status}`);
        break;
      } else {
        data = await res.json();
      }
    } catch (err) {
      console.warn(`[github]   topic=${topic} page=${page}: fetch error — ${err.message}`);
      break;
    }

    const items = data?.items ?? [];
    if (items.length === 0) break;

    for (const repo of items) {
      if (!repo.html_url || seen.has(repo.html_url)) continue;
      if (!repo.description) continue; // skip repos with no description
      if (repo.archived) continue;     // skip archived repos
      seen.add(repo.html_url);

      repos.push({
        url:          repo.html_url,
        title:        repo.full_name,
        description:  repo.description.slice(0, 500),
        category_id:  categoryId,
        source:       'github',
        seeder_score: Math.min((repo.stargazers_count ?? 0) / 10000, 1.0),  // 10000 stars = top-tier repo
      });
    }

    console.log(`[github]   topic=${topic} page=${page}: ${items.length} repos (${repos.length} kept)`);

    // Stop early if we got fewer results than page size (no more pages)
    if (items.length < RESULTS_PER_PAGE) break;
  }

  return repos;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

  if (RESET && existsSync(CACHE_FILE)) {
    const { unlinkSync } = await import('fs');
    unlinkSync(CACHE_FILE);
    console.log('[github] Cache cleared.');
  }

  let allRepos;

  if (!NO_CACHE && !RESET && existsSync(CACHE_FILE)) {
    console.log('[github] Loading from cache...');
    allRepos = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[github] ${allRepos.length} repos loaded from cache.`);
  } else {
    // Determine rate limit delay
    const hasToken = !!process.env.GITHUB_TOKEN;
    const DELAY_MS = hasToken ? 2500 : 6600; // 30 req/min vs 10 req/min with margin
    console.log(`\n[github] Fetching repos (${TOPICS.length} topics × up to ${PAGES_PER_TOPIC} pages)...`);
    console.log(`[github] Rate: ${hasToken ? 'authenticated' : 'unauthenticated'} — ${DELAY_MS}ms delay`);

    allRepos = [];
    const globalSeen = new Set();

    for (const { topic, category } of TOPICS) {
      const repos = await fetchReposByTopic(topic, category, DELAY_MS);
      // Deduplicate across topics
      for (const repo of repos) {
        if (!globalSeen.has(repo.url)) {
          globalSeen.add(repo.url);
          allRepos.push(repo);
        }
      }
      console.log(`[github] topic=${topic}: ${repos.length} repos → total ${allRepos.length}`);
    }

    writeFileSync(CACHE_FILE, JSON.stringify(allRepos, null, 2));
    console.log(`\n[github] Cached ${allRepos.length} repos to ${CACHE_FILE}`);
  }

  if (allRepos.length === 0) {
    console.log('[github] No repos to upsert.');
    return;
  }

  console.log(`\n[github] Total: ${allRepos.length} repos — upserting...`);
  await upsertUrls(allRepos, { checkLive: true,  fetchOg: false, verbose: false });
  console.log('[github] 🎉 GitHub seeding complete!');
}

main().catch(err => {
  console.error('[github] Fatal error:', err);
  process.exit(1);
});
