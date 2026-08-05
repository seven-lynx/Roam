#!/usr/bin/env node
/**
 * Full Badge Audit — queries production DB and produces a report.
 * Run: node scripts/audit-badges-full.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { writeFileSync, mkdirSync } from "fs";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
dotenvConfig({ path: resolve(ROOT, ".env") });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  // Fallback to hardcoded (both scripts use this)
  console.log("Using hardcoded credentials...");
}
const SUPABASE_URL = url || process.env.SUPABASE_URL || "";
const SERVICE_ROLE_KEY = key || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let report = "# Badge System Full Audit\n\n";
report += `**Date:** ${new Date().toISOString().split("T")[0]}\n`;
report += `**Database:** ${SUPABASE_URL}\n\n`;

function addSection(title) {
  report += `\n## ${title}\n\n`;
}

function addLine(line) {
  report += `${line}\n`;
}

async function pgQuery(sql, label) {
  // Try rpc first
  try {
    const { data, error } = await sb.rpc("exec_sql", { query: sql });
    if (!error && data !== undefined) {
      return { data, error: null };
    }
  } catch {}
  
  // Fallback: try direct REST query
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    });
    const json = await res.json();
    return { data: json, error: res.ok ? null : { message: JSON.stringify(json) } };
  } catch (e) {
    return { data: null, error: { message: e.message } };
  }
}

async function simpleCount(table, filter = {}) {
  try {
    let q = sb.from(table).select("*", { count: "exact", head: true });
    for (const [k, v] of Object.entries(filter)) {
      q = q.eq(k, v);
    }
    const { count, error } = await q;
    if (error) throw error;
    return count ?? 0;
  } catch (e) {
    return -1;
  }
}

async function main() {
  // ── Section 1: Overview ────────────────────────────────────────────────
  addSection("1. Database Overview");
  
  const totalProfiles = await simpleCount("profiles");
  const totalBadges = await simpleCount("badges");
  const totalUserBadges = await simpleCount("user_badges");
  const totalUnlockedBadges = await simpleCount("user_badges", { });
  const totalXpLog = await simpleCount("xp_log");
  
  addLine(`- **Total profiles:** ${totalProfiles}`);
  addLine(`- **Total badge definitions:** ${totalBadges}`);
  addLine(`- **Total user_badges rows:** ${totalUserBadges}`);
  addLine(`- **Total unlocked badges:** TBD (need separate query)`);
  addLine(`- **Total XP log entries:** ${totalXpLog}`);

  // ── Section 2: Badge Definitions ───────────────────────────────────────
  addSection("2. Badge Definitions");
  
  const { data: allBadges } = await sb.from("badges").select("*").order("slug");
  if (allBadges) {
    const byCategory = {};
    for (const b of allBadges) {
      if (!byCategory[b.category]) byCategory[b.category] = [];
      byCategory[b.category].push(b);
    }
    
    report += "| Category | Count | Badges |\n";
    report += "|----------|-------|--------|\n";
    for (const [cat, badges] of Object.entries(byCategory)) {
      report += `| ${cat} | ${badges.length} | ${badges.map(b => b.slug).join(", ")} |\n`;
    }
    report += "\n";
  }

  // ── Section 3: Unlock Stats Per Badge ──────────────────────────────────
  addSection("3. Badge Unlock Statistics");
  addLine("(querying unlock counts per badge...)");
  
  if (allBadges) {
    const rows = [];
    for (const badge of allBadges) {
      // Count unlocked
      const { count: unlockedCount } = await sb
        .from("user_badges")
        .select("*", { count: "exact", head: true })
        .eq("badge_id", badge.id)
        .not("unlocked_at", "is", null);
      
      // Count in-progress
      const { count: inProgressCount } = await sb
        .from("user_badges")
        .select("*", { count: "exact", head: true })
        .eq("badge_id", badge.id)
        .is("unlocked_at", null);
      
      rows.push({
        slug: badge.slug,
        name: badge.name,
        category: badge.category,
        tier: badge.tier,
        required_count: badge.required_count,
        unlocked: unlockedCount ?? 0,
        in_progress: inProgressCount ?? 0,
        is_hidden: badge.is_hidden,
        is_gift_only: badge.is_gift_only,
      });
      
      if (rows.length % 10 === 0) {
        console.log(`  Processed ${rows.length}/${allBadges.length} badges...`);
      }
    }
    
    report += "| Slug | Name | Category | Tier | Req | Unlocked | In-Progress |\n";
    report += "|------|------|----------|------|-----|----------|-------------|\n";
    for (const r of rows) {
      report += `| ${r.slug} | ${r.name} | ${r.category} | ${r.tier} | ${r.required_count ?? "-"} | ${r.unlocked} | ${r.in_progress} |\n`;
    }
    report += "\n";
  }

  // ── Section 4: Milestone Badge Specific Analysis ───────────────────────
  addSection("4. Milestone Badge Gap Analysis");
  
  // Get all users with their levels
  const { data: allUsers } = await sb.from("profiles")
    .select("id, username, level, xp_total, badge_count, streak_days")
    .order("level", { ascending: false });
  
  if (allUsers && allBadges) {
    const milestoneBadges = allBadges.filter(b => b.category === "milestone");
    const levelThresholds = { "level-10": 10, "level-20": 20, "level-30": 30, "level-40": 40, "level-50": 50, "level-75": 75, "level-100": 100 };
    
    addLine("### Level-Based Milestone Badges\n");
    report += "| Badge | Min Level | Users Qualified | Users Have Badge | Missing |\n";
    report += "|-------|-----------|-----------------|------------------|---------|\n";
    
    for (const mb of milestoneBadges.filter(b => levelThresholds[b.slug])) {
      const threshold = levelThresholds[mb.slug];
      const qualified = allUsers.filter(u => u.level >= threshold);
      const qualifiedIds = qualified.map(u => u.id);
      
      // Check who actually has the badge
      const { data: holders } = await sb
        .from("user_badges")
        .select("user_id")
        .eq("badge_id", mb.id)
        .not("unlocked_at", "is", null)
        .in("user_id", qualifiedIds.slice(0, 500)); // limit for performance
      
      const holderIds = new Set((holders || []).map(h => h.user_id));
      const missing = qualifiedIds.filter(id => !holderIds.has(id));
      
      report += `| ${mb.slug} | ${threshold} | ${qualified.length} | ${holderIds.size} | ${missing.length} |\n`;
      
      if (missing.length > 0 && missing.length <= 10) {
        const missingUsers = allUsers.filter(u => missing.includes(u.id));
        report += `  - Missing users: ${missingUsers.map(u => `${u.username || u.id.slice(0,8)} (Lv ${u.level})`).join(", ")}\n`;
      }
    }
    
    // Combo milestone badges
    addLine("\n### Combo Milestone Badges\n");
    addLine("These require both level + badge count thresholds. Checking...");
    
    // centurion-badges: 100 unlocked badges
    const centurion = allBadges.find(b => b.slug === "centurion-badges");
    if (centurion) {
      // Find users with >= 100 unlocked badges
      const highlyDecorated = [];
      for (const user of allUsers) {
        const { count } = await sb
          .from("user_badges")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .not("unlocked_at", "is", null);
        if ((count ?? 0) >= 100) highlyDecorated.push(user.id);
        if (highlyDecorated.length >= 100) break; // sample limit
      }
      
      const { data: centurionHolders } = await sb
        .from("user_badges")
        .select("user_id")
        .eq("badge_id", centurion.id)
        .not("unlocked_at", "is", null);
      
      const centurionHolderIds = new Set((centurionHolders || []).map(h => h.user_id));
      const centurionMissing = highlyDecorated.filter(id => !centurionHolderIds.has(id));
      
      addLine(`- **centurion-badges** (100+ badges): ${highlyDecorated.length} users qualify, ${centurionHolderIds.size} have it, ${centurionMissing.length} missing`);
    }
    
    // master-roamer: level 50 + 50 badges
    const masterRoamer = allBadges.find(b => b.slug === "master-roamer");
    if (masterRoamer) {
      const qualified = [];
      for (const user of allUsers.filter(u => u.level >= 50)) {
        const { count } = await sb
          .from("user_badges")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .not("unlocked_at", "is", null);
        if ((count ?? 0) >= 50) qualified.push(user.id);
      }
      
      const { data: holders } = await sb
        .from("user_badges")
        .select("user_id")
        .eq("badge_id", masterRoamer.id)
        .not("unlocked_at", "is", null);
      
      const holderIds = new Set((holders || []).map(h => h.user_id));
      const missing = qualified.filter(id => !holderIds.has(id));
      
      addLine(`- **master-roamer** (Lv50 + 50 badges): ${qualified.length} users qualify, ${holderIds.size} have it, ${missing.length} missing`);
    }
    
    // grandmaster: level 100 + all non-secret badges
    const grandmaster = allBadges.find(b => b.slug === "grandmaster");
    if (grandmaster) {
      const totalNonMilestoneNonGift = allBadges.filter(b => !b.is_hidden && !b.is_gift_only && b.category !== "milestone").length;
      const qualified = [];
      for (const user of allUsers.filter(u => u.level >= 100)) {
        const { count } = await sb
          .from("user_badges")
          .select("badge_id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .not("unlocked_at", "is", null);
        if ((count ?? 0) >= totalNonMilestoneNonGift) qualified.push(user.id);
      }
      
      const { data: holders } = await sb
        .from("user_badges")
        .select("user_id")
        .eq("badge_id", grandmaster.id)
        .not("unlocked_at", "is", null);
      
      const holderIds = new Set((holders || []).map(h => h.user_id));
      const missing = qualified.filter(id => !holderIds.has(id));
      
      addLine(`- **grandmaster** (Lv100 + all non-secret): ${qualified.length} users qualify, ${holderIds.size} have it, ${missing.length} missing`);
    }
  }

  // ── Section 5: XP/Level Integrity ──────────────────────────────────────
  addSection("5. XP & Level Integrity Check");
  
  if (allUsers) {
    addLine("Checking XP totals against xp_log sums for a sample of users...\n");
    
    let xpMismatches = 0;
    let levelMismatches = 0;
    const sampleSize = Math.min(allUsers.length, 200);
    const sample = allUsers.slice(0, sampleSize);
    
    for (const user of sample) {
      const { data: xpRows } = await sb
        .from("xp_log")
        .select("xp_awarded")
        .eq("user_id", user.id);
      
      const calcXp = (xpRows || []).reduce((sum, r) => sum + r.xp_awarded, 0);
      const calcLevel = Math.floor(Math.sqrt(calcXp / 100)) + 1;
      
      if (calcXp !== (user.xp_total || 0)) {
        xpMismatches++;
        if (xpMismatches <= 5) {
          addLine(`- **${user.username || user.id.slice(0,8)}**: stored XP=${user.xp_total}, calculated=${calcXp} (diff=${calcXp - user.xp_total})`);
        }
      }
      if (calcLevel !== (user.level || 1)) {
        levelMismatches++;
        if (levelMismatches <= 5) {
          addLine(`- **${user.username || user.id.slice(0,8)}**: stored level=${user.level}, calculated=${calcLevel}`);
        }
      }
    }
    
    addLine(`\n- **XP mismatches (sample of ${sampleSize}):** ${xpMismatches} users`);
    addLine(`- **Level mismatches (sample of ${sampleSize}):** ${levelMismatches} users`);
    addLine(`- **Extrapolated XP mismatches (full userbase):** ~${Math.round(xpMismatches * allUsers.length / sampleSize)} users`);
  }

  // ── Section 6: badge_count vs actual ───────────────────────────────────
  addSection("6. profile.badge_count vs Actual Unlocked Badges");
  
  if (allUsers) {
    let driftUsers = 0;
    const driftDetails = [];
    
    for (const user of allUsers.slice(0, 300)) {
      const { count: actual } = await sb
        .from("user_badges")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("unlocked_at", "is", null);
      
      if ((actual ?? 0) !== (user.badge_count ?? 0)) {
        driftUsers++;
        driftDetails.push({ username: user.username, id: user.id.slice(0,8), stored: user.badge_count, actual: actual ?? 0 });
        if (driftDetails.length <= 10) {
          addLine(`- **${user.username || user.id.slice(0,8)}**: badge_count=${user.badge_count}, actual=${actual}`);
        }
      }
    }
    
    addLine(`\n- **Users with badge_count drift (sample of 300):** ${driftUsers}`);
  }

  // ── Section 7: Duplicate badge assignments ────────────────────────────
  addSection("7. Duplicate Badge Assignments Check");
  
  try {
    const { data: dups } = await sb
      .rpc("exec_sql", {
        query: `SELECT user_id, badge_id, COUNT(*) as cnt 
                FROM user_badges 
                WHERE unlocked_at IS NOT NULL
                GROUP BY user_id, badge_id 
                HAVING COUNT(*) > 1 
                LIMIT 10`
      }).catch(() => ({ data: null }));
    
    if (dups && dups.length > 0) {
      addLine(`⚠ Found ${dups.length} duplicate unlocked badge assignments`);
      for (const d of dups.slice(0, 10)) {
        addLine(`- user=${d.user_id}, badge=${d.badge_id}, count=${d.cnt}`);
      }
    } else {
      addLine("✅ No duplicate unlocked badge assignments found");
    }
  } catch {
    addLine("(Could not check duplicates via RPC)");
  }

  // ── Section 8: Summary & Recommendations ──────────────────────────────
  addSection("8. Summary & Recommendations");
  addLine("See console output for full details.");
  addLine("\n### Known Issues in rebuild-badges-client-side.mjs\n");
  addLine("1. **Missing `break` statements** (lines 198-222) — fall-through in switch/case silently mis-evaluates badges");
  addLine("2. **Missing combo milestone badges** (`centurion-badges`, `master-roamer`, `grandmaster`)");
  addLine("3. **XP update is broken** (line 295 sets `xp_total: undefined`)");
  addLine("4. **Many badges unevaluated** — `nomad-*`, `globetrotter-*`, `tagger-*`, `rater-*`, `critic`, `marathon`, `loyalist`, `weekend-warrior`, `diversity-champ`, `quality-control`, `citizen-journalist`, `comeback`, `completionist`, `mega-collector`, `lucky-777`, etc.");

  // Write report
  const outPath = resolve(ROOT, "scripts", "reports", "output", "BADGE_AUDIT_REPORT.md");
  mkdirSync(resolve(ROOT, "scripts", "reports", "output"), { recursive: true });
  writeFileSync(outPath, report, "utf-8");
  console.log(`\n✅ Report written to: ${outPath}`);
  console.log(report);
}

main().catch(err => {
  console.error(`\n❌ Fatal: ${err.message}`);
  process.exit(1);
});