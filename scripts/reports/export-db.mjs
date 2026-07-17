#!/usr/bin/env node
/**
 * export-db.mjs — Export all public Supabase tables to local SQLite.
 * Uses cursor-based (key-set) pagination to avoid timeouts on deep pages.
 */

import { createClient } from "@supabase/supabase-js";
import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync, unlinkSync, statSync } from "fs";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "..", "..", ".env") });

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const OFFLINE_DIR = resolve(__dirname, "offline");
if (!existsSync(OFFLINE_DIR)) mkdirSync(OFFLINE_DIR, { recursive: true });
const DB_PATH = resolve(OFFLINE_DIR, "roam.db");
if (existsSync(DB_PATH)) { unlinkSync(DB_PATH); console.log("Removed old offline database."); }

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = OFF");
db.pragma("cache_size = -64000");

const PAGE_SIZE = 2000;
const totalStart = Date.now();

async function exportTable(tableName) {
  console.log(`\nExporting ${tableName}...`);

  // Get sample to discover columns
  const { data: sample, error: sampleErr } = await sb.from(tableName).select("*").limit(1);
  if (sampleErr || !sample || !sample.length) {
    // Try count
    const { count } = await sb.from(tableName).select("*", { count: "exact", head: true });
    if (count === 0) { console.log(`  ✅ ${tableName}: 0 rows (empty table)`); return 0; }
    console.error(`  ❌ ${tableName}: ${sampleErr?.message || "no rows"}`); return 0;
  }

  const row = sample[0];
  const cols = Object.keys(row).filter(k => !k.startsWith("_"));
  const hasId = cols.includes("id");

  // Build CREATE TABLE
  const colDefs = cols.map(col => {
    const v = row[col];
    let type = "TEXT";
    if (typeof v === "number") type = Number.isInteger(v) ? "INTEGER" : "REAL";
    else if (typeof v === "boolean") type = "INTEGER";
    return `"${col}" ${type}`;
  }).join(", ");

  db.exec(`DROP TABLE IF EXISTS "${tableName}"`);
  db.exec(`CREATE TABLE "${tableName}" (${colDefs})`);

  const placeholders = cols.map(() => "?").join(", ");
  const insertStmt = db.prepare(`INSERT INTO "${tableName}" VALUES (${placeholders})`);

  const insertMany = db.transaction((rows) => {
    for (const row of rows) {
      const vals = cols.map(col => {
        const v = row[col];
        if (v === null || v === undefined) return null;
        if (typeof v === "boolean") return v ? 1 : 0;
        if (typeof v === "object") return JSON.stringify(v);
        return v;
      });
      insertStmt.run(...vals);
    }
  });

  const colSelect = cols.join(", ");
  let total = 0, lastId = null;
  const t0 = Date.now();

  // Use cursor-based pagination if table has an 'id' column
  if (hasId) {
    while (true) {
      let q = sb.from(tableName).select(colSelect).order("id", { ascending: true }).limit(PAGE_SIZE);
      if (lastId) q = q.gt("id", lastId);
      const { data, error } = await q;
      if (error) { console.error(`\n  Error: ${error.message}`); break; }
      if (!data || data.length === 0) break;

      insertMany(data);
      total += data.length;
      lastId = data[data.length - 1].id;
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      process.stdout.write(`\r  Exported ${total.toLocaleString()} rows (${elapsed}s) [lastId=${String(lastId).slice(0,8)}]`);
    }
  } else {
    // Fallback to offset pagination for tables without id
    let page = 0;
    while (true) {
      const { data, error } = await sb.from(tableName).select(colSelect).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) { console.error(`\n  Error on page ${page}: ${error.message}`); break; }
      if (!data || data.length === 0) break;
      insertMany(data);
      total += data.length;
      page++;
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      process.stdout.write(`\r  Exported ${total.toLocaleString()} rows (${elapsed}s) [page ${page}]`);
      if (data.length < PAGE_SIZE) break;
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\r  ✅ ${tableName}: ${total.toLocaleString()} rows in ${elapsed}s`);

  // Add indexes
  if (tableName === "urls" && cols.includes("approved")) {
    console.log("  Creating indexes...");
    db.exec(`CREATE INDEX IF NOT EXISTS idx_urls_approved ON urls(approved)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_urls_inactive ON urls(inactive)`);
    if (cols.includes("source")) db.exec(`CREATE INDEX IF NOT EXISTS idx_urls_source ON urls(source)`);
    if (cols.includes("subcategory_id")) db.exec(`CREATE INDEX IF NOT EXISTS idx_urls_subcategory ON urls(subcategory_id)`);
    if (cols.includes("wilson_score")) db.exec(`CREATE INDEX IF NOT EXISTS idx_urls_wilson ON urls(wilson_score)`);
    if (cols.includes("language")) db.exec(`CREATE INDEX IF NOT EXISTS idx_urls_language ON urls(language)`);
    console.log("  Indexes created.");
  }

  return total;
}

async function main() {
  console.log("Roam DB Exporter (cursor-based)\n");

  const TABLES = [
    "urls", "categories", "subcategories", "profiles", "moderation_queue",
    "seen_urls", "ratings", "follows", "user_categories", "user_interest_scores",
    "badges", "user_badges", "xp_log", "notifications", "user_activity",
    "shared_urls", "saved_urls", "collections", "collection_items",
    "paywalled_domains", "feedback", "user_settings", "user_domain_cooldowns",
    "url_reports", "seeding_runs", "email_log", "beta_signups",
  ];

  let grandTotal = 0;
  for (const tableName of TABLES) {
    try { grandTotal += await exportTable(tableName); }
    catch (err) { console.error(`  ❌ ${tableName}: ${err.message}`); }
  }

  const totalTime = ((Date.now() - totalStart) / 1000).toFixed(1);
  const size = (statSync(DB_PATH).size / 1024 / 1024).toFixed(1);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`✅ Export complete: ${grandTotal.toLocaleString()} rows in ${totalTime}s`);
  console.log(`   Database: ${DB_PATH} (${size} MB)`);
  console.log(`\nRun reports with: node scripts/reports/run-suite.mjs --offline`);
  console.log(`${"=".repeat(60)}\n`);
  db.close();
}

main().catch(err => { console.error(`\n❌ Fatal: ${err.message}`); process.exit(1); });