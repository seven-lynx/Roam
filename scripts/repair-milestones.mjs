#!/usr/bin/env node
/**
 * Repair: Award missing milestone badges to all users.
 * Runs AFTER the clean wipe + rebuild to catch milestone badges
 * that evaluate_badges() misses (level-5, level-15, level-25, 
 * level-60, level-125, level-150, xp-millionaire, demigod).
 */
import { createClient } from "@supabase/supabase-js";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
dotenvConfig({ path: resolve(ROOT, ".env") });

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const MILESTONE_SLUGS = ["level-5","level-15","level-25","level-60","level-125","level-150","xp-millionaire","demigod"];

async function main() {
  console.log("=== Repair: Missing Milestone Badges ===\n");

  // Fetch milestone badge definitions
  const { data: milestoneBadges } = await sb
    .from("badges")
    .select("*")
    .eq("category", "milestone")
    .in("slug", MILESTONE_SLUGS);
  
  const badgeMap = new Map();
  for (const b of (milestoneBadges || [])) {
    badgeMap.set(b.slug, b);
  }
  console.log(`Found ${badgeMap.size} milestone badges to check`);

  // Fetch users
  const { data: users } = await sb.from("profiles").select("id, username, level, xp_total");
  if (!users) {
    console.error("No users found");
    process.exit(1);
  }
  
  console.log(`Processing ${users.length} users...\n`);

  let totalAwarded = 0;
  let totalXp = 0;

  for (const user of users) {
    const toAward = [];
    let awardedSlugs = [];
    
    // Check each missing milestone
    for (const [slug, badge] of badgeMap) {
      // Skip if already unlocked
      const { count: existing } = await sb
        .from("user_badges")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("badge_id", badge.id)
        .not("unlocked_at", "is", null);
      
      if (existing > 0) continue;

      let qualifies = false;
      switch (slug) {
        case "level-5": qualifies = (user.level ?? 1) >= 5; break;
        case "level-15": qualifies = (user.level ?? 1) >= 15; break;
        case "level-25": qualifies = (user.level ?? 1) >= 25; break;
        case "level-60": qualifies = (user.level ?? 1) >= 60; break;
        case "level-125": qualifies = (user.level ?? 1) >= 125; break;
        case "level-150": qualifies = (user.level ?? 1) >= 150; break;
        case "xp-millionaire": qualifies = (user.xp_total ?? 0) >= 1000000; break;
        case "demigod": {
          const { count: allBadges } = await sb
            .from("user_badges")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .not("unlocked_at", "is", null);
          qualifies = (user.level ?? 1) >= 150 && (allBadges ?? 0) >= 200;
          break;
        }
      }

      if (qualifies) {
        toAward.push(badge);
        awardedSlugs.push(slug);
      }
    }

    if (toAward.length > 0) {
      // Insert user_badges
      const rows = toAward.map(b => ({
        user_id: user.id,
        badge_id: b.id,
        progress_current: 0,
        unlocked_at: new Date().toISOString(),
      }));
      
      const { error: insertErr } = await sb.from("user_badges").upsert(rows, { onConflict: "user_id,badge_id" });
      if (insertErr) {
        console.error(`  FAIL ${user.username}: ${insertErr.message}`);
        continue;
      }

      const xpSum = toAward.reduce((s, b) => s + (b.xp_reward || 0), 0);
      
      // Insert XP log
      if (xpSum > 0) {
        await sb.from("xp_log").insert({
          user_id: user.id,
          action: "badge_rewards",
          xp_awarded: xpSum,
          metadata: { milestone_patch: true, badge_count: toAward.length },
        });
        
        // Update profile
        const { data: xpRows } = await sb.from("xp_log").select("xp_awarded").eq("user_id", user.id);
        const totalXp = (xpRows || []).reduce((s, r) => s + r.xp_awarded, 0);
        const level = Math.floor(Math.sqrt(totalXp / 100)) + 1;
        await sb.from("profiles").update({ xp_total: totalXp, level }).eq("id", user.id);
      }

      // Sync badge count
      try { await sb.rpc("sync_profile_badge_count", { p_user_id: user.id }); } catch {}

      console.log(`  OK    ${user.username || user.id}: ${toAward.length} milestone badge(s) — ${awardedSlugs.join(", ")} (+${xpSum} XP)`);
      totalAwarded += toAward.length;
      totalXp += xpSum;
    }
  }

  console.log(`\n=== Repair Complete ===`);
  console.log(`Badges awarded: ${totalAwarded}`);
  console.log(`XP awarded: ${totalXp}`);
}

main().catch(err => {
  console.error(`\nFatal: ${err.message}`);
  process.exit(1);
});