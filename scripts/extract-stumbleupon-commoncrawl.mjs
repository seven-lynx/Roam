/**
 * extract-stumbleupon-commoncrawl.mjs — Extracts StumbleUpon URLs from Common Crawl
 *
 * Queries the Common Crawl Index API (index.commoncrawl.org) across monthly crawl
 * indices (2013–2024) to find all archived stumbleupon.com/url/* pages.
 * Extracts destination URLs from SU redirect paths without fetching page content.
 *
 * The CC index covers different time periods than Wayback CDX, providing URLs
 * that may not be in the Wayback Machine's index.
 *
 * Usage: node scripts/extract-stumbleupon-commoncrawl.mjs
 *   --from=CC-MAIN-2013-20  (start index, default: earliest)
 *   --to=CC-MAIN-2024-10    (end index, default: latest)
 *   --no-cache               skip cache, re-fetch from API
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { CATEGORY, SUBCATEGORY } from "./lib/seed.js";
import fetch from "node-fetch";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = resolve(__dirname, ".cache");
const OUTPUT_FILE = resolve(CACHE_DIR, "stumbleupon-commoncrawl.json");
const CHECKPOINT_FILE = resolve(CACHE_DIR, "liveness-commoncrawl.json");

const UA = "Roam-Seeder/1.0 (+https://roamtheweb.app)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const NO_CACHE = process.argv.includes("--no-cache");
const FROM_INDEX = process.argv.find(a => a.startsWith("--from="))?.split("=")[1] || null;
const TO_INDEX = process.argv.find(a => a.startsWith("--to="))?.split("=")[1] || null;

// ── Common Crawl index list ─────────────────────────────────────────────
// Only indices from 2013 onward (before that, SU was not well-crawled by CC)
// We include the 2013-2018 range (SU's active years) plus 2019-2024 (residual)
const DEFAULT_INDICES = (() => {
  const indices = [];
  // CC started ~2013-20. SU shut down mid-2018. Include 2013-2024.
  // Weekly indices: roughly 40-52 per year. We sample roughly monthly.
  for (let year = 2013; year <= 2024; year++) {
    for (let week = 1; week <= 52; week += 4) { // ~monthly sampling
      const weekStr = String(week).padStart(2, "0");
      indices.push(`CC-MAIN-${year}-${weekStr}`);
    }
  }
  return indices;
})();

// ── URL validation ───────────────────────────────────────────────────────
function isValidHttpUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// Extract destination URL from SU redirect path
// Common Crawl URLs look like: http://www.stumbleupon.com/url/https://example.com/article
function extractDestinationUrl(suUrl) {
  const match = suUrl.match(/stumbleupon\.com\/url\/(https?:\/\/.+)/i);
  if (!match) return null;

  let destUrl = match[1];
  const qIdx = destUrl.indexOf("?");
  if (qIdx !== -1) {
    const params = new URLSearchParams(destUrl.slice(qIdx + 1));
    params.delete("r");
    params.delete("ts");
    const qs = params.toString();
    destUrl = qs ? destUrl.slice(0, qIdx) + "?" + qs : destUrl.slice(0, qIdx);
  }
  return isValidHttpUrl(destUrl) ? destUrl : null;
}

// ── Domain blocklist ─────────────────────────────────────────────────────
const BLOCKED_DOMAINS = new Set([
  "reddit.com", "youtube.com", "youtu.be",
  "twitter.com", "x.com", "t.co",
  "facebook.com", "instagram.com",
  "pinterest.com", "tiktok.com",
  "bit.ly", "tinyurl.com",
  "amazon.com", "ebay.com",
  "stumbleupon.com",
]);

function isBlockedDomain(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (BLOCKED_DOMAINS.has(host)) return true;
    const parts = host.split(".");
    for (let i = 0; i < parts.length - 1; i++) {
      if (BLOCKED_DOMAINS.has(parts.slice(i).join("."))) return true;
    }
    return false;
  } catch { return true; }
}

// ── Common Crawl Index API ────────────────────────────────────────────────
async function queryCcIndex(indexName, page = 0) {
  const url = `https://index.commoncrawl.org/${indexName}-index?url=stumbleupon.com/url/*&output=json&page=${page}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (res.status === 429) {
    console.log(`  ⚠️  Rate limited. Waiting 30s...`);
    await sleep(30000);
    return queryCcIndex(indexName, page);
  }
  if (!res.ok) {
    if (res.status === 404) return []; // Index not found (pre-2013)
    console.log(`  ⚠️  CC API ${res.status} for ${indexName} page ${page}`);
    return [];
  }
  const text = await res.text();
  // Response is JSONL (one JSON object per line)
  return text.trim().split("\n").filter(Boolean).map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

// ── MAIN ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("========== StumbleUpon Common Crawl URL Extractor ==========\n");

  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

  // Check cache first
  if (!NO_CACHE && existsSync(OUTPUT_FILE)) {
    const cached = JSON.parse(readFileSync(OUTPUT_FILE, "utf8"));
    console.log(`📦 Loaded ${cached.length} cached Common Crawl URLs`);
    console.log("  Use --no-cache to re-fetch.");
    return;
  }

  // Resume from checkpoint
  let startIndexIdx = 0;
  let allDestUrls = new Set();
  let totalRaw = 0;
  let totalInvalid = 0;
  let processedIndices = 0;

  if (!NO_CACHE && existsSync(CHECKPOINT_FILE)) {
    const ck = JSON.parse(readFileSync(CHECKPOINT_FILE, "utf8"));
    startIndexIdx = ck.nextIndexIdx || 0;
    totalRaw = ck.totalRaw || 0;
    totalInvalid = ck.totalInvalid || 0;
    processedIndices = ck.processedIndices || 0;
    if (ck.urlSet && Array.isArray(ck.urlSet)) {
      for (const u of ck.urlSet) allDestUrls.add(u);
    }
    console.log(`🔄 Resuming from checkpoint: index ${startIndexIdx + 1}/${DEFAULT_INDICES.length} (${DEFAULT_INDICES[startIndexIdx] || "end"})`);
    console.log(`   ${allDestUrls.size.toLocaleString()} URLs already collected\n`);
  }

  // Determine range
  const fromIdx = FROM_INDEX ? Math.max(0, DEFAULT_INDICES.indexOf(FROM_INDEX)) : startIndexIdx;
  const toIdx = TO_INDEX ? Math.min(DEFAULT_INDICES.length - 1, DEFAULT_INDICES.indexOf(TO_INDEX)) : DEFAULT_INDICES.length - 1;
  const indices = DEFAULT_INDICES.slice(fromIdx, toIdx + 1);

  console.log(`Processing ${indices.length} Common Crawl indices (${indices[0]} → ${indices[indices.length - 1]})...\n`);

  const startTime = Date.now();
  let skippedEmpty = 0;

  for (let i = 0; i < indices.length; i++) {
    const indexName = indices[i];
    const idxStart = Date.now();

    console.log(`[${i + 1}/${indices.length}] ${indexName}...`);

    let page = 0;
    let indexPages = 0;
    let indexUrls = 0;
    const maxPages = 50; // cap per index to avoid runaway

    while (page < maxPages) {
      let results;
      try {
        results = await queryCcIndex(indexName, page);
      } catch (err) {
        console.log(`  ⚠️  Error: ${err.message}. Saving checkpoint...`);
        writeFileSync(CHECKPOINT_FILE, JSON.stringify({
          nextIndexIdx: fromIdx + i, totalRaw, totalInvalid,
          processedIndices: processedIndices, urlSet: [...allDestUrls],
        }));
        console.log(`  💾 Checkpoint saved.`);
        break;
      }

      if (!results || results.length === 0) {
        if (page === 0) skippedEmpty++;
        break;
      }

      indexPages++;
      totalRaw += results.length;
      let newForIndex = 0;

      for (const item of results) {
        const suUrl = item.url || "";
        const destUrl = extractDestinationUrl(suUrl);
        if (!destUrl) { totalInvalid++; continue; }
        if (isBlockedDomain(destUrl)) { totalInvalid++; continue; }

        if (!allDestUrls.has(destUrl)) {
          allDestUrls.add(destUrl);
          newForIndex++;
          indexUrls++;
        }
      }

      page++;

      // Log progress every 5 pages within an index
      if (page % 5 === 0) {
        console.log(`    page ${page}: ${indexUrls.toLocaleString()} unique so far this index`);
      }

      if (results.length < 100) break; // CC page size is ~100; fewer = last page
      await sleep(500); // rate limiting
    }

    processedIndices++;
    const idxMs = Date.now() - idxStart;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(`  ✅ ${indexName}: ${indexUrls.toLocaleString()} new URLs (${indexPages} pages, ${indexPages * 100}~ raw records) | ${idxMs}ms | ${elapsed}s total`);

    // Save checkpoint every 5 indices
    if ((i + 1) % 5 === 0) {
      writeFileSync(CHECKPOINT_FILE, JSON.stringify({
        nextIndexIdx: fromIdx + i + 1, totalRaw, totalInvalid,
        processedIndices, urlSet: [...allDestUrls],
      }));
    }

    // Delay between indices
    await sleep(1000);
  }

  // ── Build rows ─────────────────────────────────────────────────────────
  const urls = [...allDestUrls];
  const rows = urls.map((url) => ({
    url,
    title: null,
    description: "Discovered via Common Crawl index of stumbleupon.com/url/* pages",
    category_id: CATEGORY.WEIRD_WONDERFUL,
    subcategory_id: SUBCATEGORY.VINTAGE_INTERNET,
    source: "stumbleupon-commoncrawl",
    seeder_score: 0.5,
  }));

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(0);

  // ── Stats ──────────────────────────────────────────────────────────────
  console.log("\n📊 Stats:");
  console.log(`  Indices processed:     ${processedIndices} (${skippedEmpty} empty)`);
  console.log(`  Total raw CC records:  ${totalRaw.toLocaleString()}`);
  console.log(`  Invalid/unparseable:   ${totalInvalid.toLocaleString()}`);
  console.log(`  ✅ Unique dest URLs:   ${rows.length.toLocaleString()}`);
  console.log(`  Total time:            ${totalTime}s`);

  // Top domains
  const domainCounts = {};
  for (const row of rows) {
    try {
      const host = new URL(row.url).hostname.replace(/^www\./, "").toLowerCase();
      domainCounts[host] = (domainCounts[host] || 0) + 1;
    } catch { /* skip */ }
  }
  const topDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  console.log("\n  Top 15 domains:");
  for (const [domain, count] of topDomains) {
    console.log(`    ${String(count).padStart(6)}  ${domain}`);
  }

  // ── Write output ───────────────────────────────────────────────────────
  writeFileSync(OUTPUT_FILE, JSON.stringify(rows, null, 2));
  console.log(`\n💾 Cached ${rows.length} URLs → ${OUTPUT_FILE}`);

  // Delete checkpoint on success
  if (existsSync(CHECKPOINT_FILE)) {
    try { require("fs").unlinkSync(CHECKPOINT_FILE); } catch { /* ok */ }
  }

  console.log("\n✅ Common Crawl extraction complete!\n");
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});