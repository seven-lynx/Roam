/**
 * audit-url-assignments.mjs — Audit URL-to-subcategory assignment health
 *
 * Uses the `subcategory_report()` RPC function (server-side GROUP BY).
 * The RPC returns one row per (subcategory, source) — the script merges
 * these into per-subcategory seeders + URL totals in JS.
 *
 * Answers three questions:
 *   1. How many URLs & distinct seeders does each subcategory have?
 *   2. How many URLs have NO subcategory assigned (orphans)?
 *   3. Do assigned + unassigned URLs match the total approved count?
 *
 * Requires the RPC migration to be applied:
 *   supabase/migrations/20260711210000_subcategory_report_rpc.sql
 *
 * Usage:
 *   node scripts/audit-url-assignments.mjs
 */

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { writeFileSync, mkdirSync } from "fs";
import { config as dotenvConfig } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "../.env") });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function main() {
  console.log("Running server-side aggregation via RPC...");
  const startTime = Date.now();

  // ── All RPC calls in parallel ──────────────────────────────────────────
  const [aggResult, nullCountResult, nullSourcesResult, totalResult] =
    await Promise.all([
      supabase.rpc("subcategory_report"),
      supabase.rpc("subcategory_null_count"),
      supabase.rpc("subcategory_null_sources"),
      supabase.rpc("subcategory_total_count"),
    ]);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`  Done in ${elapsed}s\n`);

  if (aggResult.error) {
    console.error("subcategory_report RPC error:", aggResult.error.message);
    process.exit(1);
  }

  const aggRows = aggResult.data ?? [];
  const nullSubCount = nullCountResult.data ?? 0;
  const nullSourcesRows = nullSourcesResult.data ?? [];
  const totalApproved = totalResult.data ?? 0;

  // ── Merge per-(subcategory, source) rows into per-subcategory aggregates ─
  const bySubcategory = new Map();

  for (const row of aggRows) {
    const subId = row.subcategory_id;
    if (!bySubcategory.has(subId)) {
      bySubcategory.set(subId, {
        subName: row.subcategory_name,
        catName: row.category_name,
        sources: new Set(),
        urlCount: 0,
      });
    }
    const entry = bySubcategory.get(subId);
    // source is NULL in the LEFT JOIN for subcategories with 0 URLs
    if (row.source) entry.sources.add(row.source);
    entry.urlCount += row.url_count;
  }

  // ── Output ────────────────────────────────────────────────────────────
  const lines = [];
  const pad = (s, w) => String(s).padEnd(w);

  lines.push("");
  lines.push("═══════════════════════════════════════════════════════════════════════════════");
  lines.push("  URL ASSIGNMENT AUDIT — Seeders & URLs per Subcategory");
  lines.push("═══════════════════════════════════════════════════════════════════════════════");
  lines.push("");
  lines.push(`${pad("Subcategory", 40)} ${pad("Category", 25)} ${pad("Seeders", 8)} ${"URLs"}`);
  lines.push(`${"─".repeat(40)} ${"─".repeat(25)} ${"─".repeat(8)} ${"─".repeat(8)}`);

  let totalWithSub = 0;
  let globalSources = new Set();

  // Sort by category then subcategory name
  const sorted = [...bySubcategory.entries()].sort((a, b) => {
    const catCmp = (a[1].catName ?? "").localeCompare(b[1].catName ?? "");
    if (catCmp !== 0) return catCmp;
    return (a[1].subName ?? "").localeCompare(b[1].subName ?? "");
  });

  for (const [, entry] of sorted) {
    lines.push(
      `${pad(entry.subName, 40)} ${pad(entry.catName, 25)} ${pad(String(entry.sources.size), 8)} ${entry.urlCount.toLocaleString()}`,
    );
    totalWithSub += entry.urlCount;
    for (const s of entry.sources) globalSources.add(s);
  }

  lines.push(`${"─".repeat(40)} ${"─".repeat(25)} ${"─".repeat(8)} ${"─".repeat(8)}`);
  lines.push(`${pad("TOTAL (with subcategory)", 40)} ${pad("", 25)} ${pad(String(globalSources.size), 8)} ${totalWithSub.toLocaleString()}`);

  lines.push("");
  lines.push(`  URLs with NO subcategory (subcategory_id IS NULL): ${Number(nullSubCount).toLocaleString()}`);
  lines.push(`    Distinct sources for NULL-subcategory URLs: ${nullSourcesRows.length}`);

  // Top 20 NULL-subcategory sources
  const topNull = nullSourcesRows.slice(0, 20);
  if (topNull.length > 0) {
    lines.push(`    Top sources (of ${nullSourcesRows.length}):`);
    for (const r of topNull) {
      lines.push(`      ${pad(r.source || "(blank)", 35)} ${r.url_count.toLocaleString()}`);
    }
  }

  lines.push("");
  lines.push(`  ── VERIFICATION ──`);
  lines.push(`  Total approved URLs (all):                        ${Number(totalApproved).toLocaleString()}`);
  lines.push(`  URLs with subcategory:                            ${totalWithSub.toLocaleString()}`);
  lines.push(`  URLs without subcategory:                         ${Number(nullSubCount).toLocaleString()}`);
  lines.push(`  Sum check:                                        ${(totalWithSub + Number(nullSubCount)).toLocaleString()}`);
  lines.push(`  Match: ${totalWithSub + Number(nullSubCount) === Number(totalApproved) ? "✅ YES" : "❌ MISMATCH"}`);
  lines.push("");
  lines.push(`  Distinct seeders (with subcategory):              ${globalSources.size}`);
  lines.push(`  Query time: ${elapsed}s`);
  lines.push("");
  lines.push("═══════════════════════════════════════════════════════════════════════════════");

  const report = lines.join("\n");
  console.log(report);

  // Write report to scripts/reports/
  const reportsDir = resolve(__dirname, "reports");
  mkdirSync(reportsDir, { recursive: true });
  const outPath = resolve(reportsDir, "url-assignment-audit.txt");
  writeFileSync(outPath, report, "utf8");
  console.log(`\nReport written to: ${outPath}`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(2);
});