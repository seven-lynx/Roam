/**
 * log-seeding.mjs — Local seeder run logger (no Supabase dependency)
 *
 * Appends each run to `scripts/.cache/seeding-runs.jsonl` (one JSON object per line).
 *
 * Usage:
 *   import { logSeedingRun, logSeedingCrash, querySeedingRuns, getSeedingStats } from "./log-seeding.mjs";
 *
 *   await logSeedingRun({
 *     seeder: "kotaku",
 *     displayName: "🎮 Kotaku",
 *     source: "kotaku",
 *     category: "GAMES_HOBBIES",
 *     subcategory: "VIDEO_GAMES",
 *     discovered: 500,
 *     inserted: 200,
 *     skipped: 250,
 *     dead: 50,
 *     error: null,
 *     duration_ms: 120000,
 *   });
 *
 *   await logSeedingCrash({
 *     seeder: "kotaku",
 *     displayName: "🎮 Kotaku",
 *     error: "ENOTFOUND api.example.com",
 *     method: "RSS",
 *     started_at: "2026-07-10T12:00:00Z",
 *   });
 *
 * CLI queries:
 *   node scripts/log-seeding.mjs --list              # Last 7 days
 *   node scripts/log-seeding.mjs --list --days=30     # Last 30 days
 *   node scripts/log-seeding.mjs --stats              # Aggregate stats
 *   node scripts/log-seeding.mjs --seeder=kotaku      # Specific seeder history
 *   node scripts/log-seeding.mjs --tail               # Tail the last 20 runs
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_FILE = resolve(__dirname, ".cache", "seeding-runs.jsonl");

/** Ensure .cache dir exists */
function ensureDir() {
  const dir = dirname(LOG_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * Log a seeding run to local JSONL file.
 *
 * @param {{
 *   seeder: string,
 *   displayName?: string,
 *   source: string,
 *   category?: string,
 *   subcategory?: string,
 *   discovered: number,
 *   inserted: number,
 *   skipped: number,
 *   dead: number,
 *   redirects?: number,
 *   error?: string|null,
 *   warnings?: string[],
 *   duration_ms?: number,
 *   cache_bytes?: number,
 *   method?: string,
 *   started_at?: string,
 * }} run
 */
export async function logSeedingRun(run) {
  ensureDir();

  const entry = {
    type: "run",
    seeder: run.seeder,
    display_name: run.displayName ?? null,
    source: run.source,
    category: run.category ?? null,
    subcategory: run.subcategory ?? null,
    discovered: run.discovered ?? 0,
    inserted: run.inserted ?? 0,
    skipped: run.skipped ?? 0,
    dead: run.dead ?? 0,
    redirects: run.redirects ?? 0,
    error: run.error ?? null,
    warnings: run.warnings ?? null,
    duration_ms: run.duration_ms ?? null,
    cache_bytes: run.cache_bytes ?? null,
    method: run.method ?? null,
    started_at: run.started_at ?? new Date().toISOString(),
    finished_at: new Date().toISOString(),
  };

  try {
    appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n", "utf8");
    const icon = entry.error ? "❌" : entry.inserted > 0 ? "✅" : "⚠️";
    console.log(`[log-seeding] ${icon} Logged: ${entry.seeder} — in:${entry.inserted} skip:${entry.skipped} dead:${entry.dead}${entry.error ? ` | ${entry.error}` : ""}`);
  } catch (err) {
    console.warn(`[log-seeding] Failed to write log for ${run.seeder}:`, err.message);
  }
}

/**
 * Log a seeder crash/failure to local JSONL file.
 * Use this when a seeder script itself throws an unrecoverable error
 * (e.g. network failure, process crash) rather than returning clean results.
 *
 * @param {{
 *   seeder: string,
 *   displayName?: string,
 *   error: string,
 *   method?: string,
 *   started_at?: string,
 * }} crash
 */
export async function logSeedingCrash(crash) {
  ensureDir();

  const entry = {
    type: "crash",
    seeder: crash.seeder,
    display_name: crash.displayName ?? null,
    source: crash.seeder,
    category: null,
    subcategory: null,
    discovered: 0,
    inserted: 0,
    skipped: 0,
    dead: 0,
    redirects: 0,
    error: crash.error ?? "Unknown crash",
    warnings: null,
    duration_ms: crash.started_at
      ? Date.now() - new Date(crash.started_at).getTime()
      : null,
    cache_bytes: null,
    method: crash.method ?? null,
    started_at: crash.started_at ?? new Date().toISOString(),
    finished_at: new Date().toISOString(),
  };

  try {
    appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n", "utf8");
    console.log(`[log-seeding] 💥 Logged crash: ${entry.seeder} — ${entry.error}`);
  } catch (err) {
    console.warn(`[log-seeding] Failed to write crash log for ${crash.seeder}:`, err.message);
  }
}

/** Read all log entries from the JSONL file, newest first. */
function readLogs() {
  ensureDir();
  if (!existsSync(LOG_FILE)) return [];
  try {
    const raw = readFileSync(LOG_FILE, "utf8");
    const lines = raw.trim().split("\n").filter(Boolean);
    return lines
      .map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean)
      .reverse(); // newest first
  } catch {
    return [];
  }
}

/**
 * Query past seeding runs.
 * @param {{ seeder?: string, limit?: number, days?: number, type?: string }} opts
 */
export async function querySeedingRuns({ seeder = null, limit = 50, days = 7, type = null } = {}) {
  let runs = readLogs();

  if (days > 0) {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    runs = runs.filter((r) => new Date(r.started_at).getTime() >= since);
  }

  if (seeder) {
    runs = runs.filter((r) => r.seeder === seeder);
  }

  if (type) {
    runs = runs.filter((r) => r.type === type);
  }

  return runs.slice(0, limit);
}

/**
 * Get aggregate stats for seeders over a time period.
 * @param {{ days?: number }} opts
 */
export async function getSeedingStats({ days = 7 } = {}) {
  let runs = readLogs();
  if (days > 0) {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    runs = runs.filter((r) => new Date(r.started_at).getTime() >= since);
  }

  // Latest run per seeder
  const latestPerSeeder = new Map();
  for (const r of runs) {
    if (!latestPerSeeder.has(r.seeder)) {
      latestPerSeeder.set(r.seeder, r);
    }
  }

  let totalInserted = 0;
  let totalDead = 0;
  let totalSkipped = 0;
  let seedersWithErrors = 0;
  let seedersWithCrashes = 0;
  let zeroResultSeeders = 0;

  for (const [, row] of latestPerSeeder) {
    totalInserted += row.inserted ?? 0;
    totalDead += row.dead ?? 0;
    totalSkipped += row.skipped ?? 0;
    if (row.type === "crash") seedersWithCrashes++;
    else if (row.error) seedersWithErrors++;
    if ((row.inserted ?? 0) === 0 && (row.skipped ?? 0) === 0) zeroResultSeeders++;
  }

  return {
    totalSeeders: latestPerSeeder.size,
    totalInserted,
    totalDead,
    totalSkipped,
    seedersWithErrors,
    seedersWithCrashes,
    zeroResultSeeders,
    seeders: [...latestPerSeeder.values()],
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && (
  process.argv[1].endsWith("log-seeding.mjs") ||
  process.argv[1].includes("log-seeding")
);

if (isMain) {
  const args = process.argv.slice(2);

  if (args.includes("--list") || args.includes("--tail")) {
    const days = parseInt(args.find(a => a.startsWith("--days="))?.split("=")[1] || "7", 10);
    const limit = args.includes("--tail") ? 20 : 50;
    const data = await querySeedingRuns({ days, limit });
    console.log(`\nRecent seeding runs (${data.length}):\n`);
    for (const r of data) {
      const icon = r.type === "crash" ? "💥" : r.error ? "❌" : (r.inserted ?? 0) > 0 ? "✅" : "⚠️";
      const when = new Date(r.started_at).toLocaleString();
      const methodStr = r.method ? ` [${r.method}]` : "";
      console.log(`${icon} ${(r.seeder || "").padEnd(25)} | ${when}${methodStr} | in:${r.inserted ?? 0} skip:${r.skipped ?? 0} dead:${r.dead ?? 0}${r.error ? ` | ${r.error}` : ""}`);
    }
  } else if (args.includes("--stats")) {
    const days = parseInt(args.find(a => a.startsWith("--days="))?.split("=")[1] || "7", 10);
    const stats = await getSeedingStats({ days });
    console.log(`\nSeeding Stats (last ${days} days):\n`);
    console.log(`  Total seeders:    ${stats.totalSeeders}`);
    console.log(`  Total inserted:   ${stats.totalInserted}`);
    console.log(`  Total skipped:    ${stats.totalSkipped}`);
    console.log(`  Total dead:       ${stats.totalDead}`);
    console.log(`  With errors:      ${stats.seedersWithErrors}`);
    console.log(`  Crashed:          ${stats.seedersWithCrashes}`);
    console.log(`  Zero results:     ${stats.zeroResultSeeders}`);

    // Show zero-result seeders
    if (stats.zeroResultSeeders > 0) {
      console.log(`\n  ⚠️  Seeders with zero results:`);
      for (const s of stats.seeders) {
        if ((s.inserted ?? 0) === 0 && (s.skipped ?? 0) === 0) {
          const icon = s.type === "crash" ? "💥" : "❌";
          console.log(`    ${icon} - ${s.seeder}${s.error ? ` (${s.error})` : ""}`);
        }
      }
    }
  } else if (args.find(a => a.startsWith("--seeder="))) {
    const seeder = args.find(a => a.startsWith("--seeder=")).split("=")[1];
    const data = await querySeedingRuns({ seeder, limit: 10, days: 30 });
    console.log(`\nSeeding runs for ${seeder}:`);
    for (const r of data) {
      const icon = r.type === "crash" ? "💥" : r.error ? "❌" : (r.inserted ?? 0) > 0 ? "✅" : "⚠️";
      const methodStr = r.method ? ` [${r.method}]` : "";
      console.log(`${icon} ${new Date(r.started_at).toISOString()}${methodStr} | in:${r.inserted ?? 0} skip:${r.skipped ?? 0} dead:${r.dead ?? 0}${r.error ? ` | ${r.error}` : ""}`);
    }
  } else {
    console.log("Usage:");
    console.log("  node scripts/log-seeding.mjs --list              # Last 7 days");
    console.log("  node scripts/log-seeding.mjs --list --days=30     # Last 30 days");
    console.log("  node scripts/log-seeding.mjs --tail               # Last 20 runs");
    console.log("  node scripts/log-seeding.mjs --stats              # Aggregate stats");
    console.log("  node scripts/log-seeding.mjs --stats --days=1     # Today only");
    console.log("  node scripts/log-seeding.mjs --seeder=kotaku      # Specific seeder history");
    console.log(`\nLog file: ${LOG_FILE}`);
  }
}