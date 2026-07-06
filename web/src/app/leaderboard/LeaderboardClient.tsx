'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Period = 'weekly' | 'monthly' | 'all_time';

interface Entry {
  rank: number;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  xp_total: number;
  level: number;
  badge_count: number;
  streak_days: number;
  xp_earned: number;
}

const periodLabels: Record<Period, string> = {
  weekly: 'This Week',
  monthly: 'This Month',
  all_time: 'All Time',
};

export function LeaderboardClient() {
  const [period, setPeriod] = useState<Period>('weekly');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const fetchUrl = `${supabaseUrl}/functions/v1/leaderboard?period=${period}`;

        console.log('[leaderboard] Fetching:', fetchUrl, '| hasToken:', !!token);

        const res = await fetch(fetchUrl, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        console.log('[leaderboard] Response status:', res.status, '| type:', res.type);

        const data = await res.json();
        if (!res.ok) {
          console.error('[leaderboard] API error:', data);
          throw new Error(data.error || `HTTP ${res.status}: Failed to load leaderboard`);
        }

        console.log('[leaderboard] Entries received:', data?.entries?.length ?? 0);
        setEntries(data?.entries ?? []);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load leaderboard';
        console.error('[leaderboard] Fetch failed:', e);
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, [period]);

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-white dark:bg-zinc-950">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Leaderboard</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Top explorers on Roam</p>
        </div>

        <div className="flex gap-2 mb-6">
          {(Object.keys(periodLabels) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-900 dark:border-t-white" />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="flex flex-col gap-2">
            {entries.length === 0 && (
              <div className="text-center py-16 text-zinc-500 dark:text-zinc-400">
                <span className="text-4xl block mb-3">🏆</span>
                <p className="text-sm">No rankings yet. Be the first to roam!</p>
              </div>
            )}

            {entries.map((entry) => {
              const isTop3 = entry.rank <= 3;
              return (
                <Link
                  key={entry.user_id}
                  href={`/u/${entry.username}`}
                  className={`
                    rounded-xl border transition-colors p-4 flex items-center gap-4
                    ${isTop3
                      ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                      : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                    }
                  `}
                >
                  <div className="w-8 text-center font-bold text-lg tabular-nums">
                    {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}
                  </div>

                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 text-white font-bold text-sm shrink-0">
                    {(entry.display_name || entry.username)[0]?.toUpperCase() ?? '?'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-zinc-900 dark:text-white truncate">
                      {entry.display_name || entry.username}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>Lv.{entry.level}</span>
                      <span>🏅 {entry.badge_count}</span>
                      {entry.streak_days > 0 && <span>🔥 {entry.streak_days}</span>}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-mono font-bold text-sm text-zinc-900 dark:text-white">
                      {entry.xp_earned.toLocaleString()} XP
                    </p>
                    <p className="text-[10px] text-zinc-400">{entry.xp_total.toLocaleString()} total</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}