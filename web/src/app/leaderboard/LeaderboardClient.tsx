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
        const res = await fetch(
          `${supabaseUrl}/functions/v1/leaderboard?period=${period}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}: Failed to load leaderboard`);
        setEntries(data?.entries ?? []);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load leaderboard';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, [period]);

  return (
    <div className="min-h-full bg-screen">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-ink">Leaderboard</h1>
          <p className="text-sm text-muted mt-1">Top explorers on Roam</p>
        </div>

        <div className="flex gap-2 mb-6">
          {(Object.keys(periodLabels) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-panel bg-panel text-ink text-ink'
                  : 'bg-panel-2 text-muted hover:bg-panel-3'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
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

        {!loading && !error && (
          <div className="flex flex-col gap-2">
            {entries.length === 0 && (
              <div className="text-center py-16 text-muted">
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
                      ? 'border-gold border-gold bg-panel-2/50 bg-panel-2/20 hover:bg-panel-2 hover:bg-panel-2/30'
                      : 'border-line hover:bg-panel-2 hover:bg-panel-2/50'
                    }
                  `}
                >
                  <div className="w-8 text-center font-bold text-lg tabular-nums">
                    {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}
                  </div>

                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-info to-phosphor text-ink font-bold text-sm shrink-0">
                    {(entry.display_name || entry.username)[0]?.toUpperCase() ?? '?'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink truncate">
                      {entry.display_name || entry.username}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted">
                      <span>Lv.{entry.level}</span>
                      <span>🏅 {entry.badge_count}</span>
                      {entry.streak_days > 0 && <span>🔥 {entry.streak_days}</span>}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-mono font-bold text-sm text-ink">
                      {entry.xp_earned.toLocaleString()} XP
                    </p>
                    <p className="text-[10px] text-muted">{entry.xp_total.toLocaleString()} total</p>
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