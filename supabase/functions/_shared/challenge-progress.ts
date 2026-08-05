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
            goal_count,
            title,
            xp_reward
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
      const instance = uc.challenge_instances;
      if (!instance?.challenges) continue;

      const challenge = instance.challenges;
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

      const isCompleted = newProgress >= challenge.goal_count;
      const updateData: Record<string, unknown> = { progress_current: newProgress };
      if (isCompleted) {
        updateData.completed_at = now.toISOString();
      }

      const { error: updateErr } = await client
        .from("user_challenges")
        .update(updateData)
        .eq("user_id", userId)
        .eq("instance_id", uc.instance_id);

      if (updateErr) {
        console.error(`Failed to update challenge progress for user ${userId}:`, updateErr);
        continue;
      }

      // If just completed, award XP and send notification
      if (isCompleted) {
        const xp = (challenge as any).xp_reward ?? 50;
        const challengeTitle = (challenge as any).title ?? "Challenge";

        try {
          // Award XP
          await client.from("xp_log").insert({
            user_id: userId,
            action: "challenge_reward",
            xp_awarded: xp,
            metadata: { challenge_key: challenge.challenge_key, challenge_title: challengeTitle },
          });

          // Recalculate total XP + level
          const { data: xpRows } = await client
            .from("xp_log")
            .select("xp_awarded")
            .eq("user_id", userId);
          const newXp = (xpRows ?? []).reduce((s: number, r: any) => s + r.xp_awarded, 0);
          await client.from("profiles").update({
            xp_total: newXp,
            level: Math.floor(Math.sqrt(newXp / 100)) + 1,
          }).eq("id", userId);

          // Insert notification
          await client.from("notifications").insert({
            user_id: userId,
            type: "challenge_complete",
            title: `Challenge Complete: ${challengeTitle}!`,
            body: `+${xp} XP earned`,
            data: { challenge_key: challenge.challenge_key, xp },
          });

          console.log(`Challenge completed for ${userId}: ${challenge.challenge_key}`);
        } catch (rewardErr) {
          console.error(`Failed to award XP/notification for ${userId}:`, rewardErr);
        }
      }
    }
  } catch (err) {
    console.error("incrementChallengeProgress error:", err);
  }
}