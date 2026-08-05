/**
 * extract-stumbleupon-extension.mjs — Extracts URLs from StumbleUpon browser extensions
 *
 * Firefox .xpi and Chrome .crx extensions are ZIP archives.
 * This script unpacks them and searches for embedded data:
 *  - URL lists / starter sites
 *  - Category/topic definitions
 *  - Default recommendation cache
 *  - Hardcoded configuration files
 *
 * Usage:
 *   node scripts/extract-stumbleupon-extension.mjs --xpi=/path/to/stumbleupon.xpi
 *   node scripts/extract-stumbleupon-extension.mjs --crx=/path/to/stumbleupon.crx
 *
 * To locate extension files:
 *   - Search archive.org for "stumbleupon toolbar" or "stumbleupon .xpi"
 *   - Chrome extension ID for SU was: "lmjdlojahmbbcodnpecnjnmlddbkjhoh" (StumbleUpon)
 *   - Firefox: search addons.mozilla.org archives
 *   - Check https://crx.dam.io/ for old Chrome extension CRX files
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { resolve, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { CATEGORY, SUBCATEGORY } from "./lib/seed.js";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = resolve(__dirname, ".cache");
const EXT_DIR = resolve(CACHE_DIR, "extension-unpacked");
const OUTPUT_FILE = resolve(CACHE_DIR, "stumbleupon-extension.json");

const XPI_PATH = process.argv.find(a => a.startsWith("--xpi="))?.split("=")[1] || null;
const CRX_PATH = process.argv.find(a => a.startsWith("--crx="))?.split("=")[1] || null;

// Known Chrome extension ID for StumbleUpon
const SU_CHROME_ID = "lmjdlojahmbbcodnpecnjnmlddbkjhoh";
// Archive.org fallback URLs (may or may not exist)
const ARCHIVE_XPI_URL = "https://archive.org/download/stumbleupon-addon/stumbleupon.xpi";

// ── URL validation ─────────────────────────────────────────────────────────
function isValidHttpUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch { return false; }
}

// Extract URLs from text content
function extractUrlsFromText(text) {
  const urlRe = /https?:\/\/[^\s"'<>)\]}]+/gi;
  const found = new Set();
  let m;
  while ((m = urlRe.exec(text)) !== null) {
    const raw = m[0].replace(/[,;:.!?]*$/, "");
    if (isValidHttpUrl(raw) && !raw.includes("stumbleupon.com")) {
      found.add(raw);
    }
  }
  return [...found];
}

// ── Unpack ZIP extension ───────────────────────────────────────────────────
function unpackZip(zipPath, destDir) {
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

  try {
    // Use PowerShell on Windows, unzip on Unix
    if (process.platform === "win32") {
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, { stdio: "pipe" });
    } else {
      execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: "pipe" });
    }
    return true;
  } catch (err) {
    console.error(`  ❌ Failed to unpack ${zipPath}: ${err.message}`);
    return false;
  }
}

// ── Parse CRX header (Chrome extensions have a 16-byte header before ZIP) ───
function crxToZip(crxPath) {
  const raw = readFileSync(crxPath);
  // CRX3 format: "Cr24" magic + version + header length + header
  // CRX2 format: "Cr24" magic + version + pubkey length + sig length
  // The ZIP data starts after the header
  const magic = raw.toString("utf8", 0, 4);
  if (magic !== "Cr24") {
    console.error("  ❌ Not a valid CRX file (missing Cr24 magic)");
    return null;
  }

  const version = raw.readUInt32LE(4);
  let zipStart;

  if (version === 2) {
    const pubKeyLen = raw.readUInt32LE(8);
    const sigLen = raw.readUInt32LE(12);
    zipStart = 16 + pubKeyLen + sigLen;
  } else if (version === 3) {
    const headerLen = raw.readUInt32LE(8);
    zipStart = 12 + headerLen;
  } else {
    console.error(`  ❌ Unknown CRX version: ${version}`);
    return null;
  }

  const zipData = raw.slice(zipStart);
  const zipPath = crxPath.replace(/\.crx$/i, ".zip");
  writeFileSync(zipPath, zipData);
  console.log(`  Extracted ZIP from CRX → ${zipPath}`);
  return zipPath;
}

// ── Scan directory for interesting files ───────────────────────────────────
function scanDirectory(dir) {
  const results = {
    urls: new Set(),
    configs: [],
    jsonFiles: [],
    textFiles: [],
  };

  function walk(currentDir, depth = 0) {
    if (depth > 8) return; // prevent infinite recursion
    let entries;
    try {
      entries = readdirSync(currentDir, { withFileTypes: true });
    } catch { return; }

    for (const entry of entries) {
      const fullPath = resolve(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip common noise directories
        if (["node_modules", ".git", "__MACOSX"].includes(entry.name)) continue;
        walk(fullPath, depth + 1);
      } else if (entry.isFile()) {
        const ext = entry.name.split(".").pop().toLowerCase();
        const size = getFileSize(fullPath);
        if (size > 5 * 1024 * 1024) continue; // skip files > 5MB

        try {
          const content = readFileSync(fullPath, "utf8");

          // HTML files — extract URLs
          if (["html", "htm", "xhtml"].includes(ext)) {
            const urls = extractUrlsFromText(content);
            for (const u of urls) results.urls.add(u);
          }

          // JavaScript files — search for URL patterns, array literals with URLs
          if (["js", "jsx", "ts", "tsx"].includes(ext)) {
            const urls = extractUrlsFromText(content);
            for (const u of urls) results.urls.add(u);

            // Look for category/interest arrays
            if (content.includes("interest") || content.includes("category") || content.includes("topic")) {
              results.configs.push({ file: fullPath, type: "js-interest-data" });
            }
          }

          // JSON files — full parse
          if (ext === "json") {
            results.jsonFiles.push(fullPath);
            try {
              const parsed = JSON.parse(content);
              const jsonUrls = extractUrlsFromJson(parsed);
              for (const u of jsonUrls) results.urls.add(u);
            } catch { /* Not valid JSON, skip */ }
          }

          // XML/RDF files
          if (["xml", "rdf", "xul"].includes(ext)) {
            const urls = extractUrlsFromText(content);
            for (const u of urls) results.urls.add(u);
          }

          // Plain text
          if (["txt", "cfg", "ini", "properties", "config", "manifest"].includes(ext) || entry.name.includes("config")) {
            results.textFiles.push(fullPath);
            const urls = extractUrlsFromText(content);
            for (const u of urls) results.urls.add(u);
          }
        } catch { /* binary or encoding error, skip */ }
      }
    }
  }

  walk(dir);
  return results;
}

function getFileSize(path) {
  try {
    const { size } = require("fs").statSync(path);
    return size;
  } catch { return Infinity; }
}

// ── Recursively extract URLs from JSON structures ──────────────────────────
function extractUrlsFromJson(obj, depth = 0) {
  if (depth > 10) return [];
  const urls = new Set();

  if (typeof obj === "string") {
    if (isValidHttpUrl(obj) && !obj.includes("stumbleupon.com") && !obj.includes("mozilla.org") && !obj.includes("google.com/chrome")) {
      urls.add(obj);
    }
  } else if (Array.isArray(obj)) {
    for (const item of obj) {
      for (const u of extractUrlsFromJson(item, depth + 1)) urls.add(u);
    }
  } else if (obj && typeof obj === "object") {
    for (const [key, value] of Object.entries(obj)) {
      // Check keys that suggest URLs
      if (typeof value === "string" && ["url", "link", "href", "src", "homepage", "website", "site"].includes(key.toLowerCase()) && isValidHttpUrl(value)) {
        if (!value.includes("stumbleupon.com") && !value.includes("mozilla.org") && !value.includes("google.com")) {
          urls.add(value);
        }
      }
      for (const u of extractUrlsFromJson(value, depth + 1)) urls.add(u);
    }
  }

  return [...urls];
}

// ── Clean title ────────────────────────────────────────────────────────────
function cleanTitle(t) {
  if (!t) return null;
  return String(t).trim().replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").slice(0, 300) || null;
}

// ── MAIN ───────────────────────────────────────────────────────────────────
function main() {
  console.log("========== StumbleUpon Browser Extension Unpacker ==========\n");

  if (!XPI_PATH && !CRX_PATH) {
    console.log("No extension file provided. Usage:");
    console.log("  node scripts/extract-stumbleupon-extension.mjs --xpi=/path/to/stumbleupon.xpi");
    console.log("  node scripts/extract-stumbleupon-extension.mjs --crx=/path/to/stumbleupon.crx");
    console.log("\n📝 To obtain extension files:");
    console.log("  1. Chrome: Download from crx.dam.io or chrome-stats.com using ID: " + SU_CHROME_ID);
    console.log("  2. Firefox: Search archive.org for 'stumbleupon.xpi'");
    console.log("  3. Check: https://archive.org/details/stumbleupon-addon");
    console.log("  4. Try: " + ARCHIVE_XPI_URL);
    console.log("\n  Place downloaded file in scripts/.cache/ and point this script at it.");
    return;
  }

  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

  let zipPath = null;

  // Handle XPI (Firefox — already a ZIP)
  if (XPI_PATH) {
    if (!existsSync(XPI_PATH)) {
      console.error(`❌ XPI file not found: ${XPI_PATH}`);
      process.exit(1);
    }
    console.log(`📦 Processing XPI: ${XPI_PATH}`);
    zipPath = XPI_PATH;
  }

  // Handle CRX (Chrome — needs header stripping)
  if (CRX_PATH) {
    if (!existsSync(CRX_PATH)) {
      console.error(`❌ CRX file not found: ${CRX_PATH}`);
      process.exit(1);
    }
    console.log(`📦 Processing CRX: ${CRX_PATH}`);
    zipPath = crxToZip(CRX_PATH);
    if (!zipPath) process.exit(1);
  }

  // Unpack
  const unpackDir = resolve(EXT_DIR, basename(zipPath).replace(/\.\w+$/, ""));
  console.log(`\n📂 Unpacking to: ${unpackDir}`);
  const success = unpackZip(zipPath, unpackDir);
  if (!success) process.exit(1);

  // Scan
  console.log("\n🔍 Scanning extracted files...");
  const results = scanDirectory(unpackDir);

  console.log(`\n📊 Scan Results:`);
  console.log(`  URLs found:           ${results.urls.size}`);
  console.log(`  JSON files examined:  ${results.jsonFiles.length}`);
  console.log(`  Config/text files:    ${results.textFiles.length}`);
  console.log(`  Interest data files:  ${results.configs.length}`);

  if (results.configs.length > 0) {
    console.log("\n  📁 Interest/category data files found:");
    for (const cfg of results.configs) {
      const relPath = cfg.file.replace(unpackDir, "").replace(/^[/\\]/, "");
      console.log(`    ${relPath} (${cfg.type})`);
    }
  }

  if (results.jsonFiles.length > 0) {
    console.log("\n  📁 JSON files (first 10):");
    for (const f of results.jsonFiles.slice(0, 10)) {
      const relPath = f.replace(unpackDir, "").replace(/^[/\\]/, "");
      console.log(`    ${relPath}`);
    }
  }

  // ── Build output ─────────────────────────────────────────────────────
  const rows = [...results.urls].map((url) => ({
    url,
    description: "Discovered in StumbleUpon browser extension files",
    category_id: CATEGORY.WEIRD_WONDERFUL,
    subcategory_id: SUBCATEGORY.VINTAGE_INTERNET,
    source: "stumbleupon-extension",
    seeder_score: 0.8,
  }));

  if (rows.length > 0) {
    writeFileSync(OUTPUT_FILE, JSON.stringify(rows, null, 2));
    console.log(`\n💾 Cached ${rows.length} URLs → ${OUTPUT_FILE}`);
    console.log("   Run node scripts/seed-stumbleupon.mjs --source=extension to import");

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
  } else {
    console.log("\n⚠️  No URLs found in extension files.");
    console.log("  The extension may not contain embedded URL lists,");
    console.log("  or the data may be in a binary format not readable as text.");
  }

  console.log("\n✅ Extension unpacking complete!\n");
}

main();