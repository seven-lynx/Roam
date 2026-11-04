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

/**
 * Compact rankings widget for the desktop: top explorers with a period toggle.
 * Links out to each explorer's profile; a footer links to the full
 * `/leaderboard` page.
 */
export function RankingsWidget({ limit = 5 }: { limit?: number }) {
  const [period, setPeriod] = useState<Period>('weekly');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchRankings() {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const res = await fetch(`${supabaseUrl}/functions/v1/leaderboard?period=${period}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}: Failed to load rankings`);
        if (!cancelled) setEntries((data?.entries ?? []).slice(0, limit));
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load rankings';
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchRankings();
    return () => {
      cancelled = true;
    };
  }, [period, limit]);

  return (
    <div className="widget">
      <div className="widget-head">
        <span className="widget-title">RANKINGS</span>
      </div>
      <div className="widget-body">
        <div className="flex gap-1 mb-2">
          {(Object.keys(periodLabels) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                period === p ? 'bg-panel-3 text-ink' : 'text-muted hover:bg-panel-2'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>

        {loading && <div className="widget-empty">Loading…</div>}
        {error && <div className="widget-chip text-danger text-xs p-2">{error}</div>}

        {!loading && !error && (
          <div className="flex flex-col gap-1">
            {entries.length === 0 && (
              <div className="widget-empty">No rankings yet. Be the first to roam!</div>
            )}
            {entries.map((entry) => {
              const isTop3 = entry.rank <= 3;
              return (
                <Link
                  key={entry.user_id}
                  href={`/u/${entry.username}`}
                  className={`rank-row flex items-center gap-3 px-3 py-2 transition-colors ${
                    isTop3 ? 'rank-row--top' : ''
                  }`}
                >
                  <span className="w-7 text-center font-bold tabular-nums text-ink">
                    {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-ink text-sm">
                    {entry.display_name || entry.username}
                  </span>
                  <span className="text-muted text-xs shrink-0">Lv.{entry.level}</span>
                  <span className="font-mono font-bold text-sm text-ink shrink-0">
                    {entry.xp_earned.toLocaleString()}
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        <Link href="/leaderboard" className="block text-center text-xs text-gold hover:underline mt-2">
          Full rankings →
        </Link>
        <div className="widget-foot">~/.roam/ranks.log · live standings</div>
      </div>
    </div>
  );
}
