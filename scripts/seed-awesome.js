/**
 * seed-awesome.js — Awesome Lists seeder
 *
 * Scrapes curated "awesome-*" GitHub lists by fetching their raw README.md
 * files directly from raw.githubusercontent.com (no API key required).
 * Extracts all https:// links and upserts them into Roam.
 *
 * Run from repo root:
 *   node scripts/seed-awesome.js
 *   node scripts/seed-awesome.js --no-cache
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { upsertUrls, CATEGORY } from './lib/seed.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'awesome.json');
const NO_CACHE   = process.argv.includes('--no-cache');

const DELAY_MS = 800;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Curated awesome lists → Roam categories ───────────────────────────────────
// Format: { repo: 'owner/repo', branch: 'main'|'master', categoryId }
const AWESOME_LISTS = [
  // Technology
  { repo: 'sindresorhus/awesome',              branch: 'main',   categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'vinta/awesome-python',              branch: 'master', categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'sorrycc/awesome-javascript',        branch: 'master', categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'rust-unofficial/awesome-rust',      branch: 'master', categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'avelino/awesome-go',                branch: 'main',   categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'akullpp/awesome-java',              branch: 'master', categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'matteocrippa/awesome-swift',        branch: 'master', categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'vsouza/awesome-ios',                branch: 'master', categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'JStumpp/awesome-android',           branch: 'master', categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'enaqx/awesome-react',               branch: 'master', categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'vuejs/awesome-vue',                 branch: 'master', categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'serverless/awesome-serverless',     branch: 'master', categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'docker/awesome-compose',            branch: 'master', categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'agarrharr/awesome-cli-apps',        branch: 'master', categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'trimstray/the-book-of-secret-knowledge', branch: 'master', categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'EbookFoundation/free-programming-books', branch: 'main', categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'awesome-selfhosted/awesome-selfhosted', branch: 'master', categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'jnv/lists',                         branch: 'master', categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'tiimgreen/github-cheat-sheet',      branch: 'master', categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'Hack-with-Github/Awesome-Hacking',  branch: 'master', categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'awesome-foss/awesome-sysadmin',     branch: 'master', categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'n1trux/awesome-sysadmin',           branch: 'master', categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'kdeldycke/awesome-falsehood',       branch: 'main',   categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'dastergon/awesome-sre',             branch: 'master', categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'mfornos/awesome-microservices',     branch: 'master', categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'phalcon/awesome-phalcon',           branch: 'master', categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'josephmisiti/awesome-machine-learning', branch: 'master', categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'eugeneyan/applied-ml',              branch: 'master', categoryId: CATEGORY.TECHNOLOGY },
  { repo: 'openai/openai-cookbook',            branch: 'main',   categoryId: CATEGORY.TECHNOLOGY },

  // Science
  { repo: 'heshamdesouky/awesome-physics',     branch: 'master', categoryId: CATEGORY.SCIENCE },
  { repo: 'Open-Astrophysics-Bookshelf/awesome-astronomy', branch: 'master', categoryId: CATEGORY.SCIENCE },
  { repo: 'catalyst-cooperative/awesome-open-climate-science', branch: 'main', categoryId: CATEGORY.SCIENCE },
  { repo: 'kakoni/awesome-healthcare',         branch: 'master', categoryId: CATEGORY.SCIENCE },
  { repo: 'pyscience11/awesome-science',       branch: 'master', categoryId: CATEGORY.SCIENCE },

  // Arts & Culture
  { repo: 'obfuscation/awesome-generative-art', branch: 'master', categoryId: CATEGORY.ARTS_CULTURE },
  { repo: 'kosmos/awesome-generative-art',     branch: 'master', categoryId: CATEGORY.ARTS_CULTURE },
  { repo: 'terkelg/awesome-creative-coding',   branch: 'master', categoryId: CATEGORY.ARTS_CULTURE },
  { repo: 'eug/awesome-opengl',                branch: 'master', categoryId: CATEGORY.ARTS_CULTURE },
  { repo: 'ellisonleao/magictools',             branch: 'main',   categoryId: CATEGORY.ARTS_CULTURE },

  // History & Ideas
  { repo: 'learn-anything/books',              branch: 'master', categoryId: CATEGORY.HISTORY_IDEAS },
  { repo: 'hackerkid/Mind-Expanding-Books',    branch: 'master', categoryId: CATEGORY.HISTORY_IDEAS },
  { repo: 'mercer/reading-list',               branch: 'master', categoryId: CATEGORY.HISTORY_IDEAS },

  // Games & Hobbies
  { repo: 'michelpereira/awesome-games-of-coding', branch: 'master', categoryId: CATEGORY.GAMES_HOBBIES },
  { repo: 'leereilly/games',                   branch: 'master', categoryId: CATEGORY.GAMES_HOBBIES },
  { repo: 'radek-sprta/awesome-game-remakes',  branch: 'master', categoryId: CATEGORY.GAMES_HOBBIES },
  { repo: 'Calinou/awesome-godot',             branch: 'master', categoryId: CATEGORY.GAMES_HOBBIES },
  { repo: 'aryaminus/awesome-unity',           branch: 'master', categoryId: CATEGORY.GAMES_HOBBIES },
  { repo: 'felipebueno/awesome-PICO-8',        branch: 'master', categoryId: CATEGORY.GAMES_HOBBIES },
  { repo: 'kitspace/awesome-electronics',      branch: 'master', categoryId: CATEGORY.GAMES_HOBBIES },

  // Weird & Wonderful
  { repo: 'mislavcimpersak/awesome-dev-fun',   branch: 'master', categoryId: CATEGORY.WEIRD_WONDERFUL },
  { repo: 'denolib/awesome-deno',              branch: 'main',   categoryId: CATEGORY.WEIRD_WONDERFUL },
  { repo: 'lk-geimfari/awesomo',               branch: 'master', categoryId: CATEGORY.WEIRD_WONDERFUL },

  // People & Places
  { repo: 'sindresorhus/awesome-nodejs',       branch: 'main',   categoryId: CATEGORY.PEOPLE_PLACES },
  { repo: 'remote-es/remoteok',                branch: 'master', categoryId: CATEGORY.PEOPLE_PLACES },
  { repo: 'hugo53/awesome-RemoteWork',         branch: 'master', categoryId: CATEGORY.PEOPLE_PLACES },

  // Mind & Body
  { repo: 'theimpossibleastronaut/awesome-linguistics', branch: 'master', categoryId: CATEGORY.MIND_BODY },
  { repo: 'meitar/awesome-lockpicking',        branch: 'master', categoryId: CATEGORY.MIND_BODY },
];

// ── URL extraction regex ───────────────────────────────────────────────────────
// Matches markdown links: [text](https://...) and bare https:// urls
const URL_RE = /https?:\/\/[^\s\)\]"'<>]+/g;

// Domains to skip — GitHub itself, shields.io badges, etc.
const SKIP_DOMAINS = new Set([
  'github.com', 'raw.githubusercontent.com', 'gist.github.com',
  'shields.io', 'img.shields.io', 'badge.fury.io',
  'travis-ci.org', 'travis-ci.com', 'circleci.com',
  'coveralls.io', 'codecov.io', 'snyk.io',
  'nodei.co', 'npmjs.com', 'npmjs.org',
  'pypi.org', 'pypi.python.org',
  'pkg.go.dev', 'godoc.org',
  'crates.io',
  'rubygems.org',
  'packagist.org',
  'hex.pm',
]);

function shouldSkip(url) {
  try {
    const { hostname, pathname } = new URL(url);
    const host = hostname.replace(/^www\./, '');
    if (SKIP_DOMAINS.has(host)) return true;
    // Skip image files
    if (/\.(png|jpg|jpeg|gif|svg|ico|webp)(\?.*)?$/i.test(pathname)) return true;
    return false;
  } catch {
    return true;
  }
}

// ── Extract title from markdown line containing the URL ───────────────────────
function extractTitle(line) {
  // [Title](url) pattern
  const mdMatch = line.match(/\[([^\]]+)\]\(https?:\/\//);
  if (mdMatch) return mdMatch[1].trim().slice(0, 200);
  return null;
}

// ── Fetch and parse one awesome list README ───────────────────────────────────
async function fetchAwesomeList({ repo, branch, categoryId }) {
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/README.md`;

  let res;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)' },
    });
  } catch (err) {
    console.warn(`[awesome]   ${repo}: fetch error — ${err.message}`);
    return [];
  }

  if (!res.ok) {
    // Try alternate filenames
    if (res.status === 404) {
      const alt = `https://raw.githubusercontent.com/${repo}/${branch}/readme.md`;
      try {
        res = await fetch(alt, {
          headers: { 'User-Agent': 'Roam-Seeder/1.0 (https://roamtheweb.app)' },
        });
        if (!res.ok) {
          console.warn(`[awesome]   ${repo}: HTTP ${res.status} — skipping`);
          return [];
        }
      } catch {
        return [];
      }
    } else {
      console.warn(`[awesome]   ${repo}: HTTP ${res.status} — skipping`);
      return [];
    }
  }

  const text  = await res.text();
  const lines = text.split('\n');
  const rows  = [];
  const seen  = new Set();

  for (const line of lines) {
    const matches = line.match(URL_RE);
    if (!matches) continue;

    for (const rawUrl of matches) {
      // Strip trailing punctuation that got swept up
      const cleanUrl = rawUrl.replace(/[.,;:!?)]+$/, '');
      if (shouldSkip(cleanUrl)) continue;
      if (seen.has(cleanUrl)) continue;
      seen.add(cleanUrl);

      const title = extractTitle(line);

      rows.push({
        url:         cleanUrl,
        title,
        description: null,
        og_image_url: null,
        category_id: categoryId,
        source:      'awesome',
      });
    }
  }

  return rows;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function fetchAllAwesome() {
  console.log(`\n[awesome] Fetching ${AWESOME_LISTS.length} awesome lists...`);
  const allRows = [];
  const globalSeen = new Set();

  for (const entry of AWESOME_LISTS) {
    const rows = await fetchAwesomeList(entry);
    let added = 0;
    for (const row of rows) {
      if (!globalSeen.has(row.url)) {
        globalSeen.add(row.url);
        allRows.push(row);
        added++;
      }
    }
    console.log(`[awesome]   ${entry.repo}: ${added} URLs`);
    await sleep(DELAY_MS);
  }

  console.log(`\n[awesome] Total unique URLs collected: ${allRows.length}`);
  return allRows;
}

async function main() {
  console.log('=== Awesome Lists seeder ===');

  let rows;
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    rows = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    console.log(`[awesome] Loaded ${rows.length} rows from cache (use --no-cache to re-fetch)`);
  } else {
    rows = await fetchAllAwesome();
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(rows));
    console.log(`[awesome] Cached ${rows.length} rows to ${CACHE_FILE}`);
  }

  // Fetch OG metadata — titles exist for most, but images and descriptions need fetching
  console.log(`\n[awesome] Total: ${rows.length} — upserting (with OG fetch for missing data)...`);
  const result = await upsertUrls(rows, { checkLive: true,  fetchOg: true, verbose: true });
  console.log(`\n=== Done: inserted ${result.inserted}, skipped ${result.skipped} ===`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
