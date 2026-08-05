/**
 * report-seeder-run.mjs — Per-run seeder health report
 *
 * Reads scripts/.cache/seeding-runs.jsonl, filters to today's runs,
 * cross-references with the batch file to find crashed/missing seeders,
 * and outputs a Markdown report.
 *
 * Usage: node scripts/reports/report-seeder-run.mjs [--date=YYYY-MM-DD]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function arg(flag, fallback) {
  const a = args.find((x) => x.startsWith(flag));
  return a ? a.split("=")[1] : fallback;
}
const today = new Date().toISOString().slice(0, 10);
const runDate = arg("--date", today);

const LOG_FILE = resolve(__dirname, "..", ".cache", "seeding-runs.jsonl");
const BATCH_FILE = resolve(__dirname, "..", ".cache", "run-seeders-gaps.bat");

// ── Read logs ───────────────────────────────────────────────────────────────
function readLogs() {
  if (!existsSync(LOG_FILE)) return [];
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
}

// ── Parse batch file for expected seeders ────────────────────────────────────
function parseBatchFile() {
  if (!existsSync(BATCH_FILE)) return [];
  const raw = readFileSync(BATCH_FILE, "utf8");
  const re = /scripts[\\/](seed-[\w-]+)\.mjs/g;
  const seeders = new Set();
  let match;
  while ((match = re.exec(raw)) !== null) {
    seeders.add(match[1].replace(/^seed-/, ""));
  }
  return [...seeders];
}

// ── Categorize ──────────────────────────────────────────────────────────────
function categorize(r) {
  // Crash entries have type: "crash"
  if (r.type === "crash") {
    // Distinguish ECONNRESET/ETIMEDOUT from script errors
    if (r.error && (r.error.includes("ECONNRESET") || r.error.includes("ETIMEDOUT"))) {
      return "NETWORK_CRASH";
    }
    if (r.error && r.error.includes("SyntaxError")) {
      return "SYNTAX_ERROR";
    }
    return "SCRIPT_CRASH";
  }

  const inserted = r.inserted ?? 0;
  const dead = r.dead ?? 0;
  const discovered = r.discovered ?? 0;
  const skipped = r.skipped ?? 0;
  const total = inserted + dead + skipped;

  if (total === 0 && discovered > 0) return "CACHED_NO_INSERT";
  if (inserted === 0 && dead > 0 && total === dead) return "ALL_DEAD";
  if (inserted === 0 && skipped > 0 && total === skipped) return "ALL_SKIPPED";
  if (inserted > 0 && dead > 0 && dead / (inserted + dead) > 0.9) return "DEAD_MAJORITY";
  if (inserted < 5 && inserted > 0) return "LOW_YIELD";
  return "SUCCESS";
}

function categoryLabel(cat) {
  const labels = {
    SUCCESS: "✅ Success",
    CACHED_NO_INSERT: "⏭️ Cached (no new inserts)",
    ALL_DEAD: "💀 All URLs dead",
    ALL_SKIPPED: "⏭️ All skipped (already in DB)",
    DEAD_MAJORITY: "🟡 >90% dead",
    LOW_YIELD: "🟡 Low yield (<5)",
    NETWORK_CRASH: "🔴 Network crash (ECONNRESET/ETIMEDOUT)",
    SCRIPT_CRASH: "🔴 Script crash",
    SYNTAX_ERROR: "🔴 Syntax error in seeder",
    MISSING: "⬛ No log entry (crashed before logging)",
  };
  return labels[cat] || cat;
}

function categoryPriority(cat) {
  const order = {
    MISSING: 0,
    NETWORK_CRASH: 1,
    SYNTAX_ERROR: 2,
    SCRIPT_CRASH: 3,
    ALL_DEAD: 4,
    DEAD_MAJORITY: 5,
    LOW_YIELD: 6,
    ALL_SKIPPED: 7,
    CACHED_NO_INSERT: 8,
    SUCCESS: 9,
  };
  return order[cat] ?? 10;
}

// ── Main ────────────────────────────────────────────────────────────────────
function main() {
  const allRuns = readLogs();

  // Filter to today's runs
  const todayRuns = allRuns.filter((r) => {
    const d = r.started_at ? new Date(r.started_at).toISOString().slice(0, 10) : null;
    return d === runDate;
  });

  // Deduplicate: keep latest run per seeder for today
  const bySeeder = new Map();
  for (const r of todayRuns) {
    const key = r.seeder || "unknown";
    if (!bySeeder.has(key) || new Date(r.started_at) > new Date(bySeeder.get(key).started_at)) {
      bySeeder.set(key, r);
    }
  }

  // Get expected seeders from batch file
  const expectedSeeders = parseBatchFile();
  const encounteredSeeders = new Set(bySeeder.keys());

  // Build result list
  const results = [];

  // 1. Seeders that ran today
  for (const [seeder, r] of bySeeder) {
    const cat = categorize(r);
    results.push({
      seeder,
      category: cat,
      inserted: r.inserted ?? 0,
      dead: r.dead ?? 0,
      skipped: r.skipped ?? 0,
      discovered: r.discovered ?? 0,
      method: r.method || "unknown",
      error: r.error || null,
      duration_ms: r.duration_ms || 0,
    });
  }

  // 2. Seeders expected but missing from logs
  for (const seeder of expectedSeeders) {
    if (!encounteredSeeders.has(seeder)) {
      results.push({
        seeder,
        category: "MISSING",
        inserted: 0,
        dead: 0,
        skipped: 0,
        discovered: 0,
        method: "n/a",
        error: "No log entry — process likely killed by ECONNRESET before logging",
        duration_ms: 0,
      });
    }
  }

  // Sort by category priority (worst first)
  results.sort((a, b) => categoryPriority(a.category) - categoryPriority(b.category) || a.seeder.localeCompare(b.seeder));

  // ── Generate Markdown ──────────────────────────────────────────────────
  const lines = [];
  lines.push(`# Seeder Run Report — ${runDate}`);
  lines.push("");
  lines.push(`**Generated:** ${new Date().toISOString().replace("T", " ").slice(0, 19)}`);
  lines.push(`**Log entries:** ${todayRuns.length} (${bySeeder.size} unique seeders)`);
  lines.push(`**Expected from batch:** ${expectedSeeders.length}`);
  lines.push(`**Missing:** ${results.filter((r) => r.category === "MISSING").length}`);
  lines.push(`**Crashed:** ${results.filter((r) => r.category === "NETWORK_CRASH" || r.category === "SCRIPT_CRASH" || r.category === "SYNTAX_ERROR").length}`);
  lines.push(`**Zero/low yield:** ${results.filter((r) => ["ALL_DEAD", "DEAD_MAJORITY", "ALL_SKIPPED", "LOW_YIELD", "CACHED_NO_INSERT"].includes(r.category)).length}`);
  lines.push(`**Successful:** ${results.filter((r) => r.category === "SUCCESS").length}`);
  lines.push("");

  // Summary table
  lines.push("## Summary by Category");
  lines.push("");
  lines.push("| Category | Count | Description |");
  lines.push("|----------|-------|-------------|");
  const categoryCounts = {};
  for (const r of results) {
    categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
  }
  for (const [cat, count] of Object.entries(categoryCounts)) {
    lines.push(`| ${categoryLabel(cat)} | ${count} | |`);
  }
  lines.push(`| **TOTAL** | **${results.length}** | |`);
  lines.push("");

  // Detail table
  lines.push("## All Seeders (worst first)");
  lines.push("");
  lines.push("| # | Status | Seeder | Ins | Dead | Skip | Method | Issue |");
  lines.push("|---|--------|--------|-----|------|------|--------|-------|");

  let i = 1;
  let totalIns = 0;
  let totalDead = 0;

  for (const r of results) {
    totalIns += r.inserted;
    totalDead += r.dead;

    let issue = "";
    if (r.category === "MISSING" || r.category === "NETWORK_CRASH") {
      issue = r.error ? r.error.slice(0, 80) : "Unknown";
    } else if (r.category === "SYNTAX_ERROR") {
      issue = r.error ? r.error.split("\n")[0].slice(0, 80) : "Syntax error";
    } else if (r.category === "SCRIPT_CRASH") {
      issue = r.error ? r.error.slice(0, 60) : "Crashed";
    } else if (r.category === "ALL_DEAD" || r.category === "DEAD_MAJORITY") {
      const pct = r.dead + r.inserted > 0 ? Math.round((r.dead / (r.dead + r.inserted)) * 100) : 0;
      issue = `${pct}% dead — likely blocked by site`;
    }

    lines.push(`| ${i} | ${categoryLabel(r.category)} | \`${r.seeder}\` | ${r.inserted} | ${r.dead} | ${r.skipped} | ${r.method} | ${issue} |`);
    i++;
  }

  lines.push("");
  lines.push("## Totals");
  lines.push("");
  lines.push(`- **Inserted:** ${totalIns}`);
  lines.push(`- **Dead:** ${totalDead}`);
  lines.push(`- **Successful seeders:** ${results.filter((r) => r.category === "SUCCESS").length} / ${results.length}`);
  lines.push("");

  // Recommendations
  lines.push("## Recommendations");
  lines.push("");

  const missing = results.filter((r) => r.category === "MISSING");
  const deadMaj = results.filter((r) => r.category === "ALL_DEAD" || r.category === "DEAD_MAJORITY");
  const syntax = results.filter((r) => r.category === "SYNTAX_ERROR");

  if (missing.length > 0) {
    lines.push(`### 🔴 ${missing.length} Seeders Crashed Before Logging`);
    lines.push("");
    lines.push("These 54 seeders were launched all at once via `start` commands. The ECONNRESET + ETIMEDOUT errors suggest:");
    lines.push("1. **Supabase connection pool exhaustion** — too many concurrent upserts");
    lines.push("2. **Network socket exhaustion** — Windows `cmd.exe` spawning too many child processes");
    lines.push("3. **CDX API rate limiting** — Wayback CDX rejects when too many queries hit simultaneously");
    lines.push("");
    lines.push("**Fix:** Re-run in smaller batches (5–10 at a time) with a delay between groups. Or use the sequential runner below:");
    lines.push("");
    lines.push("```bat");
    lines.push("@echo off");
    lines.push("cd /d c:\\Users\\Seito\\Github\\roam");
    for (const r of missing.slice(0, 10)) {
      lines.push(`echo Running ${r.seeder}...`);
      lines.push(`node scripts/seed-${r.seeder}.mjs`);
      lines.push(`timeout /t 10 /nobreak >nul`);
    }
    if (missing.length > 10) {
      lines.push(`echo ... and ${missing.length - 10} more`);
    }
    lines.push("```");
    lines.push("");
  }

  if (deadMaj.length > 0) {
    lines.push(`### 🟡 ${deadMaj.length} Seeders With High Dead URL Rates`);
    lines.push("");
    lines.push("These sites may be blocking Wayback Machine fetches or have changed their URL structure:");
    lines.push("");
    for (const r of deadMaj) {
      lines.push(`- \`${r.seeder}\` — ${r.inserted} inserted, ${r.dead} dead (${r.method})`);
    }
    lines.push("");
    lines.push("**Fix:** These seeders may need to switch from `wayback-cdx` to `sitemap` or `headless` methods, or find alternative sources.");
    lines.push("");
  }

  if (syntax.length > 0) {
    lines.push(`### 🔴 ${syntax.length} Seeders With Syntax Errors`);
    lines.push("");
    lines.push("These have JavaScript syntax errors and need code fixes:");
    lines.push("");
    for (const r of syntax) {
      lines.push(`- \`seed-${r.seeder}.mjs\``);
    }
    lines.push("");
  }

  // Write file
  const outDir = resolve(__dirname, "output");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `SEEDER_RUN_${runDate}.md`);
  writeFileSync(outPath, lines.join("\n"), "utf8");

  // Also print to console
  console.log(lines.join("\n"));
  console.log(`\n📄 Report written to: ${outPath}`);
}

main();