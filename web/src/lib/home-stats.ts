import { unstable_cache } from 'next/cache';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * Public aggregate counters for the marketing homepage and the /stats page.
 *
 * All values come from the `public.home_stats()` RPC (see
 * supabase/migrations/20261024000000_home_stats.sql), which is SECURITY DEFINER
 * and granted to `anon`/`authenticated`, so no service-role key is needed.
 *
 * The whole thing is cached for a day: recomputing totals on every homepage
 * request would hammer Supabase with full-table counts for no good reason.
 */

export interface HomeStats {
  totalUsers: number;
  totalRatings: number;
  activeUrls: number;
  activeTags: number;
  totalServes: number;
}

async function fetchHomeStats(): Promise<HomeStats | null> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase.rpc('home_stats');
  if (error || !data || data.length === 0) return null;

  const row = data[0] as Record<string, unknown>;
  return {
    totalUsers: Number(row.total_users) || 0,
    totalRatings: Number(row.total_ratings) || 0,
    activeUrls: Number(row.active_urls) || 0,
    activeTags: Number(row.active_tags) || 0,
    totalServes: Number(row.total_serves) || 0,
  };
}

export const getHomeStats = unstable_cache(fetchHomeStats, ['home-stats'], {
  revalidate: 86400, // refresh daily
  tags: ['home-stats'],
});
