/**
 * extract-stumbleupon-github.mjs — Extracts StumbleUpon URLs from GitHub repositories
 *
 * Searches GitHub for public repos and gists containing StumbleUpon URL dumps
 * (backup exports, curated lists, personal favorites archives).
 * Uses the GitHub Search REST API (unauthenticated: 10 req/min, authenticated: 30 req/min).
 *
 * Set GITHUB_TOKEN env var (fine-grained or classic PAT) for higher rate limits.
 *
 * Usage: node scripts/extract-stumbleupon-github.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { CATEGORY, SUBCATEGORY } from "./lib/seed.js";
import fetch from "node-fetch";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = resolve(__dirname, ".cache");
const OUTPUT_FILE = resolve(CACHE_DIR, "stumbleupon-github.json");
const GITHUB_CACHE_DIR = resolve(CACHE_DIR, "github-raw");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || null;
const UA = "Roam-Seeder/1.0 (+https://roamtheweb.app)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Rate limiting ──────────────────────────────────────────────────────────
const RATE_LIMIT = GITHUB_TOKEN ? 30 : 10; // requests per minute
const DELAY = Math.ceil(60_000 / RATE_LIMIT) + 200; // ms between requests

// ── Search queries ─────────────────────────────────────────────────────────
// Each query targets a different type of SU URL dump
const SEARCH_QUERIES = [
  // Code search: files containing stumbleupon.com URLs
  { type: "code", q: '"stumbleupon.com/url" language:json', label: "code-json" },
  { type: "code", q: '"stumbleupon.com/url" language:csv',  label: "code-csv" },
  { type: "code", q: '"stumbleupon.com/url" language:markdown', label: "code-md" },
  { type: "code", q: '"stumbleupon.com/url" language:tsv',  label: "code-tsv" },

  // Repo search: repos named after StumbleUpon
  { type: "repositories", q: 'stumbleupon-backup OR stumbleupon-favorites OR stumbleupon-archive OR stumbleupon-likes', label: "repo-su-themed" },

  // Code search: broader SU mentions in structured formats
  { type: "code", q: '"stumbleupon.com" filename:*.json', label: "code-any-json" },
  { type: "code", q: '"stumbleupon.com" filename:*.csv',  label: "code-any-csv" },
  { type: "code", q: '"http://www.stumbleupon.com"',       label: "code-http-su" },
  { type: "code", q: '"stumbleupon" filename:README.md',   label: "code-readme-su" },

  // Gist search
  { type: "gists", q: "stumbleupon backup", label: "gist-backup" },
];

// ── URL validation ─────────────────────────────────────────────────────────
function isValidHttpUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// ── Blocked domains (same as other extractors) ────────────────────────────
const BLOCKED_DOMAINS = new Set([
  "reddit.com", "redd.it", "i.redd.it", "v.redd.it",
  "youtube.com", "youtu.be",
  "twitter.com", "x.com", "t.co",
  "facebook.com", "fb.com", "instagram.com",
  "tiktok.com", "snapchat.com",
  "pinterest.com", "pin.it",
  "bit.ly", "tinyurl.com", "ow.ly", "is.gd", "buff.ly", "goo.gl",
  "amazon.com", "ebay.com", "etsy.com", "aliexpress.com",
  "shopify.com", "walmart.com",
  "doubleclick.net", "googlesyndication.com",
  "onlyfans.com", "fansly.com",
  "stumbleupon.com", // skip SU itself
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
  // Match http/https URLs — grabs everything until whitespace/quote/brace
  const urlRe = /https?:\/\/[^\s"'<>)\]}]+/gi;
  const found = new Set();
  let m;
  while ((m = urlRe.exec(text)) !== null) {
    const raw = m[0].replace(/[,;:.!?]*$/, ""); // strip trailing punctuation
    if (isValidHttpUrl(raw) && !isBlockedDomain(raw) && !raw.includes("stumbleupon.com")) {
      found.add(raw);
    }
  }
  return [...found];
}

// ── Title extraction from text ─────────────────────────────────────────────
function extractTitleForUrl(text, url) {
  // Try to find text near the URL that looks like a title
  // e.g., JSON: "title": "Foo Bar", "url": "https://..."
  // e.g., CSV: "Title","https://..."
  // Heuristic: look for quoted string before or after the URL in the same line
  const lines = text.split("\n");
  for (const line of lines) {
    if (!line.includes(url)) continue;
    // Try "title" key in JSON-like context
    const titleMatch = line.match(/["']title["']\s*:\s*["']([^"']{3,200})["']/i);
    if (titleMatch) return titleMatch[1].trim();
    // Try first quoted string before URL in CSV context
    const csvMatch = line.match(/["']([^"']{3,200})["']\s*,\s*["']https?:/i);
    if (csvMatch) return csvMatch[1].trim();
    // Try markdown link: [Title](url)
    const mdMatch = line.match(/\[([^\]]{3,200})\]\(\s*https?:/i);
    if (mdMatch) return mdMatch[1].trim();
  }
  return null;
}

// ── GitHub API calls ───────────────────────────────────────────────────────
async function githubApi(path) {
  const headers = { "User-Agent": UA, Accept: "application/vnd.github.v3+json" };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;

  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (res.status === 403 || res.status === 429) {
    const retryAfter = parseInt(res.headers.get("retry-after") || "60", 10);
    console.log(`  ⚠️  Rate limited. Waiting ${retryAfter}s...`);
    await sleep(retryAfter * 1000 + 1000);
    return githubApi(path); // retry once
  }
  if (!res.ok) {
    console.log(`  ⚠️  GitHub API ${res.status}: ${path}`);
    return null;
  }
  return res.json();
}

async function searchGitHub(query, page = 1) {
  const path = `/search/${query.type}?q=${encodeURIComponent(query.q)}&per_page=30&page=${page}`;
  return githubApi(path);
}

// Used only for repos with a known file path
async function getFileContent(repoFullName, filePath, ref = "HEAD") {
  const path = `/repos/${repoFullName}/contents/${encodeURIComponent(filePath)}?ref=${ref}`;
  return githubApi(path);
}

// ── Process a repository to extract URLs ────────────────────────────────────
async function processRepoFile(repoFullName, filePath) {
  const content = await getFileContent(repoFullName, filePath);
  if (!content || !content.content) return [];
  const text = Buffer.from(content.content, "base64").toString("utf8");
  const urls = extractUrlsFromText(text);
  return urls.map((url) => ({
    url,
    title: extractTitleForUrl(text, url) || undefined,
  }));
}

// ── Process a gist to extract URLs ──────────────────────────────────────────
async function processGist(gistId, files) {
  const results = [];
  for (const [filename, fileInfo] of Object.entries(files)) {
    if (!fileInfo.raw_url) continue;
    try {
      const res = await fetch(fileInfo.raw_url, { headers: { "User-Agent": UA } });
      if (!res.ok) continue;
      const text = await res.text();
      const urls = extractUrlsFromText(text);
      for (const url of urls) {
        results.push({
          url,
          title: extractTitleForUrl(text, url) || undefined,
          source_filename: filename,
        });
      }
    } catch {
      continue;
    }
  }
  return results;
}

// ── Clean title ─────────────────────────────────────────────────────────────
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

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("========== StumbleUpon GitHub URL Extractor ==========\n");

  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  if (!existsSync(GITHUB_CACHE_DIR)) mkdirSync(GITHUB_CACHE_DIR, { recursive: true });

  console.log(`Rate limit: ${RATE_LIMIT} req/min${GITHUB_TOKEN ? " (authenticated)" : " (unauthenticated — set GITHUB_TOKEN for 30/min)"}\n`);

  const urlMap = new Map();
  let totalApiCalls = 0;
  let filesProcessed = 0;
  let reposFound = 0;
  let gistsFound = 0;

  for (const query of SEARCH_QUERIES) {
    console.log(`─── Searching: ${query.type} → "${query.q}" ───`);

    let page = 1;
    let maxPages = 3; // Max 3 pages (90 results) per query
    let queryResults = 0;

    while (page <= maxPages) {
      totalApiCalls++;
      await sleep(DELAY);

      const results = await searchGitHub(query, page);
      if (!results || !results.items || results.items.length === 0) break;

      console.log(`  Page ${page}: ${results.items.length} results (total count: ${results.total_count})`);

      for (const item of results.items) {
        if (query.type === "gists") {
          // Process gist directly (files already included in search response)
          const gistFiles = item.files || {};
          gistsFound++;
          filesProcessed += Object.keys(gistFiles).length;

          const gistUrls = await processGist(item.id, gistFiles);
          await sleep(500); // small delay between gist fetches
          for (const entry of gistUrls) {
            if (!urlMap.has(entry.url)) {
              urlMap.set(entry.url, entry);
            }
          }
          if (gistUrls.length > 0) {
            console.log(`    Gist ${item.id.slice(0, 8)}...: ${gistUrls.length} URLs`);
          }
        } else if (query.type === "repositories") {
          // For repo search, try common dump file paths
          reposFound++;
          const fullName = item.full_name;
          const commonPaths = [
            "stumbleupon.json", "stumbleupon_backup.json",
            "data/urls.json", "data/stumbleupon.json",
            "exports/stumbleupon.json", "backup/stumbleupon.json",
            "urls.json", "favorites.json", "likes.json",
            "stumbleupon.csv", "stumbleupon.tsv",
            "data.csv", "export.csv", "urls.csv",
            "stumbleupon_export.json", "su_favorites.json",
            "stumbleupon_backup.csv", "su_backup.json",
            "dump.json", "export.json",
            "README.md", "README.txt", "readme.md",
          ];

          let repoFileFound = false;
          for (const fp of commonPaths) {
            await sleep(200);
            const fileUrls = await processRepoFile(fullName, fp);
            filesProcessed++;
            for (const entry of fileUrls) {
              if (!urlMap.has(entry.url)) {
                urlMap.set(entry.url, entry);
              }
            }
            if (fileUrls.length > 0) {
              console.log(`    ${fullName}/${fp}: ${fileUrls.length} URLs`);
              repoFileFound = true;
              break; // Found a good file, skip remaining paths for this repo
            }
          }
          if (!repoFileFound) {
            console.log(`    ${fullName}: no URL dumps found in common paths`);
          }
        } else {
          // Code search: extract URLs from file content
          const fullName = item.repository?.full_name || "";
          const filePath = item.path || "";
          if (!fullName || !filePath) continue;

          reposFound++;
          await sleep(200);
          const fileUrls = await processRepoFile(fullName, filePath);
          filesProcessed++;
          for (const entry of fileUrls) {
            if (!urlMap.has(entry.url)) {
              urlMap.set(entry.url, entry);
            }
          }
          if (fileUrls.length > 0) {
            console.log(`    ${fullName}/${filePath}: ${fileUrls.length} URLs`);
          }
        }

        queryResults += results.items.length;
      }

      // Stop if fewer results than page size (last page)
      if (results.items.length < 30) break;
      page++;
    }

    console.log(`  ✅ ${query.label}: done (${queryResults} items scanned)\n`);
  }

  // ── Build output rows ──────────────────────────────────────────────────
  const rows = [];
  for (const entry of urlMap.values()) {
    rows.push({
      url: entry.url,
      title: cleanTitle(entry.title) || undefined,
      description: entry.source_filename
        ? `Discovered in GitHub gist/repo file: ${entry.source_filename}`
        : `Discovered from GitHub search`,
      category_id: CATEGORY.WEIRD_WONDERFUL,
      subcategory_id: SUBCATEGORY.VINTAGE_INTERNET,
      source: "stumbleupon-github",
      seeder_score: 0.6,
    });
  }

  // ── Stats ───────────────────────────────────────────────────────────────
  console.log("\n📊 Stats:");
  console.log(`  GitHub API calls:      ${totalApiCalls}`);
  console.log(`  Repos found:           ${reposFound}`);
  console.log(`  Gists found:           ${gistsFound}`);
  console.log(`  Files processed:       ${filesProcessed}`);
  console.log(`  Unique URLs extracted: ${rows.length}`);

  // Top domain breakdown
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

  // ── Write output ───────────────────────────────────────────────────────
  writeFileSync(OUTPUT_FILE, JSON.stringify(rows, null, 2));
  console.log(`\n💾 Cached ${rows.length} URLs → ${OUTPUT_FILE}`);
  console.log("\n✅ GitHub extraction complete!\n");
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});