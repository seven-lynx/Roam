/**
 * seed-federalreserve.mjs — Federal Reserve History seeder
 *
 * Federal Reserve History covers central banking history, economic crises,
 * monetary policy explainers, and biographies of Fed chairs.
 * Public .gov-adjacent site, no bot protection — direct HTML scrape.
 *
 * Usage:
 *   node scripts/seed-federalreserve.mjs
 *   node scripts/seed-federalreserve.mjs --no-cache
 *   node scripts/seed-federalreserve.mjs --reset
 *   node scripts/seed-federalreserve.mjs --max-urls 500
 *
 * Category: HISTORY_IDEAS → ECONOMICS_HISTORY
 */

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { config as dotenvConfig } from "dotenv";
import { upsertUrls, CATEGORY, SUBCATEGORY, fetchWithRetry } from "./lib/seed.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "../.env") });

const CACHE_DIR = resolve(__dirname, ".cache");
const CACHE_FILE = resolve(CACHE_DIR, "federalreserve.json");
mkdirSync(CACHE_DIR, { recursive: true });

const NO_CACHE = process.argv.includes("--no-cache");
const RESET = process.argv.includes("--reset");
const maxUrlsArg = process.argv.find((a) => a.startsWith("--max-urls="));
const MAX_URLS = parseInt(maxUrlsArg?.split("=")[1] || "500", 10);

const UA = "Roam-Seeder/1.0 (+https://roamtheweb.app)";
const REQUEST_DELAY_MS = 500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BASE_URL = "https://www.federalreservehistory.org";

// Content path patterns that indicate actual articles
const CONTENT_PATH_RE = /\/(essays|people|about-the-fed|time-period|topics)\//i;

// ── URL Discovery via sitemap ───────────────────────────────────────────────────
async function discoverUrls() {
  const results = [];
  const seen = new Set();

  // Try sitemap.xml first
  console.log(`  Trying ${BASE_URL}/sitemap.xml...`);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetchWithRetry(`${BASE_URL}/sitemap.xml`, {
      headers: { "User-Agent": UA },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res && res.ok) {
      const xml = await res.text();
      // Parse URLs from sitemap XML
      const urlRegex = /<loc>([^<]+)<\/loc>/gi;
      let match;
      while ((match = urlRegex.exec(xml)) !== null) {
        const url = match[1].trim();
        if (!url.startsWith(BASE_URL)) continue;
        let pathname = "";
        try { pathname = new URL(url).pathname; } catch { continue; }
        if (!pathname || pathname === "/") continue;
        if (!CONTENT_PATH_RE.test(pathname)) continue;
        if (seen.has(url)) continue;
        seen.add(url);
        results.push({ url });
      }
      if (results.length > 0) {
        console.log(`  ✓ Sitemap found ${results.length} article URLs`);
        return results.slice(0, MAX_URLS);
      }
    }
  } catch (err) {
    console.warn(`  Sitemap fetch failed: ${err.message}`);
  }

  // Fallback: scrape category index pages
  console.log(`  Falling back to index page scraping...`);
  const indexPages = [
    "/essays/",
    "/people/",
    "/about-the-fed/",
    "/time-period/",
    "/topics/",
  ];

  for (const indexPath of indexPages) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetchWithRetry(`${BASE_URL}${indexPath}`, {
        headers: { "User-Agent": UA },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res || !res.ok) continue;
      const html = await res.text();

      // Extract links from anchor tags
      const linkRegex = /<a\s[^>]*href=["'](\/[^"'\s]*)["'][^>]*>/gi;
      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        const href = match[1];
        if (!CONTENT_PATH_RE.test(href)) continue;
        if (href.includes("/search")) continue;
        const url = `${BASE_URL}${href}`;
        if (seen.has(url)) continue;
        seen.add(url);
        results.push({ url });
      }
      console.log(`  ${indexPath}: ${results.length} URLs so far`);
    } catch (err) {
      console.warn(`  Error scraping ${indexPath}: ${err.message}`);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`  ✓ Found ${results.length} article URLs total`);
  return results.slice(0, MAX_URLS);
}

// ── Fetch page metadata ─────────────────────────────────────────────────────────
async function fetchPageMeta(pageUrl) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
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

    let title = null;
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].trim()
        .replace(/\s*\|\s*Federal Reserve History\s*$/i, "")
        .trim();
    }
    if (!title) {
      const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
      if (ogTitle) title = ogTitle[1].trim().replace(/\s*\|\s*Federal Reserve History\s*$/i, "").trim();
      else {
        const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        if (h1) title = h1[1].trim();
      }
    }

    let description = null;
    const ogDesc = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
    const metaDesc = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const rawDesc = ogDesc?.[1]?.trim() ?? metaDesc?.[1]?.trim() ?? null;
    if (rawDesc) description = rawDesc.slice(0, 500);

    let og_image_url = null;
    const ogImg = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (ogImg) og_image_url = ogImg[1].trim();
    if (!og_image_url) {
      const twImg = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
      if (twImg) og_image_url = twImg[1].trim();
    }

    return { title, description, og_image_url };
  } catch { return null; }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🏦 Federal Reserve History Seeder (Direct Scrape)\n");

  let cache = {};
  if (!NO_CACHE && !RESET && existsSync(CACHE_FILE)) {
    try { cache = JSON.parse(readFileSync(CACHE_FILE, "utf8")); } catch { cache = {}; }
    console.log(`📦 Loaded cache: ${(cache.discovered || []).length} URLs discovered, ${Object.keys(cache.fetched || {}).length} fetched`);
  }
  if (NO_CACHE || RESET) cache = {};
  cache.discovered = cache.discovered || [];
  cache.fetched = cache.fetched || {};

  let discovered = cache.discovered;
  if (!discovered.length || NO_CACHE || RESET) {
    console.log(`\n📡 Discovering URLs...`);
    discovered = await discoverUrls();
    cache.discovered = discovered;
    if (!NO_CACHE) writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    console.log(`  ✓ Discovered ${discovered.length} article URLs`);
  } else {
    console.log(`\n📡 ${discovered.length} URLs (cached)`);
  }

  if (!discovered.length) { console.log("\n⚠️  No URLs discovered. Exiting."); return; }

  console.log(`\n🔍 Fetching metadata for ${discovered.length} articles...`);
  const rows = [];
  let ok = 0, skipped = 0;

  for (let i = 0; i < discovered.length; i++) {
    const article = discovered[i];
    let meta = cache.fetched[article.url];
    if (!meta || NO_CACHE || RESET) {
      await sleep(REQUEST_DELAY_MS);
      meta = await fetchPageMeta(article.url);
      if (meta) { cache.fetched[article.url] = meta; if (!NO_CACHE) writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2)); }
    }
    if (meta && meta.title) {
      rows.push({
        url: article.url,
        title: meta.title,
        description: meta.description || undefined,
        og_image_url: meta.og_image_url || undefined,
        category_id: CATEGORY.HISTORY_IDEAS,
        subcategory_id: SUBCATEGORY.ECONOMICS_HISTORY,
        source: "federalreserve",
        seeder_score: 0.8,
      });
      ok++;
    } else { skipped++; }
    if ((i + 1) % 50 === 0 || i === discovered.length - 1) {
      console.log(`  ${i + 1}/${discovered.length} (${ok} ok, ${skipped} skipped)`);
    }
  }

  console.log(`📊 Total articles with metadata: ${rows.length}`);
  if (!rows.length) { console.log("\n⚠️  No articles with metadata found. Exiting."); return; }

  console.log(`\n💾 Submitting to database (checkLive=true, fetchOg=false)...`);
  const result = await upsertUrls(rows, { fetchOg: false, checkLive: true, verbose: true });
  console.log(`\n✅ Done! Inserted: ${result.inserted}, Skipped: ${result.skipped}`);
}

main().catch((err) => { console.error("FATAL:", err.message); process.exit(1); });