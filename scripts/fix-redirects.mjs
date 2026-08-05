/**
 * fix-redirects.mjs — Apply all redirect URL updates from dead-links-results.jsonl
 * Usage: node scripts/fix-redirects.mjs [--dry-run]
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: resolve(import.meta.dirname || ".", "../.env") });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const DRY_RUN = process.argv.includes("--dry-run");
const RESULTS_FILE = resolve(import.meta.dirname || ".", ".cache/dead-links-results.jsonl");

async function main() {
  console.log("Fix Redirects\n");
  
  const allLines = readFileSync(RESULTS_FILE, "utf8").trim().split("\n").filter(Boolean);
  console.log(`Reading ${allLines.length} results...`);
  
  const redirects = [];
  for (const line of allLines) {
    try {
      const r = JSON.parse(line);
      if (r.redirect && r.newUrl) {
        redirects.push({ urlId: r.urlId, newUrl: r.newUrl });
      }
    } catch {}
  }
  
  console.log(`Redirects with newUrl: ${redirects.length}`);
  
  if (DRY_RUN) {
    console.log("[DRY RUN] Would update", redirects.length, "URLs");
    if (redirects.length > 0) {
      console.log("Sample:", redirects[0]);
    }
    return;
  }
  
  let fixed = 0;
  let skipped = 0;
  const BATCH = 100;
  const MAX_RETRIES = 3;
  
  for (let i = 0; i < redirects.length; i += BATCH) {
    const batch = redirects.slice(i, i + BATCH);
    for (const { urlId, newUrl } of batch) {
      let done = false;
      for (let attempt = 0; attempt < MAX_RETRIES && !done; attempt++) {
        const { error } = await supabase
          .from("urls")
          .update({ url: newUrl })
          .eq("id", urlId);
        
        if (!error) {
          fixed++;
          done = true;
        } else if (error.message?.includes("fetch failed")) {
          if (attempt < MAX_RETRIES - 1) {
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          } else {
            skipped++;
            done = true;
          }
        } else {
          // Non-retryable error (e.g., UUID not found = already deleted)
          skipped++;
          done = true;
        }
      }
    }
    process.stdout.write(`\r  Fixed: ${fixed}/${redirects.length}  Skipped: ${skipped}`);
  }
  console.log(`\nDone. Fixed ${fixed} redirects. Skipped ${skipped} (already deleted or unreachable).\n`);
}

main().catch(console.error);