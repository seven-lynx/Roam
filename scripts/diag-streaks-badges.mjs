#!/usr/bin/env node
/**
 * Diagnostic: Streak & Badge Health
 * Run: node scripts/diag-streaks-badges.mjs
 * Uses the same Supabase connection as the report suite.
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
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runQuery(label, fn) {
  console.log(`\n--- ${label} ---`);
  try {
    const { data, error } = await fn();
    if (error) {
      console.error(`  ERROR: ${error.message}`);
      return;
    }
    if (Array.isArray(data)) {
      if (data.length === 0) {
        console.log("  (no rows)");
      } else {
        console.table(data);
      }
    } else {
      console.log(data);
    }
  } catch (err) {
    console.error(`  EXCEPTION: ${err.message}`);
  }
}

async function main() {
  console.log("🔍 Streak & Badge Health Diagnostic\n");
  console.log(`Connected to: ${url}\n`);

  // 1. Streak check
  await runQuery("1. Streak overview (profiles table)", () =>
    sb.rpc("sql", {
      sql: `SELECT
        COUNT(*)::int AS total_users,
        COUNT(*) FILTER (WHERE streak_days > 0)::int AS users_with_active_streak,
        COUNT(*) FILTER (WHERE max_streak > 0)::int AS users_with_any_streak_history,
        ROUND(AVG(streak_days), 1)::float AS avg_streak,
        MAX(streak_days)::int AS max_streak_days,
        MAX(max_streak)::int AS best_streak_ever
      FROM profiles`
    }).catch(() => ({ data: null, error: { message: "sql RPC not available" } }))
  );

  // 2. Top streak users (direct query)
  await runQuery("2. Top 10 users by streak", () =>
    sb.from("profiles")
      .select("id, username, streak_days, max_streak, badge_count")
      .gt("streak_days", 0)
      .order("streak_days", { ascending: false })
      .limit(10)
  );

  // 3. Any non-zero streaks at all?
  const { count: streakUsers } = await sb.from("profiles")
    .select("*", { count: "exact", head: true })
    .gt("streak_days", 0);
  console.log(`\n--- 3. Users with streak_days > 0 ---`);
  console.log(`  Count: ${streakUsers}`);

  // 4. Badge count drift — top 5 users with mismatch
  const { data: profiles } = await sb.from("profiles")
    .select("id, username, badge_count")
    .limit(30);

  if (profiles) {
    console.log(`\n--- 4. Badge count drift (profiles.badge_count vs actual unlocked) ---`);
    const drifts = [];
    for (const p of profiles) {
      const { count: actual } = await sb.from("user_badges")
        .select("*", { count: "exact", head: true })
        .eq("user_id", p.id)
        .not("unlocked_at", "is", null);
      if ((actual ?? 0) !== (p.badge_count ?? 0)) {
        drifts.push({ username: p.username, profile_count: p.badge_count, actual_unlocked: actual });
      }
    }
    if (drifts.length === 0) {
      console.log("  ✅ All badge counts match!");
    } else {
      console.table(drifts.slice(0, 15));
    }
  }

  // 5. Streak badges: unlocked vs in-progress
  const { data: streakBadges } = await sb.from("badges")
    .select("id, slug, name")
    .eq("category", "streaks");

  if (streakBadges) {
    console.log(`\n--- 5. Streak badge stats ---`);
    const results = [];
    for (const b of streakBadges) {
      const { count: unlocked } = await sb.from("user_badges")
        .select("*", { count: "exact", head: true })
        .eq("badge_id", b.id)
        .not("unlocked_at", "is", null);
      const { count: inProgress } = await sb.from("user_badges")
        .select("*", { count: "exact", head: true })
        .eq("badge_id", b.id)
        .is("unlocked_at", null);
      const { count: total } = await sb.from("user_badges")
        .select("*", { count: "exact", head: true })
        .eq("badge_id", b.id);
      results.push({ slug: b.slug, unlocked: unlocked ?? 0, in_progress: inProgress ?? 0, total_rows: total ?? 0 });
    }
    console.table(results);
  }

  // 6. Streak badges with NULL unlocked_at but qualifying progress
  const { data: ghostBadges } = await sb.from("user_badges")
    .select("user_id, badge_id, progress_current")
    .is("unlocked_at", null)
    .gte("progress_current", 3)
    .limit(20);

  if (ghostBadges && ghostBadges.length > 0) {
    console.log(`\n--- 6. ⚠ Ghost badges (NULL unlocked_at, qualifies for unlock) ---`);
    console.log(`  Found ${ghostBadges.length} rows`);
    // Enrich with badge names
    const badgeIds = [...new Set(ghostBadges.map(r => r.badge_id))];
    const { data: badgeInfo } = await sb.from("badges").select("id, slug, name, category").in("id", badgeIds);
    const badgeMap = new Map((badgeInfo || []).map(b => [b.id, b]));
    for (const g of ghostBadges.slice(0, 15)) {
      const b = badgeMap.get(g.badge_id);
      console.log(`    user=${g.user_id.slice(0,8)}... badge=${b?.slug ?? g.badge_id} progress=${g.progress_current} (${b?.name ?? '?'})`);
    }
  } else {
    console.log(`\n--- 6. Ghost badge check ---`);
    console.log("  ✅ No qualifying badges with NULL unlocked_at");
  }

  // 7. user_daily_activity
  const { count: dailyRows } = await sb.from("user_daily_activity")
    .select("*", { count: "exact", head: true });
  console.log(`\n--- 7. user_daily_activity rows ---`);
  console.log(`  Total rows: ${dailyRows}`);

  const { data: recentActivity } = await sb.from("user_daily_activity")
    .select("date, user_id, roam_count")
    .gte("date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
    .order("date", { ascending: false })
    .limit(20);

  if (recentActivity && recentActivity.length > 0) {
    console.log(`  Recent activity (last 7 days):`);
    console.table(recentActivity);
  } else {
    console.log(`  ⚠ No daily_activity in the last 7 days!`);
  }

  // 8. Check for functions
  await runQuery("8. Check update_streak RPC", () =>
    sb.rpc("update_streak", { p_user_id: "00000000-0000-0000-0000-000000000000" })
      .then(() => ({ data: "✅ update_streak works", error: null }))
      .catch(e => ({ data: null, error: { message: `❌ update_streak failed: ${e.message}` } }))
  );

  await runQuery("9. Check sync_profile_badge_count RPC", () =>
    sb.rpc("sync_profile_badge_count", { p_user_id: "00000000-0000-0000-0000-000000000000" })
      .then(() => ({ data: "✅ sync_profile_badge_count works", error: null }))
      .catch(e => ({ data: null, error: { message: `❌ sync_profile_badge_count failed: ${e.message}` } }))
  );

  console.log("\n✅ Diagnostic complete.\n");
}

main().catch(err => {
  console.error(`\n❌ Fatal: ${err.message}`);
  process.exit(1);
});