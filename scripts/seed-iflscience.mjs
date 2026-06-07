/**
 * seed-iflscience.mjs — seed IFLScience articles from the Wayback Machine
 *
 * IFLScience.com is behind AWS CloudFront WAF bot protection, so we can't
 * scrape it directly. Instead, we:
 *   1. Query the Wayback Machine CDX API to discover article URLs
 *   2. Fetch each article from the most recent Wayback snapshot
 *   3. Extract title, description, and og:image from the snapshot HTML
 *   4. Submit to the Roam database via upsertUrls()
 *
 * Usage:
 *   node scripts/seed-iflscience.mjs
 *   node scripts/seed-iflscience.mjs --no-cache
 *   node scripts/seed-iflscience.mjs --max-per-category 100
 *
 * Source labels written to DB:
 *   iflscience-space                   → Science & Nature / Space & Astronomy
 *   iflscience-environment             → Science & Nature / Environment & Climate
 *   iflscience-technology              → Technology / Emerging Technology
 *   iflscience-health-and-medicine     → Science & Nature / Medicine & Health Science
 *   iflscience-the-brain               → Mind & Body / Neuroscience
 *   iflscience-plants-and-animals      → Science & Nature / Biology & Evolution
 *   iflscience-physics-and-chemistry   → Science & Nature / Physics & Chemistry
 */

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "fs";
import { config as dotenvConfig } from "dotenv";
import { upsertUrls, CATEGORY, SUBCATEGORY, fetchWithRetry } from "./lib/seed.js";

// ── Setup ──────────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "../.env") });

const CACHE_DIR = resolve(__dirname, ".cache");
const CACHE_FILE = resolve(CACHE_DIR, "iflscience.json");
mkdirSync(CACHE_DIR, { recursive: true });

const NO_CACHE = process.argv.includes("--no-cache");
const maxPerCatArg = process.argv.find((a) => a.startsWith("--max-per-category="));
const MAX_PER_CATEGORY = parseInt(maxPerCatArg?.split("=")[1] || "300", 10);

// ── Constants ──────────────────────────────────────────────────────────────────
const UA = "Roam-Seeder/1.0 (+https://roamtheweb.app)";

const IFL_CATEGORIES = [
  { slug: "space",                  cat: CATEGORY.SCIENCE,       subcat: SUBCATEGORY.SPACE_ASTRONOMY,         source: "iflscience-space" },
  { slug: "environment",            cat: CATEGORY.SCIENCE,       subcat: SUBCATEGORY.ENVIRONMENT_CLIMATE,      source: "iflscience-environment" },
  { slug: "technology",             cat: CATEGORY.TECHNOLOGY,    subcat: SUBCATEGORY.EMERGING_TECHNOLOGY,      source: "iflscience-technology" },
  { slug: "health-and-medicine",    cat: CATEGORY.SCIENCE,       subcat: SUBCATEGORY.MEDICINE_HEALTH_SCIENCE,  source: "iflscience-health-and-medicine" },
  { slug: "the-brain",              cat: CATEGORY.MIND_BODY,     subcat: SUBCATEGORY.NEUROSCIENCE,             source: "iflscience-the-brain" },
  { slug: "plants-and-animals",     cat: CATEGORY.SCIENCE,       subcat: SUBCATEGORY.BIOLOGY_EVOLUTION,        source: "iflscience-plants-and-animals" },
  { slug: "physics-and-chemistry",  cat: CATEGORY.SCIENCE,       subcat: SUBCATEGORY.PHYSICS_CHEMISTRY,        source: "iflscience-physics-and-chemistry" },
];

const CDX_DELAY_MS = 600;       // Between CDX API calls
const SNAPSHOT_DELAY_MS = 400;  // Between Wayback snapshot fetches
const CDX_LIMIT = 500;          // Max results per CDX query

// ── Helpers ────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Query the Wayback Machine CDX API for URLs matching a pattern.
 * Returns deduplicated article URLs with their latest capture timestamp.
 */
async function discoverUrls(categorySlug, maxResults) {
  // Try without from= filter first, fall back to from=2020 on empty
  for (const fromYear of [undefined, 2020]) {
    const fromParam = fromYear ? `&from=${fromYear}` : "";
    const url = `https://web.archive.org/cdx/search/cdx?url=iflscience.com/${categorySlug}/*&output=json&limit=${Math.min(CDX_LIMIT, maxResults)}&filter=statuscode:200&collapse=urlkey&fl=timestamp,original${fromParam}`;
    
    // Retry CDX on 5xx/429 errors
    let text;
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetchWithRetry(url, { headers: { "User-Agent": UA } });
      text = await res.text();
      
      if (res.ok && text.startsWith("[")) break;  // valid JSON array
      if (res.status === 429 || res.status >= 500) {
        console.warn(`  [CDX] ${res.status} for ${categorySlug}, retry ${attempt + 1}/4...`);
        await sleep(2000 * (attempt + 1));
        continue;
      }
      console.warn(`  [CDX] HTTP ${res.status} for ${categorySlug}`);
      return [];
    }
    
    if (!text || !text.startsWith("[")) {
      console.warn(`  [CDX] Non-JSON response for ${categorySlug}`);
      continue;
    }
  
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.warn(`  [CDX] JSON parse failed for ${categorySlug}`);
    continue;
  }
  
  if (!data || data.length <= 1) return [];
  
  const articles = [];
  for (let i = 1; i < data.length; i++) {
    const [timestamp, originalUrl] = data[i];
    const path = new URL(originalUrl).pathname.replace(/\/$/, "");
    const segments = path.split("/").filter(Boolean);
    
    // Skip bare category pages like /space, /environment
    if (segments.length === 1 && segments[0] === categorySlug) continue;
    if (segments.length === 0) continue;
    
    // Normalize to https://www.iflscience.com/...
    articles.push({
      url: `https://www.iflscience.com${path}`,
      timestamp,
    });
  }
  
    return articles.slice(0, maxResults);
  }
  return [];
}

/**
 * Fetch article metadata from the Wayback Machine snapshot.
 * Returns { title, description, og_image_url } or null on failure.
 */
async function fetchArticleMeta(article) {
  const wbUrl = `https://web.archive.org/web/${article.timestamp}/${article.url}`;
  
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    
    const res = await fetchWithRetry(wbUrl, {
      headers: { "User-Agent": UA },
      signal: controller.signal,
    });
    clearTimeout(timer);
    
    if (!res.ok) return null;
    
    const contentLen = parseInt(res.headers.get("content-length") || "0");
    if (contentLen > 2_000_000) { clearTimeout(timer); return null; }
    
    const html = await res.text();
    clearTimeout(timer);
    
    // --- Title: from <title>, stripping " | IFLScience" suffix ---
    let title = null;
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].trim()
        .replace(/\s*\|\s*IFLScience\s*$/i, "")
        .replace(/\s*\|\s*IFLScience\s*\|[^|]*$/i, "")
        .trim();
    }
    if (!title) {
      // Fallback: og:title or h1
      const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
      if (ogTitle) title = ogTitle[1].trim();
      else {
        const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        if (h1) title = h1[1].trim();
      }
      if (title) {
        title = title.replace(/\s*\|\s*IFLScience\s*$/i, "").trim();
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
  console.log("🛰️  IFLScience Seeder (Wayback Machine)\n");
  
  // Load or initialize cache
  let cache = {};
  if (!NO_CACHE && existsSync(CACHE_FILE)) {
    try {
      cache = JSON.parse(readFileSync(CACHE_FILE, "utf8"));
      console.log(`📦 Loaded cache: ${Object.keys(cache.discovered || {}).length} categories, ${Object.values(cache.discovered || {}).flat().length} URLs`);
    } catch {
      cache = {};
    }
  }
  if (NO_CACHE) cache = {};
  cache.discovered = cache.discovered || {};
  cache.fetched = cache.fetched || {};
  
  // Phase 1: Discover URLs from CDX per category
  let allRows = [];
  
  for (const cat of IFL_CATEGORIES) {
    console.log(`\n📡 Discovering: ${cat.slug} (CDX API)...`);
    
    let discovered = cache.discovered[cat.slug];
    if (!discovered || NO_CACHE) {
      try {
        discovered = await discoverUrls(cat.slug, MAX_PER_CATEGORY);
      } catch (err) {
        console.error(`  ❌ CDX failed for ${cat.slug}: ${err.message}`);
        discovered = [];
      }
      cache.discovered[cat.slug] = discovered;
      if (!NO_CACHE) writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
      console.log(`  ✓ Found ${discovered.length} article URLs`);
    } else {
      console.log(`  ✓ ${discovered.length} URLs (cached)`);
    }
    
    if (discovered.length === 0) continue;
    
    // Phase 2: Fetch metadata for undiscovered URLs
    console.log(`  🔍 Fetching metadata...`);
    
    for (let i = 0; i < discovered.length; i++) {
      const article = discovered[i];
      const cacheKey = article.url;
      
      let meta = cache.fetched[cacheKey];
      if (!meta || NO_CACHE) {
        await sleep(SNAPSHOT_DELAY_MS);
        meta = await fetchArticleMeta(article);
        
        if (meta) {
          cache.fetched[cacheKey] = { ...meta, source: cat.source, cat: cat.cat, subcat: cat.subcat };
          if (!NO_CACHE) writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
        }
      }
      
      if (meta && meta.title) {
        allRows.push({
          url: article.url,
          title: meta.title,
          description: meta.description || undefined,
          og_image_url: meta.og_image_url || undefined,
          category_id: cat.cat,
          subcategory_id: cat.subcat,
          source: cat.source,
        });
      }
      
      if ((i + 1) % 50 === 0 || i === discovered.length - 1) {
        console.log(`    ${i + 1}/${discovered.length} processed (${allRows.filter(r => r.source === cat.source).length} with metadata)`);
      }
    }
    
    await sleep(CDX_DELAY_MS);
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
  
  // Phase 3: Submit to database
  console.log(`\n💾 Submitting to database (fetchOg=false, we have metadata)...`);
  const result = await upsertUrls(deduped, {
    fetchOg: false,
    verbose: true,
  });
  
  console.log(`\n✅ Done! Inserted: ${result.inserted}, Skipped: ${result.skipped}`);
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});