/**
 * master-log.mjs — Master seeder log: when each seeder was last run and results.
 *
 * Reads `scripts/.cache/seeding-runs.jsonl` (local JSONL, no Supabase).
 * Shows the latest run per seeder by default, with rich status indicators.
 *
 * Usage:
 *   node scripts/master-log.mjs                  # Latest run per seeder (default)
 *   node scripts/master-log.mjs --all            # Every logged run
 *   node scripts/master-log.mjs --seeder=wikip.. # Single seeder history
 *   node scripts/master-log.mjs --errors         # Only runs with errors
 *   node scripts/master-log.mjs --crashes        # Only crash entries
 *   node scripts/master-log.mjs --days=7         # Filter to last N days
 *   node scripts/master-log.mjs --json           # Machine-readable output
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_FILE = resolve(__dirname, ".cache", "seeding-runs.jsonl");

// ── Read logs ─────────────────────────────────────────────────────────────────
function readLogs() {
  if (!existsSync(LOG_FILE)) return [];
  try {
    const raw = readFileSync(LOG_FILE, "utf8");
    return raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// ── Status helpers ────────────────────────────────────────────────────────────
function getStatus(row) {
  if (!row) return { emoji: "⬜", label: "no data", color: "gray" };
  if (row.type === "crash") return { emoji: "💥", label: "crash", color: "red" };
  if (row.error) {
    // Check for common HTTP/network error patterns
    if (/40[13]/.test(row.error)) return { emoji: "🔒", label: "blocked", color: "red" };
    if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED/i.test(row.error))
      return { emoji: "🌐", label: "network error", color: "red" };
    if (/timeout/i.test(row.error)) return { emoji: "⏱", label: "timeout", color: "red" };
    return { emoji: "❌", label: "error", color: "red" };
  }

  const inserted = row.inserted ?? 0;
  const dead = row.dead ?? 0;
  const skipped = row.skipped ?? 0;
  const total = inserted + skipped;
  const deadRatio = total > 0 ? dead / (dead + total) : 0;

  if (inserted === 0 && (row.discovered ?? 0) === 0)
    return { emoji: "❌", label: "no urls", color: "red" };
  if (deadRatio > 0.5) return { emoji: "🟡", label: "high dead", color: "yellow" };
  if (inserted < 100) return { emoji: "🟡", label: "low yield", color: "yellow" };
  return { emoji: "✅", label: "healthy", color: "green" };
}

function trendArrow(latest, previous) {
  if (!previous) return "→";
  const curr = latest.inserted ?? 0;
  const prev = previous.inserted ?? 0;
  if (curr > prev * 1.1) return "↑";
  if (curr < prev * 0.9) return "↓";
  return "→";
}

function formatDuration(ms) {
  if (!ms) return "";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m${sec}s`;
}

function formatDate(iso) {
  if (!iso) return "unknown";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function formatCategory(row) {
  if (!row.category && !row.subcategory) return "—";
  const parts = [];
  if (row.category) parts.push(row.category);
  if (row.subcategory) parts.push(row.subcategory);
  return parts.join(" / ");
}

// ── Compute latest per seeder + previous for trend ────────────────────────────
function latestPerSeeder(runs) {
  const map = new Map();
  for (const r of runs) {
    if (!map.has(r.seeder)) {
      map.set(r.seeder, []);
    }
    map.get(r.seeder).push(r);
  }
  const result = [];
  for (const [seeder, entries] of map) {
    entries.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
    result.push({
      seeder,
      display_name: entries[0].display_name ?? null,
      latest: entries[0],
      previous: entries[1] || null,
      all: entries,
    });
  }
  return result;
}

// ── Sorting ───────────────────────────────────────────────────────────────────
function sortSeeders(seeders) {
  const order = { red: 0, yellow: 1, green: 2, gray: 3 };
  seeders.sort(
    (a, b) =>
      order[getStatus(a.latest).color] - order[getStatus(b.latest).color] ||
      a.seeder.localeCompare(b.seeder),
  );
  return seeders;
}

// ── Formatting ────────────────────────────────────────────────────────────────
function padRight(s, len) {
  return (s || "").padEnd(len).slice(0, len);
}

function printTableLine(fields, widths) {
  const parts = fields.map((f, i) => padRight(String(f), widths[i]));
  console.log(`│ ${parts.join(" │ ")} │`);
}

function divider(widths) {
  const parts = widths.map((w) => "─".repeat(w));
  console.log(`├─${parts.join("─┼─")}─┤`);
}

function header(widths) {
  const parts = widths.map((w) => "─".repeat(w));
  console.log(`┌─${parts.join("─┬─")}─┐`);
}

function footer(widths) {
  const parts = widths.map((w) => "─".repeat(w));
  console.log(`└─${parts.join("─┴─")}─┘`);
}

// ── Main output ──────────────────────────────────────────────────────────────
function printTable(seeders) {
  const widths = [28, 38, 14, 16, 12, 10, 10, 10, 10];
  const labels = [
    "Seeder",
    "Category / Subcategory",
    "Method",
    "Last Run",
    "Status",
    "Inserted",
    "Skipped",
    "Dead",
    "Duration",
  ];

  header(widths);
  printTableLine(labels, widths);
  divider(widths);

  for (const row of seeders) {
    const r = row.latest;
    const status = getStatus(r);
    const trend = trendArrow(r, row.previous);
    const fields = [
      padRight(r.seeder || "?", 28),
      padRight(formatCategory(r), 38),
      padRight(r.method || "—", 14),
      padRight(formatDate(r.started_at), 16),
      `${status.emoji} ${status.label}`,
      String(r.inserted ?? 0),
      String(r.skipped ?? 0),
      String(r.dead ?? 0),
      formatDuration(r.duration_ms),
    ];
    printTableLine(fields, widths);
  }

  footer(widths);

  // Summary
  const red = seeders.filter((s) => getStatus(s.latest).color === "red").length;
  const yellow = seeders.filter((s) => getStatus(s.latest).color === "yellow").length;
  const green = seeders.filter((s) => getStatus(s.latest).color === "green").length;
  const gray = seeders.filter((s) => getStatus(s.latest).color === "gray").length;
  console.log(
    `\n${green} healthy | ${yellow} warning | ${red} broken${gray ? ` | ${gray} no data` : ""}`,
  );
}

function printAllRuns(seeders) {
  console.log(`\nAll seeding runs (newest first):\n`);

  for (const row of seeders) {
    for (const r of row.all) {
      const status = getStatus(r);
      const when = formatDate(r.started_at);
      const methodStr = r.method ? ` [${r.method}]` : "";
      const cat = formatCategory(r);
      console.log(
        `${status.emoji} ${padRight(r.seeder || "?", 28)} | ${padRight(when, 16)}${methodStr} | ${padRight(cat, 38)} | in:${String(r.inserted ?? 0).padStart(5)} skip:${String(r.skipped ?? 0).padStart(5)} dead:${String(r.dead ?? 0).padStart(5)} | ${status.label}${r.error ? ` — ${r.error}` : ""}`,
      );
    }
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  const ALL = args.includes("--all");
  const JSON_OUT = args.includes("--json");
  const ERRORS = args.includes("--errors");
  const CRASHES = args.includes("--crashes");
  const SINGLE = args.find((a) => a.startsWith("--seeder="));
  const DAYS = parseInt(
    args.find((a) => a.startsWith("--days="))?.split("=")[1] || "0",
    10,
  );

  let runs = readLogs();

  // Filter by days
  if (DAYS > 0) {
    const since = Date.now() - DAYS * 24 * 60 * 60 * 1000;
    runs = runs.filter((r) => new Date(r.started_at).getTime() >= since);
  }

  // Filter by single seeder
  if (SINGLE) {
    const seeder = SINGLE.split("=")[1];
    runs = runs.filter((r) => r.seeder === seeder);
  }

  // Filter by errors
  if (ERRORS) {
    runs = runs.filter((r) => r.type === "crash" || (r.error && r.error.trim()));
  }

  // Filter by crashes only
  if (CRASHES) {
    runs = runs.filter((r) => r.type === "crash");
  }

  if (runs.length === 0) {
    console.log("No seeding runs logged yet. Run a seeder first.\n");
    console.log(`Log file: ${LOG_FILE}`);
    process.exit(0);
  }

  // Group by seeder
  const seeders = latestPerSeeder(runs);
  sortSeeders(seeders);

  if (JSON_OUT) {
    const output = seeders.map((s) => ({
      seeder: s.seeder,
      display_name: s.display_name,
      latest: s.latest,
      previous: s.previous,
      status: getStatus(s.latest),
      all_runs: s.all,
    }));
    console.log(JSON.stringify(output, null, 2));
  } else if (ALL) {
    printAllRuns(seeders);
  } else {
    console.log(`\nMaster Seeder Log (${seeders.length} seeders)`);
    if (DAYS > 0) console.log(`  (last ${DAYS} days)`);
    if (ERRORS) console.log(`  (errors/crashes only)`);
    if (CRASHES) console.log(`  (crashes only)`);
    console.log("");
    printTable(seeders);
  }

  if (!EXISTS_FILE()) {
    console.log(`\nLog file: ${LOG_FILE}`);
  }
}

function EXISTS_FILE() {
  // small helper to avoid unused variable
  return existsSync(LOG_FILE);
}

// ── Entry point ──────────────────────────────────────────────────────────────
const cliArgs = process.argv.slice(2);

if (cliArgs.length === 0) {
  try { await main(); } catch (e) { console.error(e.message); process.exit(1); }
} else if (cliArgs.includes("--help") || cliArgs.includes("-h")) {
  console.log(`Master Seeder Log — local master log for all seeders.

Reads: scripts/.cache/seeding-runs.jsonl

Usage:
  node scripts/master-log.mjs                  # Latest run per seeder (default)
  node scripts/master-log.mjs --all            # Every logged run
  node scripts/master-log.mjs --seeder=X       # History for a single seeder
  node scripts/master-log.mjs --errors         # Only runs with errors or crashes
  node scripts/master-log.mjs --crashes        # Only crash entries
  node scripts/master-log.mjs --days=7         # Filter to last N days
  node scripts/master-log.mjs --json           # Machine-readable JSON output

Status legend:
  ✅ healthy    — inserted > 0, no errors, low dead ratio
  🟡 low yield  — inserted < 100 (low volume source)
  🟡 high dead  — >50% of attempts were dead/unreachable
  ❌ error      — error field present, zero insertions
  💥 crash      — seeder script crashed (uncaught exception)
  🔒 blocked    — 401/403 from API
  🌐 network    — DNS/connection failure
  ⬜ no data    — no run logged
`);
} else {
  try { await main(); } catch (e) { console.error(e.message); process.exit(1); }
}
