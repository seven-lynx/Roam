#!/usr/bin/env node
/**
 * run-suite.mjs — Master orchestrator for all Roam reports.
 * Supports --offline mode for local SQLite reporting.
 */

import { resolve } from "path";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import {
  REGISTRY, readCheckpoint, writeCheckpoint, writeOutput,
  printBanner, initDB, isOffline,
} from "./lib/report-utils.js";

// ── Import all reports ──────────────────────────────────────────────────────
async function loadReports() {
  const reportFiles = [
    "./report-a1-pool-overview.mjs", "./report-a2-category-matrix.mjs",
    "./report-a3-subcategory-deep.mjs", "./report-a4-source-contribution.mjs",
    "./report-a5-wilson-histogram.mjs", "./report-a6-zero-vote-gaps.mjs",
    "./report-a7-language-gaps.mjs", "./report-a8-age-distribution.mjs",
    "./report-a9-category-source-cross.mjs", "./report-a10-interest-coverage.mjs",
    "./report-b1-dead-by-category.mjs", "./report-b2-dead-by-seeder.mjs",
    "./report-b3-untagged-urls.mjs", "./report-b4-duplicate-urls.mjs",
    "./report-b5-paywall-coverage.mjs", "./report-b6-missing-og.mjs",
    "./report-c1-pending-aging.mjs", "./report-c2-reviewer-activity.mjs",
    "./report-c3-submission-quality.mjs", "./report-c4-safe-browsing.mjs",
    "./report-d1-user-growth.mjs", "./report-d2-retention.mjs",
    "./report-d3-dwell-distribution.mjs", "./report-d4-skip-by-category.mjs",
    "./report-d5-power-users.mjs", "./report-d6-interest-health.mjs",
    "./report-e1-badge-distribution.mjs", "./report-e2-xp-economy.mjs",
    "./report-e3-level-distribution.mjs", "./report-e4-streak-health.mjs",
    "./report-f1-follow-graph.mjs", "./report-f2-activity-health.mjs",
    "./report-f3-sharing-stats.mjs", "./report-g1-notification-delivery.mjs",
  ];
  for (const f of reportFiles) {
    try { await import(f); } catch (err) {
      if (err.code !== "ERR_MODULE_NOT_FOUND") console.warn(`  ⚠ ${f}: ${err.message}`);
    }
  }
}

const SUITES = {
  A: { label: "Content Inventory & Coverage", reports: ["a1","a2","a3","a4","a5","a6","a7","a8","a9","a10"] },
  B: { label: "Content Health", reports: ["b1","b2","b3","b4","b5","b6"] },
  C: { label: "Moderation & Queue", reports: ["c1","c2","c3","c4"] },
  D: { label: "User & Engagement", reports: ["d1","d2","d3","d4","d5","d6"] },
  E: { label: "Gamification", reports: ["e1","e2","e3","e4"] },
  F: { label: "Social & Activity", reports: ["f1","f2","f3"] },
  G: { label: "Notifications & Email", reports: ["g1","g2","g3"] },
  H: { label: "Infrastructure", reports: ["h1","h2","h3","h4"] },
  I: { label: "Business Summaries", reports: ["i1","i2","i3"] },
};
const ALIASES = { weekly: ["A","B","C"], monthly: ["A","B","C","D","E","F","G","H","I"], all: ["A","B","C","D","E","F","G","H","I"] };

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { suites: [], reportIds: [], resume: false, outputDir: null, list: false, offline: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--suite" || a === "-s") { const v = args[++i]; opts.suites.push(...(ALIASES[v] || [v])); }
    else if (a.startsWith("--suite=")) { const v = a.split("=")[1]; opts.suites.push(...(ALIASES[v] || [v])); }
    else if (a === "--report" || a === "-r") { opts.reportIds.push(...args[++i].split(",")); }
    else if (a.startsWith("--report=")) { opts.reportIds.push(...a.split("=")[1].split(",")); }
    else if (a === "--resume") opts.resume = true;
    else if (a === "--offline") opts.offline = true;
    else if (a === "--output" || a === "-o") { opts.outputDir = args[++i]; }
    else if (a.startsWith("--output=")) { opts.outputDir = a.split("=")[1]; }
    else if (a === "--list" || a === "-l") opts.list = true;
  }
  if (!opts.suites.length && !opts.reportIds.length && !opts.list) opts.suites = ALIASES.all;
  return opts;
}

async function main() {
  await loadReports();
  const opts = parseArgs();

  // Initialize DB backend
  const mode = opts.offline ? "offline" : "supabase";
  console.log(`Mode: ${mode}`);
  try { initDB(mode); } catch (err) { console.error(`Failed: ${err.message}`); process.exit(1); }
  console.log("Connected.\n");

  if (opts.list) {
    console.log("\nRegistered Reports:\n");
    for (const suite of Object.keys(SUITES).sort()) {
      console.log(`  Suite ${suite}: ${SUITES[suite].label}`);
      for (const r of REGISTRY.filter(r => SUITES[suite].reports.includes(r.id)))
        console.log(`    ${r.id.padEnd(6)} ${r.title.padEnd(50)} ~${r.etaSeconds}s`);
    }
    console.log(`\nTotal: ${REGISTRY.length} reports\n`);
    return;
  }

  let toRun = [];
  if (opts.reportIds.length) { toRun = REGISTRY.filter(r => opts.reportIds.includes(r.id)); }
  else { for (const s of [...new Set(opts.suites)]) { const d = SUITES[s]; if (d) toRun.push(...REGISTRY.filter(r => d.reports.includes(r.id))); } }
  const seen = new Set(); toRun = toRun.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
  if (!toRun.length) { console.log("No reports to run. Use --list."); return; }

  if (opts.resume) { let s = 0; toRun = toRun.filter(r => { const cp = readCheckpoint(r.id); if (cp?.status === "completed") { console.log(`⏭  ${r.id} — skipped`); s++; return false; } return true; }); if (s) console.log(`  Skipped ${s} completed.\n`); }

  const outputDir = opts.outputDir || resolve(import.meta.dirname, "output");
  const globalStart = Date.now();
  const totalEta = toRun.reduce((s, r) => s + (r.etaSeconds || 2), 0);
  const results = [];

  const suiteOrder = [...new Set(toRun.map(r => r.suite))].sort();
  for (const suite of suiteOrder) {
    const sr = toRun.filter(r => r.suite === suite);
    if (!sr.length) continue;
    printBanner(suite, SUITES[suite]?.label || suite);
    for (let i = 0; i < sr.length; i++) {
      const report = sr[i]; const idx = results.length + 1;
      console.log(`\n[${idx}/${toRun.length}] ${report.id}: ${report.title}`);
      console.log(`  Suite ${suite}: ${i + 1}/${sr.length}`);
      const remaining = Math.max(0, totalEta - (Date.now() - globalStart) / 1000);
      console.log(`  ETA: ~${report.etaSeconds}s | Remaining: ~${remaining.toFixed(0)}s\n`);
      const t0 = Date.now(); writeCheckpoint(report.id, { status: "running" });
      let md = ""; try { md = await report.run(); } catch (err) { md = `## ${report.title}\n\n**❌ Error:** ${err.message}\n`; console.error(`  ❌ ${err.message}`); }
      const elapsed = Date.now() - t0;
      results.push({ id: report.id, title: report.title, suite, markdown: md, elapsed });
      writeCheckpoint(report.id, { status: "completed", elapsedMs: elapsed });
      writeOutput(report.id, md, outputDir);
    }
  }

  const totalElapsed = ((Date.now() - globalStart) / 1000).toFixed(1);
  const combinedPath = resolve(outputDir, "FULL_REPORT.md");
  let toc = `# Roam Complete Report\n\n**Generated:** ${new Date().toISOString()}\n**Mode:** ${mode}\n**Reports run:** ${results.length} | **Total time:** ${totalElapsed}s\n\n## Table of Contents\n\n`;
  const body = [];
  for (const r of results) {
    toc += `- [${r.id}] ${r.title} (${(r.elapsed / 1000).toFixed(1)}s)\n`;
    body.push(`\n\n## ${r.id}: ${r.title}\n\n${r.markdown}\n\n---\n*⏱ ${(r.elapsed / 1000).toFixed(1)}s*\n`);
  }
  writeFileSync(combinedPath, toc + "\n\n" + body.join("\n"), "utf8");
  console.log(`\n${"=".repeat(60)}`);
  console.log(`\x1b[1;32m✅ Complete — ${results.length} reports in ${totalElapsed}s\x1b[0m`);
  console.log(`   Combined: ${combinedPath}`);
  console.log(`${"=".repeat(60)}\n`);
}

main().catch(err => { console.error(`\n❌ Fatal: ${err.message}`); process.exit(1); });