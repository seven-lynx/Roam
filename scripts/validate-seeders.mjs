/**
 * validate-seeders.mjs — Pre-flight validation for all seeders
 *
 * Checks that every seeder's category_id and subcategory_id (when using
 * CATEGORY.X / SUBCATEGORY.Y constants or direct UUID strings) exist in
 * the DB and that each subcategory belongs to its declared category.
 * Exits non-zero if violations are found.
 *
 * Usage:
 *   node scripts/validate-seeders.mjs           # validate all seeders
 *   node scripts/validate-seeders.mjs --json     # machine-readable output
 *   node scripts/validate-seeders.mjs --verbose  # show skipped/ok entries too
 */

import { fileURLToPath } from "url";
import { dirname, resolve, basename } from "path";
import { readFileSync, readdirSync } from "fs";
import { config as dotenvConfig } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "../.env") });

import { createClient } from "@supabase/supabase-js";
import { CATEGORY, SUBCATEGORY } from "./lib/seed.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const JSON_MODE = process.argv.includes("--json");
const VERBOSE = process.argv.includes("--verbose");

// ── Reverse lookup maps ──────────────────────────────────────────────────
const CAT_BY_UUID = {};
for (const [name, uuid] of Object.entries(CATEGORY)) CAT_BY_UUID[uuid] = name;

const SUB_BY_UUID = {};
for (const [name, uuid] of Object.entries(SUBCATEGORY)) SUB_BY_UUID[uuid] = name;

// ── 1. Resolve a reference string to a UUID (if it's a constant or literal) ──
function resolveConstantRef(ref, kind) {
  // Determine which map to check: CATEGORY vs SUBCATEGORY
  const isCat = kind === "category";
  const map = isCat ? CATEGORY : SUBCATEGORY;

  // Handle CONSTANT.NAME pattern (e.g. CATEGORY.GAMES_HOBBIES, SUBCATEGORY.FISHING)
  const constMatch = ref.match(/^(?:CATEGORY|SUBCATEGORY)\.(\w+)$/);
  if (constMatch) {
    const name = constMatch[1];
    const uuid = map[name];
    return uuid ? { uuid, name, source: "constant" } : { error: `Unknown ${kind} constant: ${name}` };
  }

  // Handle direct UUID string (e.g. 'c1000000-...')
  if (/^['"]c[12]/.test(ref)) {
    const uuid = ref.replace(/['"]/g, "");
    const revMap = isCat ? CAT_BY_UUID : SUB_BY_UUID;
    const displayName = revMap[uuid] ?? "unknown";
    return { uuid, name: displayName, source: "literal" };
  }

  // Handle null/NULL (some seeders pass null explicitly)
  if (ref === "null" || ref === "NULL" || ref === "undefined") {
    return null;
  }

  // Anything else is a runtime variable — can't validate statically
  return { skipped: true, reason: `runtime variable: ${ref}` };
}

// ── 2. Scan seeder source for category/subcategory references ─────────────
const SCRIPTS_DIR = __dirname;
const seedFiles = readdirSync(SCRIPTS_DIR).filter(
  (f) => f.startsWith("seed-") && (f.endsWith(".mjs") || f.endsWith(".js")),
);

function extractReferences(filePath) {
  const src = readFileSync(filePath, "utf8");
  const name = basename(filePath);
  const refs = [];

  // Strategy: find all lines (or multi-line blocks) containing
  // category_id / subcategory_id and extract the value tokens.

  // Single-line pattern:  category_id: CATEGORY.X,
  // or:                    subcategory_id: SUBCATEGORY.Y,
  const singleRe = /(category_id|subcategory_id)\s*:\s*(\S+?)(?:,|\s*$)/gm;
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    singleRe.lastIndex = 0;
    let m;
    while ((m = singleRe.exec(line)) !== null) {
      const field = m[1];
      const value = m[2].replace(/,\s*$/, "");
      const existing = refs.find((r) => r.line === i + 1);
      if (existing) {
        existing[field === "category_id" ? "categoryRef" : "subcategoryRef"] = value;
      } else {
        const entry = { file: name, line: i + 1 };
        if (field === "category_id") entry.categoryRef = value;
        else entry.subcategoryRef = value;
        // Try to find source near this line
        const sourceRe = /source\s*:\s*["']([^"']+)["']/;
        for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 3); j++) {
          const sm = lines[j].match(sourceRe);
          if (sm) { entry.source = sm[1]; break; }
        }
        refs.push(entry);
      }
    }
  }

  // Merge entries on adjacent lines (category_id and subcategory_id are often
  // on separate lines within the same config block — within 2 lines of each other)
  const merged = [];
  for (const ref of refs) {
    let found = false;
    for (const m of merged) {
      if (Math.abs(m.line - ref.line) <= 2) {
        if (ref.categoryRef && !m.categoryRef) m.categoryRef = ref.categoryRef;
        if (ref.subcategoryRef && !m.subcategoryRef) m.subcategoryRef = ref.subcategoryRef;
        if (ref.source && !m.source) m.source = ref.source;
        found = true;
        break;
      }
    }
    if (!found) merged.push({ ...ref });
  }
  return merged;
}

// ── 3. Query DB ──────────────────────────────────────────────────────────
async function queryExistingSubcategories() {
  const { data, error } = await supabase
    .from("subcategories")
    .select("id, category_id, name");
  if (error) { console.error("Failed to query subcategories:", error.message); process.exit(1); }
  const map = new Map();
  for (const r of data) map.set(r.id, r);
  return map;
}

async function queryExistingCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name");
  if (error) { console.error("Failed to query categories:", error.message); process.exit(1); }
  const map = new Map();
  for (const r of data) map.set(r.id, r);
  return map;
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  if (!JSON_MODE) console.log("Validating seeders against database...\n");

  const [dbSubs, dbCats] = await Promise.all([
    queryExistingSubcategories(),
    queryExistingCategories(),
  ]);

  const violations = [];
  let skipped = 0;
  let ok = 0;

  for (const file of seedFiles) {
    const filePath = resolve(SCRIPTS_DIR, file);
    const refs = extractReferences(filePath);

    for (const ref of refs) {
      const cat = ref.categoryRef ? resolveConstantRef(ref.categoryRef, "category") : null;
      const sub = ref.subcategoryRef ? resolveConstantRef(ref.subcategoryRef, "subcategory") : null;

      // Track skipped (runtime variables)
      if (cat?.skipped) { skipped++; if (VERBOSE) console.log(`  ⏭  ${ref.file}:${ref.line} category=${ref.categoryRef} (runtime)`); continue; }
      if (sub?.skipped) { skipped++; if (VERBOSE) console.log(`  ⏭  ${ref.file}:${ref.line} subcategory=${ref.subcategoryRef} (runtime)`); continue; }

      let hasIssue = false;

      // Validate category
      if (cat && !cat.error) {
        if (!dbCats.has(cat.uuid)) {
          violations.push({
            file: ref.file, line: ref.line, source: ref.source,
            type: "category_missing",
            message: `Category "${cat.name}" (${cat.uuid}) not in DB`,
            category_id: cat.uuid,
          });
          hasIssue = true;
        }
      } else if (cat?.error) {
        violations.push({ file: ref.file, line: ref.line, source: ref.source, type: "unknown_constant", message: cat.error });
        hasIssue = true;
      }

      // Validate subcategory
      if (sub && !sub.error) {
        if (!dbSubs.has(sub.uuid)) {
          violations.push({
            file: ref.file, line: ref.line, source: ref.source,
            type: "subcategory_missing",
            message: `Subcategory "${sub.name}" (${sub.uuid}) not in DB`,
            subcategory_id: sub.uuid,
          });
          hasIssue = true;
        } else if (cat && !cat.error && dbSubs.has(sub.uuid)) {
          const dbSub = dbSubs.get(sub.uuid);
          if (dbSub.category_id !== cat.uuid) {
            const expectedCat = CAT_BY_UUID[cat.uuid] ?? cat.uuid;
            const actualCat = CAT_BY_UUID[dbSub.category_id] ?? dbSub.category_id;
            violations.push({
              file: ref.file, line: ref.line, source: ref.source,
              type: "category_mismatch",
              message: `Subcategory "${sub.name}" belongs to ${actualCat}, but seeder says ${expectedCat}`,
              category_id: cat.uuid,
              subcategory_id: sub.uuid,
            });
            hasIssue = true;
          }
        }
      } else if (sub?.error) {
        violations.push({ file: ref.file, line: ref.line, source: ref.source, type: "unknown_constant", message: sub.error });
        hasIssue = true;
      }

      if (!hasIssue && cat && sub) {
        ok++;
        if (VERBOSE) console.log(`  ✅ ${ref.file}:${ref.line} ${cat.name}/${sub.name}`);
      }
    }
  }

  // ── Output ──────────────────────────────────────────────────────────────
  if (JSON_MODE) {
    console.log(JSON.stringify({ violations, ok, skipped }, null, 2));
  } else {
    if (violations.length === 0) {
      console.log(`✅ All seeders validated — no category/subcategory violations.`);
      console.log(`   Validated: ${ok} references OK`);
      console.log(`   Skipped: ${skipped} runtime variable references (not statically checkable)`);
      console.log(`   Categories in DB: ${dbCats.size}  |  Subcategories in DB: ${dbSubs.size}`);
    } else {
      console.log(`❌ ${violations.length} violation(s) found:\n`);

      // Group by type
      const groups = {};
      for (const v of violations) {
        const key = v.type;
        if (!groups[key]) groups[key] = [];
        groups[key].push(v);
      }

      const labels = {
        subcategory_missing: "SUBCATEGORY NOT IN DB",
        category_missing: "CATEGORY NOT IN DB",
        category_mismatch: "CATEGORY MISMATCH (subcategory under wrong category)",
        unknown_constant: "UNKNOWN CONSTANT",
      };

      for (const [type, items] of Object.entries(groups)) {
        console.log(`  ── ${labels[type] || type} (${items.length}) ──`);
        for (const v of items) {
          console.log(`    ${v.file}:${v.line}${v.source ? ` [${v.source}]` : ""}`);
          console.log(`      ${v.message}`);
        }
        console.log("");
      }

      if (violations.some((v) => v.type === "subcategory_missing")) {
        console.log("Run: node scripts/ensure-subcategories.mjs  to generate a migration for missing subcategories.");
      }

      console.log(`\n(Besides these, ${ok} references OK, ${skipped} runtime variables skipped)`);
    }
  }

  process.exit(violations.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Validation error:", err.message);
  process.exit(2);
});