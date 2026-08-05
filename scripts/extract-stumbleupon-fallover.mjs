/**
 * extract-stumbleupon-fallover.mjs — Extracts URLs from l3gacyb3ta/fallover dataset
 *
 * Reads scripts/.cache/stumbleupon-fallover/db.json (LevelDB-style JSON dump).
 * Filters out Reddit, social media, and other low-quality domains.
 * Maps all URLs to WEIRD_WONDERFUL > ODDITIES_CURIOSITIES (default).
 *
 * Usage: node scripts/extract-stumbleupon-fallover.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { CATEGORY, SUBCATEGORY } from "./lib/seed.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = resolve(__dirname, ".cache");
const INPUT_FILE = resolve(CACHE_DIR, "stumbleupon-fallover", "db.json");
const OUTPUT_FILE = resolve(CACHE_DIR, "stumbleupon-fallover.json");

// ── Domains to filter OUT entirely ────────────────────────────────────────────
// These are high-volume / low-quality domains that dominate the dataset
const BLOCKED_DOMAINS = new Set([
  // Reddit — entire site (threads, comments, images)
  "reddit.com", "redd.it", "i.redd.it", "v.redd.it", "redditstatic.com",
  "redditmedia.com",
  // YouTube — video platform
  "youtube.com", "youtu.be", "youtube-nocookie.com",
  // Twitter / X
  "twitter.com", "x.com", "t.co",
  // Facebook / Instagram
  "facebook.com", "fb.com", "instagram.com",
  // Other social media
  "tiktok.com", "snapchat.com",
  // Pinterest
  "pinterest.com", "pin.it",
]);

// ── Wikipedia non-article namespace prefixes ──────────────────────────────────
const WIKI_NON_ARTICLE = new Set([
  "Wikipedia:", "Special:", "Talk:", "User:", "Template:", "Help:",
  "Portal:", "Category:", "File:", "MediaWiki:", "Draft:", "Module:",
  "TimedText:", "Topic:", "Book:", "Gadget:", "Gadget_definition:",
]);

/**
 * Check if a Wikipedia URL refers to an actual article (vs. admin/meta page).
 * Keeps: /wiki/Article_title, /wiki/Article_title#section
 * Filters: /wiki/Wikipedia:..., /wiki/Special:..., /wiki/Talk:..., etc.
 * Also filters: bare /wiki/, root path with no article
 */
function isWikipediaArticle(url) {
  try {
    const u = new URL(url);
    if (u.hostname !== "en.wikipedia.org" && !u.hostname.endsWith(".wikipedia.org")) {
      return true; // not wikipedia, let other filters handle it
    }
    const path = u.pathname;
    if (!path.startsWith("/wiki/")) return false;
    const article = path.slice("/wiki/".length).split("#")[0];
    if (!article || article === "" || article === "Main_Page") return false;
    for (const prefix of WIKI_NON_ARTICLE) {
      if (article.startsWith(prefix)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ── Domain check helpers ──────────────────────────────────────────────────────
function isBlockedDomain(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (BLOCKED_DOMAINS.has(host)) return true;
    // Subdomain match
    const parts = host.split(".");
    for (let i = 0; i < parts.length - 1; i++) {
      const suffix = parts.slice(i).join(".");
      if (BLOCKED_DOMAINS.has(suffix)) return true;
    }
    return false;
  } catch {
    return true; // invalid URLs are blocked
  }
}

// ── URL validation ────────────────────────────────────────────────────────────
function isValidHttpUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// ── Clean keyword as title hint ───────────────────────────────────────────────
function cleanKeyword(kw) {
  if (!kw || typeof kw !== "string") return null;
  const t = kw.trim()
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/\s+/g, " ")
    .slice(0, 200);
  return t || null;
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("========== Fallover Dataset URL Extractor ==========\n");

  if (!existsSync(INPUT_FILE)) {
    console.error(`❌ Fallover db.json not found: ${INPUT_FILE}`);
    console.error("   Expected: scripts/.cache/stumbleupon-fallover/db.json");
    process.exit(1);
  }

  console.log(`Reading ${INPUT_FILE}...`);
  const raw = readFileSync(INPUT_FILE, "utf8");
  const data = JSON.parse(raw);

  if (!data._default || typeof data._default !== "object") {
    console.error("❌ Unexpected db.json format. Expected { _default: { ... } }");
    process.exit(1);
  }

  const entries = Object.values(data._default);
  console.log(`Found ${entries.length} entries in _default\n`);

  const urlMap = new Map();
  let totalRecords = 0;
  let blockedReddit = 0;
  let blockedYoutube = 0;
  let blockedSocial = 0;
  let blockedWikipedia = 0;
  let invalidUrl = 0;
  let duplicates = 0;

  for (const entry of entries) {
    if (!entry || !entry.url) continue;
    totalRecords++;

    const url = typeof entry.url === "string" ? entry.url.trim() : "";
    if (!url || !isValidHttpUrl(url)) { invalidUrl++; continue; }

    // Block social media / Reddit entirely
    if (isBlockedDomain(url)) {
      const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
      if (host.includes("reddit.com") || host.includes("redd.it") || host === "i.redd.it" || host === "v.redd.it") {
        blockedReddit++;
      } else if (host.includes("youtube.com") || host === "youtu.be") {
        blockedYoutube++;
      } else {
        blockedSocial++;
      }
      continue;
    }

    // Wikipedia: filter non-article pages
    if (url.includes("wikipedia.org")) {
      if (!isWikipediaArticle(url)) {
        blockedWikipedia++;
        continue;
      }
    }

    // Deduplicate by URL (first-wins — keeps earliest entry)
    if (urlMap.has(url)) { duplicates++; continue; }

    const keyword = Array.isArray(entry.keywords) && entry.keywords.length > 0
      ? cleanKeyword(entry.keywords[0])
      : null;

    urlMap.set(url, {
      url,
      title: keyword || undefined,
      description: keyword ? `Fallover keyword hint: ${keyword}` : undefined,
      category_id: CATEGORY.WEIRD_WONDERFUL,
      subcategory_id: SUBCATEGORY.ODDITIES_CURIOSITIES,
      source: "stumbleupon-fallover",
      seeder_score: 0.5,
    });
  }

  const rows = [...urlMap.values()];

  // ── Stats ──
  console.log("📊 Stats:");
  console.log(`  Total entries:          ${totalRecords}`);
  console.log(`  Blocked - Reddit:       ${blockedReddit}`);
  console.log(`  Blocked - YouTube:      ${blockedYoutube}`);
  console.log(`  Blocked - Other social: ${blockedSocial}`);
  console.log(`  Blocked - Wikipedia:    ${blockedWikipedia}`);
  console.log(`  Invalid URLs:           ${invalidUrl}`);
  console.log(`  Duplicates:             ${duplicates}`);
  console.log(`  ✅ Kept (unique):       ${rows.length}`);

  // ── Domain breakdown ──
  const domainCounts = {};
  for (const row of rows) {
    try {
      const host = new URL(row.url).hostname.replace(/^www\./, "").toLowerCase();
      domainCounts[host] = (domainCounts[host] || 0) + 1;
    } catch { /* skip */ }
  }
  const topDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  console.log("\n  Top 20 domains (kept):");
  for (const [domain, count] of topDomains) {
    console.log(`    ${String(count).padStart(5)}  ${domain}`);
  }

  // ── Write output ──
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(rows, null, 2));
  console.log(`\n💾 Cached ${rows.length} URLs → ${OUTPUT_FILE}`);
  console.log("\n✅ Extraction complete!\n");
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});