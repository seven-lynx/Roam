"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChallengeCard } from "./ChallengeCard";

interface ChallengeData {
  instance_id: string;
  progress_current: number;
  completed_at: string | null;
  challenge: {
    id: string;
    key: string;
    title: string;
    goal_description: string;
    goal_count: number;
    xp_reward: number;
    type: "daily" | "weekly" | "monthly";
    expires_at: string;
  };
}

export function ChallengeWidget() {
  const [challenges, setChallenges] = useState<ChallengeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchChallenges() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setLoading(false);
          return;
        }

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/challenges`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        );
        if (!res.ok) throw new Error("Failed to load challenges");
        const json = await res.json();
        setChallenges(json.challenges ?? []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    fetchChallenges();
  }, []);

  if (loading) {
    return (
      <div className="w-full py-4">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-32 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-lg bg-gray-200 dark:bg-gray-700" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || challenges.length === 0) {
    return null; // Don't render anything if no challenges or error
  }

  const dailies = challenges.filter((c) => c.challenge.type === "daily");
  const weeklies = challenges.filter((c) => c.challenge.type === "weekly");
  const monthlies = challenges.filter((c) => c.challenge.type === "monthly");

  return (
    <div className="w-full py-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
        Challenges
      </h2>

      {dailies.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            Daily
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {dailies.map((c) => (
              <ChallengeCard
                key={c.instance_id}
                title={c.challenge.title}
                goalDescription={c.challenge.goal_description}
                goalCount={c.challenge.goal_count}
                progressCurrent={c.progress_current}
                xpReward={c.challenge.xp_reward}
                isCompleted={!!c.completed_at}
                type={c.challenge.type}
              />
            ))}
          </div>
        </div>
      )}

      {weeklies.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            Weekly
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {weeklies.map((c) => (
              <ChallengeCard
                key={c.instance_id}
                title={c.challenge.title}
                goalDescription={c.challenge.goal_description}
                goalCount={c.challenge.goal_count}
                progressCurrent={c.progress_current}
                xpReward={c.challenge.xp_reward}
                isCompleted={!!c.completed_at}
                type={c.challenge.type}
              />
            ))}
          </div>
        </div>
      )}

      {monthlies.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            Monthly
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {monthlies.map((c) => (
              <ChallengeCard
                key={c.instance_id}
                title={c.challenge.title}
                goalDescription={c.challenge.goal_description}
                goalCount={c.challenge.goal_count}
                progressCurrent={c.progress_current}
                xpReward={c.challenge.xp_reward}
                isCompleted={!!c.completed_at}
                type={c.challenge.type}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}