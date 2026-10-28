'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChallengeCard } from '@/components/challenges/ChallengeCard';

interface ChallengeInfo {
  id: string;
  key: string;
  title: string;
  goal_description: string | null;
  goal_count: number;
  xp_reward: number;
  type: 'daily' | 'weekly' | 'monthly';
  condition_type?: string;
  time_restriction?: string | null;
  expires_at: string;
}

interface ChallengeData {
  instance_id: string;
  progress_current: number;
  completed_at: string | null;
  challenge: ChallengeInfo;
}

const SECTIONS: { type: 'daily' | 'weekly' | 'monthly'; label: string }[] = [
  { type: 'daily', label: 'Daily' },
  { type: 'weekly', label: 'Weekly' },
  { type: 'monthly', label: 'Monthly' },
];

export function ChallengesClient() {
  const [challenges, setChallenges] = useState<ChallengeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setSignedIn(false);
          return;
        }
        setSignedIn(true);
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/challenges`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        if (!res.ok) throw new Error('Failed to load challenges');
        const json = await res.json();
        setChallenges(json.challenges ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load challenges');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-full bg-screen">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-ink">Challenges</h1>
          <p className="text-sm text-muted mt-1">
            Complete daily, weekly, and monthly goals to earn bonus XP.
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-line border-line border-t-line border-t-line" />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-danger border-danger bg-panel-2 bg-panel-2/30 p-4 text-sm text-danger text-danger">
            {error}
          </div>
        )}

        {!loading && !error && !signedIn && (
          <div className="text-center py-16 text-muted">
            <p className="text-sm">Sign in to see your challenges.</p>
          </div>
        )}

        {!loading && !error && signedIn && challenges.length === 0 && (
          <div className="text-center py-16 text-muted">
            <p className="text-sm">No active challenges. Come back later!</p>
          </div>
        )}

        {!loading && !error && signedIn && challenges.length > 0 && (
          <div className="flex flex-col gap-8">
            {SECTIONS.map((section) => {
              const items = challenges.filter((c) => c.challenge.type === section.type);
              if (items.length === 0) return null;
              return (
                <section key={section.type}>
                  <h2 className="text-sm font-medium text-muted mb-2">
                    {section.label}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {items.map((c) => (
                      <ChallengeCard
                        key={c.instance_id}
                        title={c.challenge.title}
                        goalDescription={c.challenge.goal_description ?? ''}
                        goalCount={c.challenge.goal_count}
                        progressCurrent={c.progress_current}
                        xpReward={c.challenge.xp_reward}
                        isCompleted={!!c.completed_at}
                        type={c.challenge.type}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
