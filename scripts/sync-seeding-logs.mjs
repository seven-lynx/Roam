/**
 * sync-seeding-logs.mjs — Batch-sync local seeding runs to Supabase
 *
 * Reads scripts/.cache/seeding-runs.jsonl and upserts unsynced entries
 * to the supabase.public.seeding_runs table. Tracks sync position via
 * scripts/.cache/sync-pointer.json.
 *
 * Run manually or on a cron — NOT during seeding.
 *
 * Usage:
 *   node scripts/sync-seeding-logs.mjs          Sync all unsynced
 *   node scripts/sync-seeding-logs.mjs --dry    Show what would sync
 */

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { config as dotenvConfig } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "../.env") });

import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const LOG_FILE = resolve(__dirname, ".cache", "seeding-runs.jsonl");
const POINTER_FILE = resolve(__dirname, ".cache", "sync-pointer.json");
const DRY_RUN = process.argv.includes("--dry");

function ensureDir() {
  const dir = dirname(LOG_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function getPointer() {
  if (!existsSync(POINTER_FILE)) return 0;
  try { return JSON.parse(readFileSync(POINTER_FILE, "utf8")).lineCount || 0; }
  catch { return 0; }
}

function setPointer(lineCount) {
  writeFileSync(POINTER_FILE, JSON.stringify({ lineCount, updatedAt: new Date().toISOString() }, null, 2));
}

function readLogs(skipLines = 0) {
  ensureDir();
  if (!existsSync(LOG_FILE)) return [];
  try {
    const raw = readFileSync(LOG_FILE, "utf8");
    const lines = raw.trim().split("\n").filter(Boolean);
    return lines
      .slice(skipLines)
      .map((line, i) => {
        try { return { ...JSON.parse(line), _lineIndex: skipLines + i }; }
        catch { return null; }
      })
      .filter(Boolean);
  } catch { return []; }
}

async function sync() {
  const ptr = getPointer();
  const entries = readLogs(ptr);

  if (!entries.length) {
    console.log("✅ Already in sync. No new entries.");
    return;
  }

  console.log(`📤 Syncing ${entries.length} entries (skipped ${ptr} previously synced)...`);

  // Validate and map to DB columns
  const rows = entries.map(e => ({
    seeder:       e.seeder || "unknown",
    display_name: e.display_name || null,
    source:       e.source || e.seeder || "unknown",
    category:     e.category || null,
    subcategory:  e.subcategory || null,
    discovered:   e.discovered ?? 0,
    inserted:     e.inserted ?? 0,
    skipped:      e.skipped ?? 0,
    dead:         e.dead ?? 0,
    redirects:    e.redirects ?? 0,
    error:        e.error || null,
    warnings:     e.warnings || null,
    duration_ms:  e.duration_ms || null,
    cache_bytes:  e.cache_bytes || null,
    method:       e.method || null,
    started_at:   e.started_at || new Date().toISOString(),
    finished_at:  e.finished_at || new Date().toISOString(),
  }));

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would sync ${rows.length} entries:`);
    for (const r of rows.slice(0, 10)) {
      console.log(`  ${r.seeder.padEnd(25)} | in:${String(r.inserted).padStart(5)} skip:${String(r.skipped).padStart(5)} dead:${String(r.dead).padStart(5)}`);
    }
    if (rows.length > 10) console.log(`  ... and ${rows.length - 10} more`);
    return;
  }

  // Batch upsert
  const { error } = await supabase.from("seeding_runs").upsert(rows, {
    onConflict: "seeder,started_at",
    ignoreDuplicates: true,
  });

  if (error) {
    console.error("❌ Sync failed:", error.message);
    // Don't advance pointer on failure
    return;
  }

  // Advance pointer
  const newPtr = ptr + entries.length;
  setPointer(newPtr);
  console.log(`✅ Synced ${entries.length} entries. Pointer advanced to ${newPtr}.`);
}

sync().catch(err => {
  console.error("FATAL:", err.message);
  process.exit(1);
});