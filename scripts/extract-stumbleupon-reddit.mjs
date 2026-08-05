/**
 * extract-stumbleupon-reddit.mjs — Extracts StumbleUpon URLs from Reddit threads
 *
 * Searches Reddit via the Pushshift API (https://api.pushshift.io) for posts
 * and comments in StumbleUpon-related subreddits and nostalgia threads.
 * Pushshift is free, rate-limited, and covers historical Reddit data.
 *
 * Usage: node scripts/extract-stumbleupon-reddit.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { CATEGORY, SUBCATEGORY } from "./lib/seed.js";
import fetch from "node-fetch";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = resolve(__dirname, ".cache");
const OUTPUT_FILE = resolve(CACHE_DIR, "stumbleupon-reddit.json");

const UA = "Roam-Seeder/1.0 (+https://roamtheweb.app)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── URL validation ─────────────────────────────────────────────────────────
function isValidHttpUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// ── Blocked domains ────────────────────────────────────────────────────────
const BLOCKED_DOMAINS = new Set([
  "reddit.com", "redd.it", "i.redd.it", "v.redd.it",
  "youtube.com", "youtu.be",
  "twitter.com", "x.com", "t.co",
  "facebook.com", "instagram.com",
  "pinterest.com", "tiktok.com",
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

// ── URL extraction from text ───────────────────────────────────────────────
function extractUrlsFromText(text) {
  const urlRe = /https?:\/\/[^\s"'<>)\]}]+/gi;
  const found = new Set();
  let m;
  while ((m = urlRe.exec(text)) !== null) {
    const raw = m[0].replace(/[,;:.!?]*$/, "");
    if (isValidHttpUrl(raw) && !isBlockedDomain(raw) && !raw.includes("reddit.com") && !raw.includes("stumbleupon.com")) {
      found.add(raw);
    }
  }
  return [...found];
}

// ── Pushshift queries ──────────────────────────────────────────────────────
// Each query is run for both submissions and comments
const PUSHSHIFT_QUERIES = [
  { q: "stumbleupon", subreddit: "StumbleUpon", label: "su-subreddit" },
  { q: "stumbleupon favorites|stumbleupon links|stumbleupon best", subreddit: "internetnostalgia", label: "nostalgia" },
  { q: "stumbleupon", subreddit: "DataHoarder", label: "datahoarder" },
  { q: "stumbleupon.com", subreddit: "InternetIsBeautiful", label: "iib" },
  { q: "remember stumbleupon|old stumbleupon|stumbleupon shutdown", label: "general" },
  { q: "best site from stumbleupon|favorite stumbleupon|stumbleupon gem", label: "favorites" },
  { q: "stumbleupon archive|stumbleupon backup|stumbleupon dump", label: "archives" },
];

async function fetchPushshift(type, query, size = 100) {
  const baseUrl = `https://api.pushshift.io/reddit/search/${type}/`;
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.subreddit) params.set("subreddit", query.subreddit);
  params.set("size", String(size));
  params.set("sort", "desc");
  params.set("filter", "body,selftext,title,url");

  const url = `${baseUrl}?${params.toString()}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    if (res.status === 429) {
      console.log("  ⚠️  Rate limited. Waiting 10s...");
      await sleep(10000);
      return fetchPushshift(type, query, size);
    }
    return { data: [] };
  }
  return res.json();
}

async function fetchRedditUrls(query) {
  const urls = new Map();

  // Search submissions
  console.log(`  Searching submissions for: "${query.label}"...`);
  await sleep(1500);
  const subs = await fetchPushshift("submission", query, 100);
  let subCount = 0;
  for (const item of subs.data || []) {
    const text = [item.title, item.selftext, item.url].filter(Boolean).join(" ");
    const found = extractUrlsFromText(text);
    for (const url of found) {
      if (!urls.has(url)) {
        urls.set(url, { url, source: `reddit-${query.label}` });
        subCount++;
      }
    }
  }
  console.log(`    ${subCount} URLs from ${subs.data?.length || 0} submissions`);

  // Search comments
  console.log(`  Searching comments for: "${query.label}"...`);
  await sleep(1500);
  const comments = await fetchPushshift("comment", query, 200);
  let commentCount = 0;
  for (const item of comments.data || []) {
    const text = item.body || "";
    const found = extractUrlsFromText(text);
    for (const url of found) {
      if (!urls.has(url)) {
        urls.set(url, { url, source: `reddit-${query.label}` });
        commentCount++;
      }
    }
  }
  console.log(`    ${commentCount} URLs from ${comments.data?.length || 0} comments`);

  return [...urls.values()];
}

// ── Clean title ──────────────────────────────────────────────────────────
function cleanTitle(t) {
  if (!t) return null;
  return t.trim()
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/\s+/g, " ")
    .slice(0, 300) || null;
}

// ── MAIN ─────────────────────────────────────────────────────────────────
async function main() {
  console.log("========== StumbleUpon Reddit URL Extractor ==========\n");

  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

  const allUrls = new Map();
  let totalQueries = 0;
  const startTime = Date.now();

  for (const query of PUSHSHIFT_QUERIES) {
    console.log(`─── Query ${++totalQueries}/${PUSHSHIFT_QUERIES.length}: ${query.label} ───`);
    const results = await fetchRedditUrls(query);
    for (const entry of results) {
      if (!allUrls.has(entry.url)) {
        allUrls.set(entry.url, entry);
      }
    }
    console.log(`  Cumulative unique: ${allUrls.size.toLocaleString()}\n`);
  }

  const rows = [...allUrls.values()].map((entry) => ({
    url: entry.url,
    description: `Discovered in Reddit post/comment (${entry.source})`,
    category_id: CATEGORY.WEIRD_WONDERFUL,
    subcategory_id: SUBCATEGORY.VINTAGE_INTERNET,
    source: "stumbleupon-reddit",
    seeder_score: 0.7,
  }));

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(0);

  // ── Stats ──────────────────────────────────────────────────────────
  console.log("📊 Stats:");
  console.log(`  Queries executed:      ${totalQueries}`);
  console.log(`  Unique URLs extracted: ${rows.length.toLocaleString()}`);
  console.log(`  Total time:            ${totalTime}s`);

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
    console.log(`    ${String(count).padStart(5)}  ${domain}`);
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify(rows, null, 2));
  console.log(`\n💾 Cached ${rows.length} URLs → ${OUTPUT_FILE}`);
  console.log("\n✅ Reddit extraction complete!\n");
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});