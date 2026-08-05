/**
 * audit-seeders.mjs — Local seeder health dashboard
 *
 * Reads scripts/.cache/seeding-runs.jsonl and produces health reports.
 * No Supabase queries — pure local reads.
 *
 * Usage:
 *   node scripts/audit-seeders.mjs --health       Color-coded health per seeder
 *   node scripts/audit-seeders.mjs --worst 10     Bottom N by insertion count
 *   node scripts/audit-seeders.mjs --stale 30     Seeders not run in N days
 *   node scripts/audit-seeders.mjs --report       Markdown report to stdout
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_FILE = resolve(__dirname, ".cache", "seeding-runs.jsonl");

function readLogs() {
  if (!existsSync(LOG_FILE)) return [];
  try {
    const raw = readFileSync(LOG_FILE, "utf8");
    return raw.trim().split("\n").filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Return the latest run object per seeder.
 * Also attaches second-latest for trend comparison.
 */
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
      latest: entries[0],
      previous: entries[1] || null,
    });
  }
  return result;
}

function healthEmoji(row) {
  const r = row.latest;
  if (!r) return { emoji: "⬜", status: "GRAY", label: "no data" };

  const inserted = r.inserted ?? 0;
  const discovered = r.discovered ?? 0;
  const dead = r.dead ?? 0;
  const total = inserted + (r.skipped ?? 0);
  const deadRatio = total > 0 ? dead / (dead + total) : 0;
  const hasError = !!r.error;

  if (inserted === 0 && hasError) return { emoji: "❌", status: "RED", label: "error" };
  if (inserted === 0 && discovered === 0) return { emoji: "❌", status: "RED", label: "no urls" };
  if (inserted < 100) return { emoji: "🟡", status: "YELLOW", label: "low yield" };
  if (deadRatio > 0.5) return { emoji: "🟡", status: "YELLOW", label: "high dead" };
  return { emoji: "✅", status: "GREEN", label: "healthy" };
}

function trendArrow(row) {
  if (!row.previous) return "  ";
  const curr = row.latest.inserted ?? 0;
  const prev = row.previous.inserted ?? 0;
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

// ── CLI ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

function parseIntArg(prefix, fallback) {
  const a = args.find(x => x.startsWith(prefix));
  if (!a) return fallback;
  const val = parseInt(a.split("=")[1] || a.split(" ")[1], 10);
  return isNaN(val) ? fallback : val;
}

if (args.includes("--health")) {
  const runs = readLogs();
  if (!runs.length) {
    console.log("No seeding runs logged yet. Run a seeder first.");
    process.exit(0);
  }
  const seeders = latestPerSeeder(runs);
  console.log(`\nSeeder Health (${seeders.length} seeders):\n`);

  // Sort: RED first, then YELLOW, then GREEN, then GRAY
  const order = { RED: 0, YELLOW: 1, GREEN: 2, GRAY: 3 };
  seeders.sort((a, b) => (order[healthEmoji(a).status] - order[healthEmoji(b).status]) || a.seeder.localeCompare(b.seeder));

  for (const row of seeders) {
    const h = healthEmoji(row);
    const trend = trendArrow(row);
    const r = row.latest;
    const seeder = (r.seeder || "").padEnd(28);
    const dur = formatDuration(r.duration_ms);
    const when = r.started_at ? new Date(r.started_at).toLocaleDateString() : "unknown";
    const method = r.method ? ` [${r.method}]` : "";
    console.log(`${h.emoji}${trend} ${seeder} | in:${String(r.inserted ?? 0).padStart(5)} skip:${String(r.skipped ?? 0).padStart(5)} dead:${String(r.dead ?? 0).padStart(5)} | ${dur.padEnd(5)} | ${when}${method}${h.label !== "healthy" ? ` (${h.label})` : ""}`);
  }

  // Summary counts
  const red = seeders.filter(s => healthEmoji(s).status === "RED").length;
  const yellow = seeders.filter(s => healthEmoji(s).status === "YELLOW").length;
  const green = seeders.filter(s => healthEmoji(s).status === "GREEN").length;
  console.log(`\n${green} healthy | ${yellow} warning | ${red} broken`);

} else if (args.includes("--worst")) {
  const n = parseIntArg("--worst", 10);
  const runs = readLogs();
  const seeders = latestPerSeeder(runs);
  seeders.sort((a, b) => (a.latest.inserted ?? 0) - (b.latest.inserted ?? 0));
  console.log(`\nWorst ${Math.min(n, seeders.length)} seeders (by insertion count):\n`);
  for (let i = 0; i < Math.min(n, seeders.length); i++) {
    const row = seeders[i];
    const r = row.latest;
    const h = healthEmoji(row);
    console.log(`${h.emoji} ${(r.seeder || "").padEnd(28)} | in:${String(r.inserted ?? 0).padStart(5)} skip:${String(r.skipped ?? 0).padStart(5)} dead:${String(r.dead ?? 0).padStart(5)} | ${r.started_at ? new Date(r.started_at).toLocaleDateString() : "unknown"}`);
  }

} else if (args.includes("--stale")) {
  const maxDays = parseIntArg("--stale", 30);
  const runs = readLogs();
  const seeders = latestPerSeeder(runs);
  const cutoff = Date.now() - maxDays * 86400000;
  const stale = seeders.filter(s => {
    const d = s.latest?.started_at ? new Date(s.latest.started_at).getTime() : 0;
    return d < cutoff;
  });
  stale.sort((a, b) => (new Date(a.latest?.started_at || 0) - new Date(b.latest?.started_at || 0)));
  console.log(`\nSeeders not run in ${maxDays}+ days (${stale.length}):\n`);
  for (const row of stale) {
    const r = row.latest;
    const daysAgo = r?.started_at ? Math.round((Date.now() - new Date(r.started_at).getTime()) / 86400000) : Infinity;
    console.log(`⬜ ${(r.seeder || "").padEnd(28)} | last run: ${daysAgo}d ago | in:${r.inserted ?? 0}`);
  }
  if (!stale.length) console.log("  None. All seeders have run recently.");

} else if (args.includes("--report")) {
  const runs = readLogs();
  const seeders = latestPerSeeder(runs);
  const order = { RED: 0, YELLOW: 1, GREEN: 2, GRAY: 3 };
  seeders.sort((a, b) => (order[healthEmoji(a).status] - order[healthEmoji(b).status]) || a.seeder.localeCompare(b.seeder));

  const red = seeders.filter(s => healthEmoji(s).status === "RED");
  const yellow = seeders.filter(s => healthEmoji(s).status === "YELLOW");
  const green = seeders.filter(s => healthEmoji(s).status === "GREEN");

  console.log(`# Seeder Health Report\n`);
  console.log(`**Generated:** ${new Date().toISOString().slice(0, 10)}\n`);
  console.log(`| Status | Trend | Seeder | Inserted | Skipped | Dead | Method | Last Run | Issue |`);
  console.log(`|--------|-------|--------|----------|---------|------|--------|----------|-------|`);

  for (const row of seeders) {
    const h = healthEmoji(row);
    const trend = trendArrow(row);
    const r = row.latest;
    const when = r.started_at ? new Date(r.started_at).toLocaleDateString() : "unknown";
    console.log(`| ${h.emoji} | ${trend} | ${r.seeder || "?"} | ${r.inserted ?? 0} | ${r.skipped ?? 0} | ${r.dead ?? 0} | ${r.method || "?"} | ${when} | ${h.label !== "healthy" ? h.label : ""} |`);
  }

  console.log(`\n## Summary\n`);
  console.log(`- ${green.length} healthy (✅)`);
  console.log(`- ${yellow.length} warning (🟡)`);
  console.log(`- ${red.length} broken (❌)`);

  if (red.length > 0) {
    console.log(`\n## Broken Seeders\n`);
    for (const row of red) {
      const r = row.latest;
      console.log(`- **${r.seeder}** — ${r.error || "no URLs discovered"} (last run: ${r.started_at ? new Date(r.started_at).toLocaleDateString() : "unknown"})`);
    }
  }

} else {
  console.log("Usage:");
  console.log("  node scripts/audit-seeders.mjs --health       Health dashboard");
  console.log("  node scripts/audit-seeders.mjs --worst 10     Bottom N by insertions");
  console.log("  node scripts/audit-seeders.mjs --stale 30     Not run in N days");
  console.log("  node scripts/audit-seeders.mjs --report       Markdown report");
  console.log(`\nLog source: ${LOG_FILE}`);
  console.log(`Entries: ${readLogs().length} runs logged`);
}