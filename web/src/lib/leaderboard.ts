import { createClient } from '@/lib/supabase/client';

/** Snapshot period the `leaderboard` edge function ranks XP over. */
export type LeaderboardPeriod = 'weekly' | 'monthly' | 'all_time';

export interface LeaderboardEntry {
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

/** Periods in toggle order. */
export const LEADERBOARD_PERIODS: LeaderboardPeriod[] = ['weekly', 'monthly', 'all_time'];

export const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  weekly: 'This Week',
  monthly: 'This Month',
  all_time: 'All Time',
};

/** Body / error shape returned by the edge function and the platform gateway. */
interface LeaderboardResponse {
  entries?: LeaderboardEntry[];
  error?: string;
  message?: string;
  msg?: string;
}

/**
 * Fetch standings from the `leaderboard` edge function.
 *
 * That function is deployed with the default `verify_jwt = true`, so Supabase
 * rejects the request with a 401 at the platform gateway (before the handler
 * runs) unless it carries credentials. The desktop widget and `/leaderboard` are
 * both public, so signed-out visitors would otherwise always see
 * "HTTP 401: Failed to load rankings". We therefore always send the anon key as
 * `apikey` and fall back to it for `Authorization` — the same fallback the public
 * profile page uses. Sending only a bearer token is not enough, and sending a
 * `sb_publishable_…` key as a bearer is not a JWT, hence both headers.
 *
 * Only public profiles come back (the function filters `is_public` and caps the
 * result at 50), so the anon key exposes nothing the web UI would not render.
 *
 * @see supabase/functions/leaderboard/index.ts
 */
export async function fetchLeaderboard(
  period: LeaderboardPeriod = 'weekly',
): Promise<LeaderboardEntry[]> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !anonKey) {
    throw new Error('Rankings are unavailable right now.');
  }

  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? anonKey;

  const res = await fetch(`${base}/functions/v1/leaderboard?period=${period}`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
  });

  // The gateway's 401 has a JSON body but no `error` field, and a proxy failure
  // can be non-JSON entirely — never let either blow up as a parse error.
  const body = (await res.json().catch(() => null)) as LeaderboardResponse | null;

  if (!res.ok) {
    const reason = body?.error ?? body?.message ?? body?.msg;
    if (reason) throw new Error(reason);
    throw new Error(
      res.status === 401
        ? 'Rankings are temporarily unavailable.'
        : `HTTP ${res.status}: Failed to load rankings`,
    );
  }

  return body?.entries ?? [];
}