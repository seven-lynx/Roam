#!/usr/bin/env node
/**
 * Badge Repair v2 — Award badges via REST API (no SQL/RPC needed)
 * 
 * Works with the current database state:
 * - Clean wipe is done (only gift badges remain)
 * - XP and levels have been recalculated
 * - Awards only badges users legitimately qualify for
 */
import { createClient } from "@supabase/supabase-js";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
dotenvConfig({ path: resolve(ROOT, ".env") });

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log("=== Badge Repair v2: Award via REST API ===\n");

  // Fetch all non-gift badges
  const { data: allBadges } = await sb.from("badges").select("*").eq("is_gift_only", false);
  const badgeMap = new Map();
  for (const b of allBadges || []) badgeMap.set(b.slug, b);
  
  // Get all users
  const { data: users } = await sb.from("profiles").select("id, username, level, xp_total, streak_days");
  console.log(`Loaded ${badgeMap.size} badges, ${users.length} users\n`);

  let totalAwarded = 0, totalXp = 0, success = 0, failed = 0;

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    try {
      // Collect stats
      const [roamR, saveR, submitR, approvedR, collR, followerR, followingR, todayR] = await Promise.all([
        sb.from("seen_urls").select("*",{count:"exact",head:true}).eq("user_id",user.id),
        sb.from("saved_urls").select("*",{count:"exact",head:true}).eq("user_id",user.id),
        sb.from("moderation_queue").select("*",{count:"exact",head:true}).eq("submitted_by",user.id),
        sb.from("moderation_queue").select("*",{count:"exact",head:true}).eq("submitted_by",user.id).eq("status","approved"),
        sb.from("collections").select("*",{count:"exact",head:true}).eq("user_id",user.id),
        sb.from("follows").select("*",{count:"exact",head:true}).eq("following_id",user.id).eq("is_pending",false),
        sb.from("follows").select("*",{count:"exact",head:true}).eq("follower_id",user.id).eq("is_pending",false),
        sb.from("user_daily_activity").select("roam_count,save_count").eq("user_id",user.id).eq("date",new Date().toISOString().slice(0,10)).single(),
      ]);

      const stats = {
        roam: roamR.count ?? 0, save: saveR.count ?? 0,
        submit: submitR.count ?? 0, approved: approvedR.count ?? 0,
        collections: collR.count ?? 0,
        followers: followerR.count ?? 0, following: followingR.count ?? 0,
        todayRoam: todayR.data?.roam_count ?? 0, todaySave: todayR.data?.save_count ?? 0,
        level: user.level ?? 1, xp: user.xp_total ?? 0,
        streak: user.streak_days ?? 0,
      };

      // Get already unlocked
      const { data: existing } = await sb.from("user_badges").select("badge_id").eq("user_id",user.id).not("unlocked_at","is",null);
      const unlocked = new Set((existing||[]).map(e => e.badge_id));

      // Get parent-unlocked badges  
      const { data: allUserBadges } = await sb.from("user_badges").select("badge_id").eq("user_id",user.id);
      const allUserRowIds = new Set((allUserBadges||[]).map(e => e.badge_id));

      const toAward = [];

      for (const badge of (allBadges||[])) {
        if (unlocked.has(badge.id)) continue;
        if (badge.category === "milestone") {
          // Handle milestones
          const m = {
            "level-5":5,"level-10":10,"level-15":15,"level-20":20,"level-25":25,
            "level-30":30,"level-40":40,"level-50":50,"level-60":60,"level-75":75,
            "level-100":100,"level-125":125,"level-150":150
          };
          if (m[badge.slug] && stats.level >= m[badge.slug]) toAward.push(badge);
          if (badge.slug === "xp-millionaire" && stats.xp >= 1000000) toAward.push(badge);
          continue;
        }
        if (badge.category === "gift" || badge.category === "secret" || badge.is_hidden) continue;

        // Check parent prerequisite
        if (badge.parent_badge_slug) {
          const parent = badgeMap.get(badge.parent_badge_slug);
          if (parent && !unlocked.has(parent.id)) continue;
        }

        const req = badge.required_count;
        let qualifies = false;
        
        switch (badge.slug) {
          // Exploration
          case "first-roam": qualifies = stats.roam >= 1; break;
          case "wanderer-bronze": qualifies = stats.roam >= 10; break;
          case "wanderer-silver": qualifies = stats.roam >= 50; break;
          case "wanderer-gold": qualifies = stats.roam >= 200; break;
          case "nomad-bronze": qualifies = stats.roam >= 500; break;
          case "nomad-silver": qualifies = stats.roam >= 1000; break;
          case "nomad-gold": qualifies = stats.roam >= 5000; break;
          case "nomad-platinum": qualifies = stats.roam >= 10000; break;
          // Collecting
          case "first-save": qualifies = stats.save >= 1; break;
          case "collector-bronze": qualifies = stats.save >= 10; break;
          case "collector-silver": qualifies = stats.save >= 50; break;
          case "collector-gold": qualifies = stats.save >= 200; break;
          case "collector-platinum": qualifies = stats.save >= 1000; break;
          // Curating
          case "first-collection": qualifies = stats.collections >= 1; break;
          case "curator-bronze": qualifies = stats.collections >= 3; break;
          case "curator-silver": qualifies = stats.collections >= 10; break;
          case "curator-gold": qualifies = stats.collections >= 25; break;
          case "curator-supreme": qualifies = stats.collections >= 50; break;
          // Contributing
          case "first-submission": qualifies = stats.submit >= 1; break;
          case "contributor-bronze": qualifies = stats.submit >= 5; break;
          case "contributor-silver": qualifies = stats.submit >= 25; break;
          case "contributor-gold": qualifies = stats.submit >= 100; break;
          case "approved-bronze": qualifies = stats.approved >= 5; break;
          case "approved-silver": qualifies = stats.approved >= 25; break;
          case "approved-gold": qualifies = stats.approved >= 100; break;
          // Social
          case "social-butterfly-bronze": qualifies = stats.following >= 5; break;
          case "social-butterfly-silver": qualifies = stats.following >= 25; break;
          case "social-butterfly-gold": qualifies = stats.following >= 100; break;
          case "influencer-bronze": qualifies = stats.followers >= 10; break;
          case "influencer-silver": qualifies = stats.followers >= 50; break;
          case "influencer-gold": qualifies = stats.followers >= 200; break;
          case "influencer-platinum": qualifies = stats.followers >= 1000; break;
          // Streaks
          case "hot-streak-bronze": qualifies = stats.streak >= 3; break;
          case "hot-streak-silver": qualifies = stats.streak >= 7; break;
          case "hot-streak-gold": qualifies = stats.streak >= 30; break;
          case "unstoppable": qualifies = stats.streak >= 60; break;
          case "phoenix": qualifies = stats.streak >= 100; break;
          // Generic count-based
          default:
            if (req !== null && req !== undefined) {
              // Heuristic: try to match based on the first word
              const prefix = badge.slug.split("-")[0];
              switch (prefix) {
                case "wanderer": case "nomad": qualifies = stats.roam >= req; break;
                case "collector": case "archivist": qualifies = stats.save >= req; break;
                case "curator": qualifies = stats.collections >= req; break;
                case "contributor": qualifies = stats.submit >= req; break;
                case "approved": qualifies = stats.approved >= req; break;
                case "social": case "butterfly": qualifies = stats.following >= req; break;
                case "influencer": qualifies = stats.followers >= req; break;
                case "hot": case "streak": qualifies = stats.streak >= req; break;
                case "globetrotter": case "tagger": case "rater": case "pack": case "rat": case "favorited": qualifies = false; break; // needs SQL
                case "public": case "curator": break; // needs specific queries
              }
            }
        }

        if (qualifies) toAward.push(badge);
      }

      if (toAward.length > 0) {
        const rows = toAward.map(b => ({
          user_id: user.id, badge_id: b.id, progress_current: 0, unlocked_at: new Date().toISOString()
        }));
        const { error: insErr } = await sb.from("user_badges").upsert(rows, {onConflict:"user_id,badge_id"});
        if (insErr) { console.error(`  INSERT FAIL ${user.username}: ${insErr.message}`); failed++; continue; }

        const xpSum = toAward.reduce((s,b) => s + (b.xp_reward||0), 0);
        if (xpSum > 0) {
          await sb.from("xp_log").insert({user_id:user.id, action:"badge_rewards", xp_awarded:xpSum, metadata:{repair_v2:true, badge_count:toAward.length}});
          const { data: xpR } = await sb.from("xp_log").select("xp_awarded").eq("user_id",user.id);
          const newXp = (xpR||[]).reduce((s,r)=>s+r.xp_awarded,0);
          const newLvl = Math.floor(Math.sqrt(newXp/100))+1;
          await sb.from("profiles").update({xp_total:newXp, level:newLvl}).eq("id",user.id);
        }
        try { await sb.rpc("sync_profile_badge_count",{p_user_id:user.id}); } catch {}

        console.log(`  OK [${i+1}/${users.length}] ${user.username}: ${toAward.length} badges (+${xpSum} XP)`);
        totalAwarded += toAward.length; totalXp += xpSum;
      }
      success++;
    } catch(err) {
      console.error(`  FAIL [${i+1}] ${user.username}: ${err.message}`); failed++;
    }
    if ((i+1)%5===0 && i+1<users.length) { console.log(`  --- ${i+1}/${users.length} (${totalAwarded} badges) ---`); await sleep(300); }
  }

  console.log(`\n=== Complete: ${totalAwarded} badges, ${totalXp} XP | OK:${success} Fail:${failed} ===`);
}
main().catch(e => { console.error(e); process.exit(1); });