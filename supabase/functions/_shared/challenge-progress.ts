// Shared utility: increment challenge progress for a user
// Used by action edge functions (roam, save-url, follow, etc.) to update
// user_challenges after each action.
//
// Usage:
//   import { incrementChallengeProgress } from "../_shared/challenge-progress.ts";
//   EdgeRuntime.waitUntil(incrementChallengeProgress(client, userId, "roam_count", {}));

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function incrementChallengeProgress(
  client: SupabaseClient,
  userId: string,
  conditionType: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const now = new Date();

    // Determine current time restriction for time-based challenges
    const hour = now.getUTCHours();
    let timeRestriction: string | null = null;
    if (hour >= 5 && hour < 10) timeRestriction = "morning";      // 5am-10am UTC = ~1am-6am ET? 
    // Actually, use server-local time reasoning. The cron runs at 00 UTC.
    // Time restrictions are based on user's local time, but we approximate
    // using UTC hour ranges that roughly map to US timezones.
    // Morning: 10-14 UTC (~6am-10am ET), Afternoon: 16-20 UTC (~12pm-4pm ET),
    // Evening: 20-00 UTC (~4pm-8pm ET), Night: 02-10 UTC (~10pm-6am ET)
    // Weekend: day 0 (Sun) or 6 (Sat)
    const utcHour = now.getUTCHours();
    const utcDay = now.getUTCDay();

    if (utcHour >= 10 && utcHour < 14) timeRestriction = "morning";
    else if (utcHour >= 16 && utcHour < 20) timeRestriction = "afternoon";
    else if (utcHour >= 20 && utcHour < 24) timeRestriction = "evening";
    else timeRestriction = "night";

    const isWeekend = utcDay === 0 || utcDay === 6;

    // Find active, uncompleted user_challenges matching the condition_type
    const { data: activeChallenges, error } = await client
      .from("user_challenges")
      .select(`
        instance_id,
        progress_current,
        challenge_instances!inner(
          id,
          expires_at,
          challenges!inner(
            id,
            challenge_key,
            condition_type,
            time_restriction,
            goal_count
          )
        )
      `)
      .eq("user_id", userId)
      .is("completed_at", null)
      .eq("challenge_instances.challenges.condition_type", conditionType)
      .gt("challenge_instances.expires_at", now.toISOString());

    if (error || !activeChallenges || activeChallenges.length === 0) {
      return;
    }

    for (const uc of activeChallenges) {
      // Skip if already completed
      if (!uc.challenge_instances?.challenges) continue;

      const challenge = uc.challenge_instances.challenges;
      const timeReq = challenge.time_restriction;

      // Check time restriction
      if (timeReq) {
        if (timeReq === "weekend" && !isWeekend) continue;
        if (timeReq !== "weekend" && timeReq !== timeRestriction) continue;
      }

      // Increment progress (don't exceed goal_count)
      const newProgress = Math.min(
        (uc.progress_current || 0) + 1,
        challenge.goal_count,
      );

      const { error: updateErr } = await client
        .from("user_challenges")
        .update({ progress_current: newProgress })
        .eq("user_id", userId)
        .eq("instance_id", uc.instance_id);

      if (updateErr) {
        console.error(`Failed to update challenge progress for user ${userId}:`, updateErr);
      }
    }
  } catch (err) {
    console.error("incrementChallengeProgress error:", err);
  }
}