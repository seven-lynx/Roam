/**
 * flush-seeders.mjs — Master flush script
 *
 * Steps:
 *   1. Commit all pending dead-link check results (mark inactive=true)
 *   2. Delete all inactive URLs from the DB
 *   3. Run all seeders with existing caches to push URLs to DB
 *   4. Run list-seeders.mjs to get final totals
 *
 * Usage:
 *   node scripts/flush-seeders.mjs [--dry-run] [--step delete|commit-dead|flush|list]
 */

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from "fs";
import { execSync } from "child_process";
import { config as dotenvConfig } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "../.env") });

import { createClient } from "@supabase/supabase-js";
import { logSeedingCrash } from "./log-seeding.mjs";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const CACHE_DIR = resolve(__dirname, ".cache");
const DRY_RUN = process.argv.includes("--dry-run");
const STEP = (() => {
  const i = process.argv.indexOf("--step");
  return i >= 0 ? process.argv[i + 1] : null;
})();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Step 1: Commit pending dead-link results ────────────────────────────────
async function commitDeadLinks() {
  console.log("\n═══ Step 1: Commit pending dead-link results ═══");

  const resultsFile = resolve(CACHE_DIR, "dead-links-results.jsonl");
  const commitProgressFile = resolve(CACHE_DIR, "dead-links-commit-progress.json");

  if (!existsSync(resultsFile)) {
    console.log("  No dead-links-results.jsonl found — skipping");
    return;
  }

  let commitProgress = { resultsOffset: 0, langOffset: 0 };
  if (existsSync(commitProgressFile)) {
    commitProgress = JSON.parse(readFileSync(commitProgressFile, "utf8"));
  }

  console.log(`  Reading results.jsonl...`);
  const allLines = readFileSync(resultsFile, "utf8").trim().split("\n").filter(Boolean);
  const total = allLines.length;

  const remaining = allLines.slice(commitProgress.resultsOffset);
  console.log(`  Total: ${total}, Already committed: ${commitProgress.resultsOffset}, Remaining: ${remaining.length}`);

  if (remaining.length === 0) {
    console.log("  All results already committed.");
    return;
  }

  // Parse remaining results
  const dead = [];
  const redirect = [];
  for (const line of remaining) {
    try {
      const r = JSON.parse(line);
      if (r.dead) dead.push(r.urlId);
      else if (r.redirect && r.newUrl) redirect.push({ urlId: r.urlId, newUrl: r.newUrl });
    } catch { /* skip */ }
  }

  console.log(`  Dead to mark inactive: ${dead.length}`);
  console.log(`  Redirects to fix: ${redirect.length}`);

  if (DRY_RUN) {
    console.log("  [DRY RUN] Would mark", dead.length, "as inactive and fix", redirect.length, "redirects");
    return;
  }

  // Mark dead as inactive in batches
  const BATCH = 500;
  for (let i = 0; i < dead.length; i += BATCH) {
    const batch = dead.slice(i, i + BATCH);
    const { error } = await supabase
      .from("urls")
      .update({ inactive: true })
      .in("id", batch);
    if (error) {
      console.error(`  Error marking dead batch ${Math.floor(i / BATCH) + 1}:`, error.message);
    } else {
      process.stdout.write(`\r  Marked inactive: ${Math.min(i + BATCH, dead.length)}/${dead.length}`);
    }
  }
  console.log("");

  // Fix redirects in batches
  for (let i = 0; i < redirect.length; i += BATCH) {
    const batch = redirect.slice(i, i + BATCH);
    for (const { urlId, newUrl } of batch) {
      const { error } = await supabase
        .from("urls")
        .update({ url: newUrl })
        .eq("id", urlId);
      if (error) console.error(`  Error fixing redirect ${urlId}:`, error.message);
    }
    process.stdout.write(`\r  Fixed redirects: ${Math.min(i + BATCH, redirect.length)}/${redirect.length}`);
  }
  console.log("");

  // Save commit progress
  commitProgress.resultsOffset = total;
  writeFileSync(commitProgressFile, JSON.stringify(commitProgress));
  console.log("  Commit progress saved.");
}

// ── Step 2: Delete all inactive URLs ─────────────────────────────────────────
async function deleteInactive() {
  console.log("\n═══ Step 2: Delete all inactive URLs ═══");

  // Count inactive
  const { count, error: countErr } = await supabase
    .from("urls")
    .select("id", { count: "exact", head: true })
    .eq("inactive", true);

  if (countErr) {
    console.error("  Error counting inactive:", JSON.stringify(countErr));
    // Fall back to estimating from dead-links results
    console.log("  Falling back to batch delete approach...");
  }

  const knownCount = countErr ? null : count;
  if (knownCount === 0) {
    console.log("  Nothing to delete.");
    return;
  }

  console.log(`  Inactive URLs in DB: ${knownCount ?? "unknown (query timed out)"}`);

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would delete inactive URLs`);
    return;
  }

  // Batch delete to avoid statement timeouts on very large tables
  let totalDeleted = 0;
  while (true) {
    // Fetch batch of inactive IDs
    const { data: batch, error: fetchErr } = await supabase
      .from("urls")
      .select("id")
      .eq("inactive", true)
      .limit(500);

    if (fetchErr) {
      console.error(`  Error fetching batch: ${fetchErr.message}`);
      break;
    }

    if (!batch || batch.length === 0) {
      console.log(`  No more inactive URLs.`);
      break;
    }

    const ids = batch.map((r) => r.id);
    const { error: delErr } = await supabase
      .from("urls")
      .delete()
      .in("id", ids);

    if (delErr) {
      console.error(`  Error deleting batch: ${delErr.message}`);
      break;
    }

    totalDeleted += ids.length;
    process.stdout.write(`\r  Deleted ${totalDeleted} inactive URLs...`);
  }
  console.log(`\n  Done. Total deleted: ${totalDeleted}`);
}

// ── Step 3: Flush all cached seeders ──────────────────────────────────────────
async function flushCachedSeeders() {
  console.log("\n═══ Step 3: Flush cached seeder data to DB ═══");

  if (!existsSync(CACHE_DIR)) {
    console.log("  No .cache directory found.");
    return;
  }

  // Find all seeder scripts
  const scriptsDir = __dirname;
  const seederScripts = readdirSync(scriptsDir)
    .filter((f) => f.startsWith("seed-") && (f.endsWith(".mjs") || f.endsWith(".js")));

  // ── Pre-scan: which seeders actually have populated caches? ──
  const pendingSeeders = [];
  for (const script of seederScripts) {
    const cacheFile = script
      .replace(/^seed-/, "")
      .replace(/\.mjs$/, "")
      .replace(/\.js$/, "") + ".json";
    const cachePath = resolve(CACHE_DIR, cacheFile);

    if (!existsSync(cachePath)) continue;

    let cache;
    try {
      cache = JSON.parse(readFileSync(cachePath, "utf8"));
    } catch {
      continue;
    }

    const hasDiscovered = cache.discovered && Array.isArray(cache.discovered) && cache.discovered.length > 0;
    const hasFetched = cache.fetched && typeof cache.fetched === "object" && Object.keys(cache.fetched).length > 0;

    if (hasDiscovered || hasFetched) {
      const pending = (hasDiscovered ? cache.discovered.length : 0) +
        (hasFetched ? Object.keys(cache.fetched).length : 0);
      pendingSeeders.push({ script, cachePath, pending });
    }
  }

  const total = pendingSeeders.length;
  const skipped = seederScripts.length - total;
  console.log(`  Total seeders: ${seederScripts.length} | With cached data: ${total} | Skipped (no/empty cache): ${skipped}`);

  if (total === 0) {
    console.log("  No seeders with cached data to flush.");
    return;
  }

  let flushed = 0;
  let errors = 0;
  let completed = 0;
  let totalMs = 0;
  const overallStart = Date.now();

  const fmtETA = (msRemaining) => {
    if (msRemaining <= 0) return "imminent";
    const etaDate = new Date(Date.now() + msRemaining);
    const h = etaDate.getHours();
    const m = etaDate.getMinutes().toString().padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    const mins = Math.ceil(msRemaining / 60000);
    return `${h12}:${m} ${ampm} (~${mins} min remaining)`;
  };

  const fmtDuration = (ms) => {
    if (ms < 1000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const min = Math.floor(ms / 60000);
    const sec = Math.round((ms % 60000) / 1000);
    return `${min}m ${sec}s`;
  };

  for (let i = 0; i < pendingSeeders.length; i++) {
    const { script, pending } = pendingSeeders[i];
    const idx = i + 1;
    const pct = Math.round((completed / total) * 100);

    if (DRY_RUN) {
      console.log(`  [${idx}/${total}] (${pct}%) [DRY RUN] Would run: node scripts/${script} (cache: ${pending} entries)`);
      flushed++;
      completed++;
      continue;
    }

    const startedAt = new Date().toISOString();
    const t0 = Date.now();
    try {
      execSync(`node "${resolve(scriptsDir, script)}"`, {
        cwd: resolve(__dirname, ".."),
        stdio: "pipe",
        timeout: 30 * 60 * 1000, // 30 min timeout
      });
      const elapsed = Date.now() - t0;
      totalMs += elapsed;
      completed++;
      flushed++;

      const avgMs = totalMs / completed;
      const remaining = total - completed;
      const remainingMs = remaining * avgMs;

      let etaStr = "calculating...";
      if (completed >= 2) {
        etaStr = fmtETA(remainingMs);
      }

      console.log(`  [${idx}/${total}] (${pct}%) ✓ ${script} (${fmtDuration(elapsed)}) | avg: ${fmtDuration(avgMs)} | ETA: ${etaStr}`);
    } catch (err) {
      const elapsed = Date.now() - t0;
      totalMs += elapsed;
      completed++;
      errors++;

      const avgMs = totalMs / completed;
      const remaining = total - completed;
      const remainingMs = remaining * avgMs;

      let etaStr = "calculating...";
      if (completed >= 2) {
        etaStr = fmtETA(remainingMs);
      }

      console.error(`  [${idx}/${total}] (${pct}%) ✗ ${script} FAILED (${fmtDuration(elapsed)}) | avg: ${fmtDuration(avgMs)} | ETA: ${etaStr}`);
      // Log the crash to the master log
      const seederName = script.replace(/^seed-/, "").replace(/\.(mjs|js)$/, "");
      logSeedingCrash({
        seeder: seederName,
        displayName: script,
        error: err.message || "Unknown error",
        started_at: startedAt,
      }).catch(() => { /* ignore log failures */ });
    }

    // Brief pause between seeders
    await sleep(1000);
  }

  const overallElapsed = fmtDuration(Date.now() - overallStart);
  console.log(`\n  Done. Flushed: ${flushed}, Skipped (no/empty cache): ${skipped}, Errors: ${errors} | Total time: ${overallElapsed}`);
}

// ── Step 4: Run master list ──────────────────────────────────────────────────
async function runMasterList() {
  console.log("\n═══ Step 4: Run master list ═══");
  try {
    execSync(`node "${resolve(__dirname, "list-seeders.mjs")}"`, {
      cwd: resolve(__dirname, ".."),
      stdio: "inherit",
    });
  } catch (err) {
    console.error("  Error running list-seeders.mjs:", err.message);
  }
}

// ── Step 0: Pre-flight validation ──────────────────────────────────────────
async function validateSeeders() {
  console.log("\n═══ Step 0: Pre-flight validation ═══");
  try {
    execSync(`node "${resolve(__dirname, "validate-seeders.mjs")}"`, {
      cwd: resolve(__dirname, ".."),
      stdio: "inherit",
    });
    console.log("  ✅ All seeders validated.");
    return true;
  } catch (err) {
    console.error("  ❌ Validation failed. Fix the issues above before running seeders.");
    return false;
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Roam Seeder Flush Tool");
  console.log(DRY_RUN ? "  [DRY RUN MODE — no DB writes]" : "  [LIVE MODE — will modify DB]");

  // Validate before doing anything (unless bypassed)
  if (!process.argv.includes("--skip-validate")) {
    const valid = await validateSeeders();
    if (!valid) {
      console.log("\n🛑 Aborted: seeder validation failed.");
      console.log("   Fix violations, or re-run with --skip-validate to bypass.");
      process.exit(1);
    }
  } else {
    console.log("  ⚠️  Skipping pre-flight validation (--skip-validate)");
  }

  if (STEP === "commit-dead" || !STEP) {
    await commitDeadLinks();
  }
  if (STEP === "delete" || !STEP) {
    await deleteInactive();
  }
  if (STEP === "flush" || !STEP) {
    await flushCachedSeeders();
  }
  if (STEP === "list" || !STEP) {
    await runMasterList();
  }

  console.log("\nDone.");
}

main().catch(console.error);