#!/usr/bin/env node
/**
 * Repair script for production: fixes ghost badges, badge count drift.
 * Run: node scripts/repair-staging.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
dotenvConfig({ path: resolve(ROOT, ".env") });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("🔧 Starting production repair...\n");
  console.log(`Target: ${url}\n`);

  // Step 1: Repair ghost badges — set unlocked_at for qualifying rows
  console.log("Step 1: Finding and repairing ghost badges (NULL unlocked_at with qualifying progress)...");

  const { data: badges } = await sb.from("badges").select("id, slug, name, required_count");
  if (!badges) { console.log("  No badges found!"); process.exit(1); }

  const { data: ghostRows } = await sb.from("user_badges")
    .select("user_id, badge_id, progress_current")
    .is("unlocked_at", null)
    .limit(5000);

  if (!ghostRows || ghostRows.length === 0) {
    console.log("  No ghost badges found.");
  } else {
    console.log(`  Found ${ghostRows.length} rows with NULL unlocked_at.`);
    let fixed = 0, skipped = 0;
    for (const row of ghostRows) {
      const badge = badges.find(b => b.id === row.badge_id);
      if (!badge) { skipped++; continue; }

      // A badge qualifies if: required_count is NULL (binary badge),
      // progress >= required_count, or it's a milestone/gift with progress=0
      const qualifies = badge.required_count == null
        || row.progress_current >= badge.required_count
        || (row.progress_current === 0 && badge.required_count != null);

      if (qualifies) {
        const { error } = await sb.from("user_badges")
          .update({ unlocked_at: new Date().toISOString() })
          .eq("user_id", row.user_id)
          .eq("badge_id", row.badge_id);
        if (!error) fixed++;
        else console.error(`  Failed: ${badge.slug} for ${row.user_id.slice(0,8)} — ${error.message}`);
      } else {
        skipped++;
      }
    }
    console.log(`  Fixed: ${fixed} | Skipped (in progress): ${skipped}`);
  }

  // Step 2: Sync badge counts
  console.log("\nStep 2: Syncing profile badge counts...");
  const { data: allProfiles } = await sb.from("profiles").select("id, badge_count").limit(500);
  if (allProfiles) {
    let synced = 0, errors = 0;
    for (const p of allProfiles) {
      const { error } = await sb.rpc("sync_profile_badge_count", { p_user_id: p.id });
      if (!error) synced++;
      else { errors++; if (errors <= 3) console.error(`  sync failed for ${p.id.slice(0,8)}: ${error.message}`); }
    }
    console.log(`  Synced ${synced} profiles (${errors} errors).`);
  }

  // Step 3: Verify
  console.log("\n--- Verification ---");

  const { count: zeroStreak } = await sb.from("profiles")
    .select("*", { count: "exact", head: true })
    .gt("streak_days", 0);
  console.log(`  Users with streak_days > 0: ${zeroStreak}`);

  const { count: ghostCount } = await sb.from("user_badges")
    .select("*", { count: "exact", head: true })
    .is("unlocked_at", null)
    .gte("progress_current", 3);
  console.log(`  Remaining ghost badges (qualifying, no unlocked_at): ${ghostCount}`);

  console.log("\n✅ Repair complete.");
  console.log("\n⚠ IMPORTANT: Streaks will stay at 0 until edge functions are re-deployed.");
  console.log("  Deploy: supabase functions deploy roam save-url follow submit-url\n");
}

main().catch(err => { console.error(`\n❌ ${err.message}`); process.exit(1); });