// Edge function: cron-daily-challenges
// Runs daily at 00:00 UTC. Handles challenge rotation:
//   - Daily: creates global daily instances, assigns 1-3 per user
//   - Weekly (Monday): creates global weekly challenge instances
//   - Monthly (1st): creates global monthly challenge instances
//
// Deploy: npx supabase functions deploy cron-daily-challenges
// Schedule: run once per day via Supabase cron
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── Helpers ──────────────────────────────────────────────────────────

function getUTCDate(): Date {
  return new Date();
}

function getStartOfDayUTC(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function getEndOfDayUTC(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d.toISOString();
}

function getStartOfNextWeekUTC(date: Date): string {
  // Find next Monday 00:00 UTC
  const d = new Date(date);
  const day = d.getUTCDay();
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function getStartOfNextMonthUTC(date: Date): string {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + 1, 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function isMonday(date: Date): boolean {
  return date.getUTCDay() === 1;
}

function isFirstOfMonth(date: Date): boolean {
  return date.getUTCDate() === 1;
}

// Weighted random draw — picks `count` items from array using weight field
function weightedRandomDraw<T extends { weight: number }>(items: T[], count: number): T[] {
  if (items.length <= count) return [...items];

  const result: T[] = [];
  const available = items.map((item, idx) => ({ item, idx, weight: item.weight || 1 }));
  const totalWeight = available.reduce((sum, a) => sum + a.weight, 0);

  for (let i = 0; i < count; i++) {
    if (available.length === 0) break;
    let rand = Math.random() * totalWeight;
    let selectedIdx = 0;
    for (let j = 0; j < available.length; j++) {
      rand -= available[j].weight;
      if (rand <= 0) {
        selectedIdx = j;
        break;
      }
    }
    result.push(available[selectedIdx].item);
    available.splice(selectedIdx, 1);
  }

  return result;
}

// ── Main handler ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    );

    const now = getUTCDate();
    const todayStart = getStartOfDayUTC(now);
    const todayEnd = getEndOfDayUTC(now);

    const results: Record<string, unknown> = {};

    // ── 1. Cleanup: delete expired challenge instances ────────────────
    // CASCADE deletes their user_challenges rows too.
    const { error: deleteErr, count: deletedCount } = await supabase
      .from("challenge_instances")
      .delete({ count: "exact" })
      .lt("expires_at", todayStart);

    if (deleteErr) {
      console.error("Failed to delete expired instances:", deleteErr);
      results.expired_delete_error = deleteErr.message;
    } else {
      results.expired_instances_deleted = deletedCount ?? 0;
      console.log(`Deleted ${deletedCount} expired challenge instances`);
    }

    // ── 1b. Safety net: delete orphaned user_challenges (no matching instance) ─
    // Fetch all user_challenges and all instances, then delete orphans in JS.
    // This is a belt-and-suspenders safety net — the CASCADE from step 1 handles
    // the normal case. This catches any edge cases from partial failures.
    try {
      const { data: allUc } = await supabase
        .from("user_challenges")
        .select("user_id, instance_id");

      const { data: allInstances } = await supabase
        .from("challenge_instances")
        .select("id");

      if (allUc && allUc.length > 0) {
        const validIds = new Set((allInstances ?? []).map((i) => i.id));
        const orphanKeys: { user_id: string; instance_id: string }[] = [];

        for (const uc of allUc) {
          if (!validIds.has(uc.instance_id)) {
            orphanKeys.push({ user_id: uc.user_id, instance_id: uc.instance_id });
          }
        }

        if (orphanKeys.length > 0) {
          let deletedCount = 0;
          // Delete orphans individually by composite key (user_id, instance_id)
          for (const orphan of orphanKeys) {
            const { error: orphanErr } = await supabase
              .from("user_challenges")
              .delete()
              .eq("user_id", orphan.user_id)
              .eq("instance_id", orphan.instance_id);

            if (orphanErr) {
              console.error(`Failed to delete orphan (${orphan.user_id}, ${orphan.instance_id}):`, orphanErr);
            } else {
              deletedCount++;
            }
          }
          results.orphan_user_challenges_deleted = deletedCount;
          console.log(`Deleted ${deletedCount} orphaned user_challenges`);
        }
      }
    } catch (orphanCatchErr) {
      console.error("Orphan cleanup failed:", orphanCatchErr);
      results.orphan_cleanup_error = String(orphanCatchErr);
    }

    // ── Fetch all active profiles once (used by daily, weekly, monthly) ─
    const { data: profiles, error: profilesErr } = await supabase
      .from("profiles")
      .select("id");

    if (profilesErr) {
      console.error("Failed to fetch profiles:", profilesErr);
      results.profiles_error = profilesErr.message;
    }

    const userIds = profiles ? profiles.map((p) => p.id) : [];

    // ── 2. Daily challenges: global instances + per-user assignment ───
    try {
      // Delete any existing daily global instances (should already be gone from step 1,
      // but ensures clean slate)
      const { error: delDailyErr } = await supabase
        .from("challenge_instances")
        .delete()
        .eq("challenge_type", "daily")
        .eq("is_global", true);

      if (delDailyErr) {
        console.error("Failed to delete old daily instances:", delDailyErr);
        results.daily_delete_error = delDailyErr.message;
      }

      const { data: dailyChallenges, error: dailyErr } = await supabase
        .from("challenges")
        .select("id, weight")
        .eq("challenge_type", "daily");

      if (dailyErr) {
        console.error("Failed to fetch daily challenges:", dailyErr);
        results.daily_error = dailyErr.message;
      } else if (dailyChallenges && dailyChallenges.length > 0) {
        // Create ALL daily challenges as global instances (one per challenge)
        const instanceIds: string[] = [];
        for (const challenge of dailyChallenges) {
          const { data: instance, error: instanceErr } = await supabase
            .from("challenge_instances")
            .insert({
              challenge_id: challenge.id,
              challenge_type: "daily",
              starts_at: todayStart,
              expires_at: todayEnd,
              is_global: true,
            })
            .select("id")
            .single();

          if (instanceErr || !instance) {
            console.error(`Failed to create daily instance for ${challenge.id}:`, instanceErr);
            continue;
          }
          instanceIds.push(instance.id);
        }

        results.daily_instances_created = instanceIds.length;
        console.log(`Created ${instanceIds.length} daily global instances`);

        // Assign 1-3 random challenges to each user in batches
        if (instanceIds.length > 0 && userIds.length > 0) {
          let totalAssigned = 0;
          const BATCH_SIZE = 100;

          for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
            const batch = userIds.slice(i, i + BATCH_SIZE);
            const ucInserts: Record<string, unknown>[] = [];

            for (const userId of batch) {
              const count = Math.floor(Math.random() * 3) + 1; // 1-3
              // Shuffle instance IDs and pick `count`
              const shuffled = [...instanceIds].sort(() => Math.random() - 0.5);
              const picked = shuffled.slice(0, Math.min(count, shuffled.length));

              for (const instanceId of picked) {
                ucInserts.push({
                  user_id: userId,
                  instance_id: instanceId,
                  progress_current: 0,
                });
              }
            }

            if (ucInserts.length > 0) {
              const { error: ucErr } = await supabase
                .from("user_challenges")
                .insert(ucInserts);

              if (ucErr) {
                console.error(`Failed to insert daily user_challenges batch ${i}:`, ucErr);
              } else {
                totalAssigned += ucInserts.length;
              }
            }
          }

          results.daily_user_challenges_created = totalAssigned;
          console.log(`Assigned ${totalAssigned} daily user_challenges across ${userIds.length} users`);
        }
      }
    } catch (dailyCatchErr) {
      console.error("Daily challenges section failed:", dailyCatchErr);
      results.daily_section_error = String(dailyCatchErr);
    }

    // ── 3. Weekly challenges (Monday only) ────────────────────────────
    try {
      if (isMonday(now)) {
        // Delete old weekly global instances (they cascade to user_challenges)
        const { error: delWeekErr } = await supabase
          .from("challenge_instances")
          .delete()
          .eq("challenge_type", "weekly")
          .eq("is_global", true);

        if (delWeekErr) {
          console.error("Failed to delete old weekly instances:", delWeekErr);
        }

        const { data: weeklyChallenges, error: weeklyErr } = await supabase
          .from("challenges")
          .select("id, weight")
          .eq("challenge_type", "weekly");

        if (weeklyErr) {
          console.error("Failed to fetch weekly challenges:", weeklyErr);
          results.weekly_error = weeklyErr.message;
        } else if (weeklyChallenges && weeklyChallenges.length > 0) {
          const nextMonday = getStartOfNextWeekUTC(now);
          const drawn = weightedRandomDraw(weeklyChallenges, Math.min(5, weeklyChallenges.length));

          let weeklyCount = 0;
          let weeklyUserCount = 0;
          for (const challenge of drawn) {
            const { data: instance, error: instanceErr } = await supabase
              .from("challenge_instances")
              .insert({
                challenge_id: challenge.id,
                challenge_type: "weekly",
                starts_at: todayStart,
                expires_at: nextMonday,
                is_global: true,
              })
              .select("id")
              .single();

            if (instanceErr || !instance) {
              console.error("Failed to create weekly instance:", instanceErr);
              continue;
            }

            weeklyCount++;

            // Create user_challenges rows for all active users
            if (userIds.length > 0) {
              for (let i = 0; i < userIds.length; i += 50) {
                const batch = userIds.slice(i, i + 50);
                const ucInserts = batch.map((uid) => ({
                  user_id: uid,
                  instance_id: instance.id,
                  progress_current: 0,
                }));
                const { error: ucErr } = await supabase
                  .from("user_challenges")
                  .insert(ucInserts);
                if (ucErr) {
                  console.error("Failed to create weekly user_challenges:", ucErr);
                } else {
                  weeklyUserCount += batch.length;
                }
              }
            }
          }

          results.weekly_created = weeklyCount;
          results.weekly_user_challenges = weeklyUserCount;
          console.log(`Weekly: ${weeklyCount} instances, ${weeklyUserCount} user_challenges`);
        }
      }
    } catch (weeklyCatchErr) {
      console.error("Weekly challenges section failed:", weeklyCatchErr);
      results.weekly_section_error = String(weeklyCatchErr);
    }

    // ── 4. Monthly challenges (1st of month only) ─────────────────────
    try {
      if (isFirstOfMonth(now)) {
        const { error: delMonthErr } = await supabase
          .from("challenge_instances")
          .delete()
          .eq("challenge_type", "monthly")
          .eq("is_global", true);

        if (delMonthErr) {
          console.error("Failed to delete old monthly instances:", delMonthErr);
        }

        const { data: monthlyChallenges, error: monthlyErr } = await supabase
          .from("challenges")
          .select("id, weight")
          .eq("challenge_type", "monthly");

        if (monthlyErr) {
          console.error("Failed to fetch monthly challenges:", monthlyErr);
          results.monthly_error = monthlyErr.message;
        } else if (monthlyChallenges && monthlyChallenges.length > 0) {
          const nextMonth = getStartOfNextMonthUTC(now);
          const drawn = weightedRandomDraw(monthlyChallenges, Math.min(6, monthlyChallenges.length));

          let monthlyCount = 0;
          let monthlyUserCount = 0;
          for (const challenge of drawn) {
            const { data: instance, error: instanceErr } = await supabase
              .from("challenge_instances")
              .insert({
                challenge_id: challenge.id,
                challenge_type: "monthly",
                starts_at: todayStart,
                expires_at: nextMonth,
                is_global: true,
              })
              .select("id")
              .single();

            if (instanceErr || !instance) {
              console.error("Failed to create monthly instance:", instanceErr);
              continue;
            }

            monthlyCount++;

            // Create user_challenges rows for all active users
            if (userIds.length > 0) {
              for (let i = 0; i < userIds.length; i += 50) {
                const batch = userIds.slice(i, i + 50);
                const ucInserts = batch.map((uid) => ({
                  user_id: uid,
                  instance_id: instance.id,
                  progress_current: 0,
                }));
                const { error: ucErr } = await supabase
                  .from("user_challenges")
                  .insert(ucInserts);
                if (ucErr) {
                  console.error("Failed to create monthly user_challenges:", ucErr);
                } else {
                  monthlyUserCount += batch.length;
                }
              }
            }
          }

          results.monthly_created = monthlyCount;
          results.monthly_user_challenges = monthlyUserCount;
          console.log(`Monthly: ${monthlyCount} instances, ${monthlyUserCount} user_challenges`);
        }
      }
    } catch (monthlyCatchErr) {
      console.error("Monthly challenges section failed:", monthlyCatchErr);
      results.monthly_section_error = String(monthlyCatchErr);
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("cron-daily-challenges error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});