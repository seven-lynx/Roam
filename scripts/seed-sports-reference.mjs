/**
 * seed-sports-reference.mjs — Sports Reference family seeder
 *
 * Scrapes player biographies, team histories, championship recaps, Hall of Fame
 * profiles, and notable season summaries from the Sports Reference family of sites.
 *
 * Sites:
 *   - baseball-reference.com
 *   - basketball-reference.com
 *   - pro-football-reference.com
 *   - hockey-reference.com
 *   - fbref.com (soccer)
 *
 * Strategy:
 *   1. Discover URLs by scraping index pages (players by letter, team lists, etc.)
 *   2. Fetch each page to extract title, description, and og:image
 *   3. Submit to Roam DB via upsertUrls() with checkLive: true
 *
 * Usage:
 *   node scripts/seed-sports-reference.mjs
 *   node scripts/seed-sports-reference.mjs --no-cache
 *   node scripts/seed-sports-reference.mjs --reset
 *   node scripts/seed-sports-reference.mjs --max-per-site 2000
 *
 * Category: GAMES_HOBBIES → SPORTS_ATHLETICS
 */

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { config as dotenvConfig } from "dotenv";
import { upsertUrls, CATEGORY, SUBCATEGORY, fetchWithRetry } from "./lib/seed.js";

// ── Setup ──────────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "../.env") });

const CACHE_DIR = resolve(__dirname, ".cache");
const CACHE_FILE = resolve(CACHE_DIR, "sports-reference.json");
mkdirSync(CACHE_DIR, { recursive: true });

const NO_CACHE = process.argv.includes("--no-cache");
const RESET = process.argv.includes("--reset");
const maxPerSiteArg = process.argv.find((a) => a.startsWith("--max-per-site="));
const MAX_PER_SITE = parseInt(maxPerSiteArg?.split("=")[1] || "2000", 10);

// ── Constants ──────────────────────────────────────────────────────────────────
const UA = "Roam-Seeder/1.0 (+https://roamtheweb.app)";
const REQUEST_DELAY_MS = 500; // Between page fetches (be polite)
const INDEX_DELAY_MS = 300;   // Between index page fetches
const FETCH_TIMEOUT_MS = 15000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Site configurations ────────────────────────────────────────────────────────
const SITES = [
  {
    name: "baseball-reference",
    domain: "baseball-reference.com",
    baseUrl: "https://www.baseball-reference.com",
    source: "sports-reference-baseball",
    // Index pages to scrape for URL discovery
    indexPages: [
      // Player index by letter
      ...Array.from("abcdefghijklmnopqrstuvwxyz", (letter) => `/players/${letter}/`),
      // Team pages
      "/teams/",
      // Award pages
      "/awards/",
      // Hall of Fame
      "/hall-of-fame/",
      // Recent years
      ...Array.from({ length: 10 }, (_, i) => `/years/${2024 - i}.shtml`),
    ],
  },
  {
    name: "basketball-reference",
    domain: "basketball-reference.com",
    baseUrl: "https://www.basketball-reference.com",
    source: "sports-reference-basketball",
    indexPages: [
      ...Array.from("abcdefghijklmnopqrstuvwxyz", (letter) => `/players/${letter}/`),
      "/teams/",
      "/awards/",
      "/hall-of-fame/",
      ...Array.from({ length: 10 }, (_, i) => `/leagues/NBA_${2025 - i}.html`),
    ],
  },
  {
    name: "pro-football-reference",
    domain: "pro-football-reference.com",
    baseUrl: "https://www.pro-football-reference.com",
    source: "sports-reference-football",
    indexPages: [
      ...Array.from("abcdefghijklmnopqrstuvwxyz", (letter) => `/players/${letter}/`),
      "/teams/",
      "/awards/",
      "/hall-of-fame/",
      ...Array.from({ length: 10 }, (_, i) => `/years/${2024 - i}/`),
    ],
  },
  {
    name: "hockey-reference",
    domain: "hockey-reference.com",
    baseUrl: "https://www.hockey-reference.com",
    source: "sports-reference-hockey",
    indexPages: [
      ...Array.from("abcdefghijklmnopqrstuvwxyz", (letter) => `/players/${letter}/`),
      "/teams/",
      "/awards/",
      "/hall-of-fame/",
      ...Array.from({ length: 10 }, (_, i) => `/leagues/NHL_${2025 - i}.html`),
    ],
  },
  {
    name: "fbref",
    domain: "fbref.com",
    baseUrl: "https://fbref.com",
    source: "sports-reference-soccer",
    indexPages: [
      // Player index pages
      "/en/players/",
      // Competition pages (top leagues)
      "/en/comps/9/Premier-League-Stats",
      "/en/comps/12/La-Liga-Stats",
      "/en/comps/11/Serie-A-Stats",
      "/en/comps/20/Bundesliga-Stats",
      "/en/comps/13/Ligue-1-Stats",
      // International competitions
      "/en/comps/1/World-Cup-Stats",
      "/en/comps/676/European-Championship-Stats",
      "/en/comps/685/UEFA-Champions-League-Stats",
      // Player awards
      "/en/comps/ballon-dor-stats/Ballon-dOr-Winners",
    ],
  },
];

// ── URL Discovery: scrape index pages for article links ────────────────────────

/**
 * Fetches an index page and extracts links to individual player/team/season pages.
 * Filters out navigation links, search pages, and non-content URLs.
 */
async function discoverUrlsFromIndex(site, indexPath) {
  const url = `${site.baseUrl}${indexPath}`;
  const links = [];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetchWithRetry(url, {
      headers: { "User-Agent": UA },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      if (res.status === 404) return links; // Page doesn't exist, skip quietly
      console.warn(`  [${site.name}] HTTP ${res.status} for index: ${indexPath}`);
      return links;
    }

    const contentLen = parseInt(res.headers.get("content-length") || "0");
    if (contentLen > 5_000_000) { clearTimeout(timer); return links; }

    const html = await res.text();
    clearTimeout(timer);

    // Extract links from anchor tags
    // Sports Reference sites use standard <a href="..."> links
    const linkRegex = /<a\s[^>]*href=["'](\/[^"'\s]*\.(?:s?html?|htm))["'][^>]*>/gi;
    let match;
    const seen = new Set();

    while ((match = linkRegex.exec(html)) !== null) {
      let href = match[1];

      // Skip non-content links
      if (
        href.includes("/search") ||
        href.includes("/friv/") ||
        href.includes("/about/") ||
        href.includes("/feedback/") ||
        href.includes("/register") ||
        href.includes("/login") ||
        href.includes("/account") ||
        href.includes("/share") ||
        href.includes("/link") ||
        href.includes("/cbb/") ||    // Skip college basketball (less interesting)
        href.includes("/cfb/") ||    // Skip college football
        href.includes("/nc")
      ) {
        continue;
      }

      // Normalize: some links have query params like ?utm_source=...
      const cleanHref = href.split("?")[0];

      if (seen.has(cleanHref) || cleanHref === indexPath) continue;
      seen.add(cleanHref);

      // Only include content-rich paths
      const isContentPath =
        cleanHref.includes("/players/") ||
        cleanHref.includes("/teams/") ||
        cleanHref.includes("/years/") ||
        cleanHref.includes("/leagues/") ||
        cleanHref.includes("/awards/") ||
        cleanHref.includes("/hall-of-fame/") ||
        cleanHref.includes("/allstar/") ||
        cleanHref.includes("/postseason/") ||
        cleanHref.includes("/managers/") ||
        cleanHref.includes("/coaches/") ||
        cleanHref.includes("/executives/") ||
        cleanHref.includes("/bullpen/") ||     // Baseball Reference bullpen wiki pages
        cleanHref.includes("/en/players/") ||   // FBref player pages
        cleanHref.includes("/en/comps/") ||      // FBref competition pages
        cleanHref.includes("/en/squads/") ||     // FBref squad pages
        cleanHref.includes("/en/coaches/");

      if (isContentPath) {
        links.push(`${site.baseUrl}${cleanHref}`);
      }
    }
  } catch (err) {
    console.warn(`  [${site.name}] Error fetching index ${indexPath}: ${err.message}`);
  }

  return links;
}

// ── Metadata extraction: scrape individual page for title/description ─────────

/**
 * Fetches a content page and extracts title, description, and og:image.
 * Returns { title, description, og_image_url } or null on failure.
 */
async function fetchPageMeta(pageUrl) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetchWithRetry(pageUrl, {
      headers: { "User-Agent": UA },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return null;

    const contentLen = parseInt(res.headers.get("content-length") || "0");
    if (contentLen > 2_000_000) { clearTimeout(timer); return null; }

    const html = await res.text();
    clearTimeout(timer);

    // --- Title ---
    // Sports Reference pages have <title>Page Name | Site Name</title>
    let title = null;
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].trim()
        // Strip site name suffixes
        .replace(/\s*\|\s*Baseball-Reference\.com\s*$/i, "")
        .replace(/\s*\|\s*Basketball-Reference\.com\s*$/i, "")
        .replace(/\s*\|\s*Pro-Football-Reference\.com\s*$/i, "")
        .replace(/\s*\|\s*Hockey-Reference\.com\s*$/i, "")
        .replace(/\s*\|\s*FBref\.com\s*$/i, "")
        // Strip common suffixes
        .replace(/\s*\|\s*Sports-Reference\.com\s*$/i, "")
        .replace(/\s*Stats\s*\|.*$/i, "")  // "Player Stats | ..."
        .trim();
    }

    if (!title) {
      // Fallback to og:title or h1
      const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
      if (ogTitle) {
        title = ogTitle[1].trim()
          .replace(/\s*\|\s*(?:Baseball|Basketball|Hockey|Pro-Football)-Reference\.com\s*$/i, "")
          .replace(/\s*\|\s*FBref\.com\s*$/i, "")
          .trim();
      } else {
        const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        if (h1) title = h1[1].trim();
      }
    }

    // --- Description ---
    let description = null;
    const ogDesc = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
    const metaDesc = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const rawDesc = ogDesc?.[1]?.trim() ?? metaDesc?.[1]?.trim() ?? null;
    if (rawDesc) description = rawDesc.slice(0, 500);

    // --- OG Image ---
    let og_image_url = null;
    const ogImg = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (ogImg) og_image_url = ogImg[1].trim();
    if (!og_image_url) {
      const twImg = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
      if (twImg) og_image_url = twImg[1].trim();
    }

    return { title, description, og_image_url };
  } catch {
    return null;
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🏟️  Sports Reference Seeder (Direct Scrape)\n");

  // Load or initialize cache
  let cache = {};
  if (!NO_CACHE && !RESET && existsSync(CACHE_FILE)) {
    try {
      cache = JSON.parse(readFileSync(CACHE_FILE, "utf8"));
      console.log(`📦 Loaded cache: ${Object.keys(cache.discovered || {}).length} sites, ${Object.values(cache.discovered || {}).flat().length} URLs`);
    } catch {
      cache = {};
    }
  }
  if (NO_CACHE || RESET) cache = {};
  cache.discovered = cache.discovered || {};
  cache.fetched = cache.fetched || {};

  let allRows = [];

  for (const site of SITES) {
    console.log(`\n📡 Site: ${site.name} (${site.domain})`);

    // Phase 1: Discover URLs from index pages
    let discovered = cache.discovered[site.name];
    if (!discovered || NO_CACHE || RESET) {
      discovered = [];
      const seenUrls = new Set();

      console.log(`  🔍 Scraping ${site.indexPages.length} index pages...`);
      for (let i = 0; i < site.indexPages.length; i++) {
        const indexPath = site.indexPages[i];
        const links = await discoverUrlsFromIndex(site, indexPath);

        for (const link of links) {
          if (!seenUrls.has(link)) {
            seenUrls.add(link);
            discovered.push(link);
          }
        }

        if ((i + 1) % 10 === 0 || i === site.indexPages.length - 1) {
          console.log(`    Index ${i + 1}/${site.indexPages.length}: ${discovered.length} URLs so far`);
        }

        await sleep(INDEX_DELAY_MS);
      }

      // Cap at MAX_PER_SITE
      if (discovered.length > MAX_PER_SITE) {
        discovered = discovered.slice(0, MAX_PER_SITE);
      }

      cache.discovered[site.name] = discovered;
      if (!NO_CACHE) writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
      console.log(`  ✓ Discovered ${discovered.length} URLs`);
    } else {
      console.log(`  ✓ ${discovered.length} URLs (cached)`);
    }

    if (discovered.length === 0) continue;

    // Phase 2: Fetch metadata for each URL
    console.log(`  🔍 Fetching metadata...`);
    let siteRows = 0;

    for (let i = 0; i < discovered.length; i++) {
      const pageUrl = discovered[i];
      const cacheKey = pageUrl;

      let meta = cache.fetched[cacheKey];
      if (!meta || NO_CACHE || RESET) {
        await sleep(REQUEST_DELAY_MS);
        meta = await fetchPageMeta(pageUrl);

        if (meta) {
          cache.fetched[cacheKey] = { ...meta, source: site.source };
          if (!NO_CACHE) writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
        }
      }

      if (meta && meta.title) {
        allRows.push({
          url: pageUrl,
          title: meta.title,
          description: meta.description || undefined,
          og_image_url: meta.og_image_url || undefined,
          category_id: CATEGORY.GAMES_HOBBIES,
          subcategory_id: SUBCATEGORY.SPORTS_ATHLETICS,
          source: site.source,
          seeder_score: 0.7,
        });
        siteRows++;
      }

      if ((i + 1) % 100 === 0 || i === discovered.length - 1) {
        console.log(`    ${i + 1}/${discovered.length} processed (${siteRows} with metadata)`);
      }
    }

    console.log(`  ✅ ${site.name}: ${siteRows} rows ready`);
  }

  // Deduplicate by URL (keep first entry for each URL)
  const seen = new Set();
  const deduped = [];
  for (const row of allRows) {
    if (!seen.has(row.url)) {
      seen.add(row.url);
      deduped.push(row);
    }
  }

  console.log(`\n📊 Total unique articles: ${deduped.length}`);

  // Show breakdown by source
  const bySource = {};
  for (const row of deduped) {
    bySource[row.source] = (bySource[row.source] || 0) + 1;
  }
  for (const [src, count] of Object.entries(bySource)) {
    console.log(`  ${src}: ${count}`);
  }

  if (deduped.length === 0) {
    console.log("\n⚠️  No articles found. Exiting.");
    return;
  }

  // Phase 3: Submit to database with liveness check
  console.log(`\n💾 Submitting to database (checkLive=true, fetchOg=false — metadata already scraped)...`);
  const result = await upsertUrls(deduped, {
    fetchOg: false,
    checkLive: true,
    verbose: true,
  });

  console.log(`\n✅ Done! Inserted: ${result.inserted}, Skipped: ${result.skipped}`);
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});