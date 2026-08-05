/**
 * ensure-subcategories.mjs — Sync subcategory constants with the DB
 *
 * Compares SUBCATEGORY constants in scripts/lib/seed.js against the
 * public.subcategories table and reports any mismatches:
 *
 *   --check     Report missing/mismatched subcategories (no changes)
 *   --migrate   Generate a timestamped migration file for missing rows
 *   --dry-run   Preview what --migrate would write
 *
 * Usage:
 *   node scripts/ensure-subcategories.mjs --check
 *   node scripts/ensure-subcategories.mjs --migrate
 *   node scripts/ensure-subcategories.mjs --migrate --dry-run
 */

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { config as dotenvConfig } from "dotenv";
import { CATEGORY, SUBCATEGORY } from "./lib/seed.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "../.env") });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const MIGRATIONS_DIR = resolve(__dirname, "..", "supabase", "migrations");
const DRY_RUN = process.argv.includes("--dry-run");
const CHECK = process.argv.includes("--check");
const MIGRATE = process.argv.includes("--migrate");

// ── Reverse lookups ──────────────────────────────────────────────────────
const CAT_BY_UUID = {};
for (const [name, uuid] of Object.entries(CATEGORY)) {
  CAT_BY_UUID[uuid] = name;
}

// Expected hierarchy: for each subcategory constant, we know its category from the UUID prefix
function pillarFromSubUuid(uuid) {
  // UUID pattern: c2{pillar:06d}-...
  const m = uuid.match(/^c2(\d{6})-/);
  if (!m) return null;
  return parseInt(m[1], 10);
}

function expectedCategoryId(uuid) {
  const pillar = pillarFromSubUuid(uuid);
  if (!pillar) return null;
  return `c1000000-0000-0000-0000-${String(pillar).padStart(12, "0")}`;
}

// ── Generate slug from name ───────────────────────────────────────────────
function nameToSlug(name) {
  return name
    .toLowerCase()
    .replace(/[&']/g, "")       // remove & and '
    .replace(/[^a-z0-9]+/g, "-") // replace runs of non-alnum with hyphen
    .replace(/^-|-$/g, "");     // trim leading/trailing hyphens
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  const { data: dbSubs, error } = await supabase
    .from("subcategories")
    .select("id, category_id, name, slug, sort_order")
    .order("id");

  if (error) {
    console.error("Failed to query subcategories:", error.message);
    process.exit(1);
  }

  const dbById = new Map();
  for (const s of dbSubs) dbById.set(s.id, s);

  const issues = [];

  // Check each SUBCATEGORY constant
  for (const [constName, uuid] of Object.entries(SUBCATEGORY)) {
    const dbRow = dbById.get(uuid);
    const expectedCat = expectedCategoryId(uuid);
    const catName = CAT_BY_UUID[expectedCat] ?? "UNKNOWN";

    if (!dbRow) {
      issues.push({
        constName,
        uuid,
        type: "missing",
        expectedCategory: catName,
        expectedCategoryId: expectedCat,
      });
    } else {
      // Check consistency
      if (dbRow.category_id !== expectedCat) {
        issues.push({
          constName,
          uuid,
          type: "wrong_category",
          expectedCategory: catName,
          expectedCategoryId: expectedCat,
          actualCategoryId: dbRow.category_id,
          actualCategoryName: CAT_BY_UUID[dbRow.category_id] ?? "unknown",
        });
      }
      // Check slug consistency
      const expectedSlug = nameToSlug(dbRow.name);
      if (dbRow.slug !== expectedSlug) {
        issues.push({
          constName,
          uuid,
          type: "slug_mismatch",
          expectedSlug,
          actualSlug: dbRow.slug,
        });
      }
    }
  }

  // Check for DB rows NOT in SUBCATEGORY constants (orphaned)
  for (const [id, dbRow] of dbById) {
    let found = false;
    for (const uuid of Object.values(SUBCATEGORY)) {
      if (uuid === id) { found = true; break; }
    }
    if (!found) {
      issues.push({
        constName: null,
        uuid: id,
        type: "extra_in_db",
        dbName: dbRow.name,
        dbCategoryName: CAT_BY_UUID[dbRow.category_id] ?? "unknown",
      });
    }
  }

  // ── Output ──────────────────────────────────────────────────────────────
  const missing = issues.filter((i) => i.type === "missing");

  if (CHECK) {
    if (issues.length === 0) {
      console.log("✅ SUBCATEGORY constants and DB are in sync.");
      console.log(`   ${Object.keys(SUBCATEGORY).length} constants, ${dbSubs.length} DB rows`);
    } else {
      console.log(`❌ ${issues.length} issue(s) found:\n`);

      if (missing.length > 0) {
        console.log(`  ── MISSING FROM DB (${missing.length}) ──`);
        for (const m of missing) {
          console.log(`    ${m.constName.padEnd(35)} ${m.uuid}  → ${m.expectedCategory}`);
        }
        console.log("");
      }

      const mismatches = issues.filter((i) => i.type === "wrong_category" || i.type === "slug_mismatch");
      if (mismatches.length > 0) {
        console.log(`  ── MISMATCHES (${mismatches.length}) ──`);
        for (const m of mismatches) {
          console.log(`    ${m.constName.padEnd(35)} ${m.uuid}`);
          if (m.type === "wrong_category") {
            console.log(`      Category: expected ${m.expectedCategoryId} (${m.expectedCategory}), got ${m.actualCategoryId} (${m.actualCategoryName})`);
          }
          if (m.type === "slug_mismatch") {
            console.log(`      Slug: expected "${m.expectedSlug}", got "${m.actualSlug}"`);
          }
        }
      }

      const extras = issues.filter((i) => i.type === "extra_in_db");
      if (extras.length > 0) {
        console.log(`\n  ── IN DB BUT NOT IN CONSTANTS (${extras.length}) ──`);
        for (const e of extras) {
          console.log(`    ${e.dbName.padEnd(35)} ${e.uuid}  (${e.dbCategoryName})`);
        }
      }
    }
  }

  if (MIGRATE) {
    if (missing.length === 0) {
      console.log("No missing subcategories — nothing to migrate.");
    } else {
      // Generate migration SQL
      const now = new Date();
      const ts = now.getFullYear().toString() +
        String(now.getMonth() + 1).padStart(2, "0") +
        String(now.getDate()).padStart(2, "0") +
        String(now.getHours()).padStart(2, "0") +
        String(now.getMinutes()).padStart(2, "0") +
        String(now.getSeconds()).padStart(2, "0");

      const filename = `${ts}_ensure_subcategories.sql`;
      const filepath = resolve(MIGRATIONS_DIR, filename);

      // Build name for each missing constant — derive from constant name
      const valueLines = missing.map((m) => {
        const humanName = m.constName
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .replace(/\bSci ?Fi\b/, "Sci-Fi")
          .replace(/\bDiy\b/, "DIY")
          .replace(/\bUx\b/, "UX")
          .replace(/\bAi\b/, "AI")
          .replace(/\bRpg\b/, "RPGs");
        const slug = nameToSlug(humanName);
        const sortMatch = m.uuid.match(/(\d{12})$/);
        const sort = sortMatch ? parseInt(sortMatch[1], 10) : 0;
        return `  ('${m.uuid}', '${m.expectedCategoryId}', '${humanName}', '${slug}', ${sort})`;
      });

      const sql = `-- Auto-generated by scripts/ensure-subcategories.mjs
-- Adds ${missing.length} missing subcategory row(s) that are defined in
-- scripts/lib/seed.js SUBCATEGORY constants but missing from the DB.
--
-- Uses ON CONFLICT (id) DO NOTHING for idempotency.

BEGIN;

INSERT INTO public.subcategories (id, category_id, name, slug, sort_order) VALUES
${valueLines.join(",\n")}
ON CONFLICT (id) DO NOTHING;

COMMIT;
`;

      if (DRY_RUN) {
        console.log(`[DRY RUN] Would create migration: ${filename}\n`);
        console.log(sql);
      } else {
        if (!existsSync(MIGRATIONS_DIR)) mkdirSync(MIGRATIONS_DIR, { recursive: true });
        writeFileSync(filepath, sql, "utf8");
        console.log(`✅ Created migration: supabase/migrations/${filename}`);
        console.log(`   ${missing.length} missing subcategories`);
        for (const m of missing) {
          console.log(`     ${m.constName} → ${m.expectedCategory}`);
        }
        console.log(`\nRun: npx supabase db push  to apply it.`);
      }
    }
  }

  if (!CHECK && !MIGRATE) {
    console.log("Usage:");
    console.log("  node scripts/ensure-subcategories.mjs --check        Check for mismatches");
    console.log("  node scripts/ensure-subcategories.mjs --migrate      Generate migration for missing rows");
    console.log("  node scripts/ensure-subcategories.mjs --migrate --dry-run   Preview migration");
  }

  // Only exit non-zero for critical issues (missing or wrong category).
  // Slug mismatches and extra-in-DB are informational warnings.
  const critical = issues.filter((i) => i.type === "missing" || i.type === "wrong_category");
  process.exit(critical.length > 0 && CHECK ? 1 : 0);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(2);
});