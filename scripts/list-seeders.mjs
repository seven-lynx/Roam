/**
 * list-seeders.mjs — Master list of all seeders with URL counts
 * Usage: node scripts/list-seeders.mjs
 *
 * 1. Scans all .json cache files in scripts/.cache/ for pending URLs
 * 2. Queries the Supabase `urls` table for committed URLs grouped by source
 * 3. Prints a combined report: source | cached (pending) | committed (DB) | total
 */

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync, readdirSync, existsSync } from "fs";
import { config as dotenvConfig } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "../.env") });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const CACHE_DIR = resolve(__dirname, ".cache");

// ── 1. Scan cache files for pending URLs ────────────────────────────────────
function scanCacheFiles() {
  if (!existsSync(CACHE_DIR)) {
    console.log("No .cache directory found.");
    return {};
  }

  const files = readdirSync(CACHE_DIR).filter((f) => f.endsWith(".json"));
  const cacheCounts = {};

  for (const file of files) {
    const source = file.replace(/\.json$/, "");
    try {
      const raw = readFileSync(resolve(CACHE_DIR, file), "utf8");
      const data = JSON.parse(raw);

      let pending = 0;

      // Pattern 1: { discovered: [...], fetched: {...} } — found/fetched but not committed
      if (data.discovered && Array.isArray(data.discovered)) {
        pending += data.discovered.length;
      }

      // Pattern 2: { fetched: {...} } — metadata fetched, pending upsert
      if (data.fetched && typeof data.fetched === "object" && !Array.isArray(data.fetched)) {
        // Each key in fetched is a URL whose metadata has been fetched
        // Count only if not already counted via discovered
        const fetchedCount = Object.keys(data.fetched).length;
        if (!data.discovered) {
          pending += fetchedCount;
        }
      }

      // Pattern 3: Some caches have a flat list of URLs as an array at top level
      if (Array.isArray(data) && data.length > 0) {
        pending += data.length;
      }

      // Pattern 4: { items: [...] } or { rows: [...] }
      if (data.items && Array.isArray(data.items)) {
        pending += data.items.length;
      }
      if (data.rows && Array.isArray(data.rows)) {
        pending += data.rows.length;
      }

      // Pattern 5: { progress: { discovered: N } }
      if (data.progress && typeof data.progress === "object" && data.progress.discovered) {
        // Don't double-count, just informational
      }

      if (pending > 0) {
        cacheCounts[source] = pending;
      }
    } catch {
      // skip unparseable files
    }
  }

  return cacheCounts;
}

// ── 2. Query DB for committed URLs ──────────────────────────────────────────
async function queryDbCounts() {
  // First try the materialized view (fast, pre-aggregated)
  const { data: mvData, error: mvError } = await supabase
    .from("mv_analytics_sources")
    .select("source, count");

  if (!mvError && mvData && mvData.length > 0) {
    console.log(`  (using materialized view — ${mvData.length} sources)`);
    const dbCounts = {};
    for (const row of mvData) {
      dbCounts[row.source] = row.count;
    }
    return dbCounts;
  }

  if (mvError) {
    console.log(`  MV unavailable (${mvError.message}), falling back to direct query...`);
  } else if (!mvData || mvData.length === 0) {
    console.log("  MV is empty, falling back to direct query...");
  }

  // Fallback: paginated direct query
  const dbCounts = {};
  const PAGE_SIZE = 1000;
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("urls")
      .select("source")
      .not("source", "is", null)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) {
      console.error("  DB query error:", error.message);
      return dbCounts;
    }

    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }

    for (const row of data) {
      dbCounts[row.source] = (dbCounts[row.source] || 0) + 1;
    }

    if (data.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      page++;
    }

    const totalCounted = Object.values(dbCounts).reduce((a, b) => a + b, 0);
    process.stdout.write(`\r  Fetched ${totalCounted} URLs...`);
  }
  process.stdout.write("\n");

  return dbCounts;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Roam Seeder Master List\n");
  console.log("Scanning cache files for pending URLs...");
  const cacheCounts = scanCacheFiles();

  console.log("Querying database for committed URLs...");
  const dbCounts = await queryDbCounts();

  // Merge all sources
  const allSources = new Set([
    ...Object.keys(cacheCounts),
    ...Object.keys(dbCounts),
  ]);

  const sorted = [...allSources].sort((a, b) => {
    const totalA = (cacheCounts[a] || 0) + (dbCounts[a] || 0);
    const totalB = (cacheCounts[b] || 0) + (dbCounts[b] || 0);
    return totalB - totalA;
  });

  // Print table
  console.log("\n┌─────────────────────────────────────────────────────┬──────────┬──────────┬──────────┐");
  console.log("│ Source                                              │ Cached   │ Committed│ Total    │");
  console.log("├─────────────────────────────────────────────────────┼──────────┼──────────┼──────────┤");

  let grandCached = 0;
  let grandCommitted = 0;

  for (const source of sorted) {
    const cached = cacheCounts[source] || 0;
    const committed = dbCounts[source] || 0;
    const total = cached + committed;
    grandCached += cached;
    grandCommitted += committed;

    const src = source.padEnd(51).slice(0, 51);
    const c = String(cached).padStart(8);
    const d = String(committed).padStart(8);
    const t = String(total).padStart(8);
    console.log(`│ ${src} │ ${c} │ ${d} │ ${t} │`);
  }

  console.log("├─────────────────────────────────────────────────────┼──────────┼──────────┼──────────┤");
  const s1 = String(grandCached).padStart(8);
  const s2 = String(grandCommitted).padStart(8);
  const s3 = String(grandCached + grandCommitted).padStart(8);
  console.log(`│ ${"GRAND TOTAL".padEnd(51)} │ ${s1} │ ${s2} │ ${s3} │`);
  console.log("└─────────────────────────────────────────────────────┴──────────┴──────────┴──────────┘");

  // Summary
  console.log(`\nSources with cached (pending) data: ${Object.keys(cacheCounts).length}`);
  console.log(`Sources in database:                ${Object.keys(dbCounts).length}`);
  console.log(`Total unique sources:               ${allSources.size}`);
}

main().catch(console.error);