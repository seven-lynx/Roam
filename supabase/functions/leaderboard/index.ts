// GET /functions/v1/leaderboard?period=weekly|monthly|all_time
// Returns top 50 users by XP for the given period.
// Optionally refreshes the snapshot if it's stale (> 1 hour old).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

interface LeaderboardEntry {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  xp_total: number
  level: number
  badge_count: number
  streak_days: number
  xp_earned: number
}

Deno.serve(async (req) => {
  const headers = getCorsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  const url = new URL(req.url)
  const period = url.searchParams.get('period') || 'all_time'
  if (!['weekly', 'monthly', 'all_time'].includes(period)) {
    return json({ error: 'Invalid period. Use weekly, monthly, or all_time.' }, 400)
  }

  try {
    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    )

    // Check if we have a fresh snapshot (< 1 hour old)
    const { data: existing } = await supabase
      .from('leaderboard_snapshots')
      .select('snapshot_at')
      .eq('period', period)
      .order('snapshot_at', { ascending: false })
      .limit(1)

    const isStale = !existing || existing.length === 0 ||
      (Date.now() - new Date(existing[0].snapshot_at).getTime()) > 60 * 60 * 1000

    if (isStale) {
      await refreshSnapshot(supabase, period)
    }

    // Fetch the latest snapshot
    const { data: rankings, error } = await supabase
      .from('leaderboard_snapshots')
      .select(`
        rank,
        user_id,
        xp_earned,
        badge_count,
        profiles!inner(username, display_name, avatar_url, xp_total, level, streak_days)
      `)
      .eq('period', period)
      .order('rank', { ascending: true })
      .limit(50)

    if (error) throw error

    const entries: LeaderboardEntry[] = (rankings || []).map((r: Record<string, unknown>) => {
      const profile = (r.profiles || {}) as Record<string, unknown>
      return {
        rank: r.rank as number,
        user_id: r.user_id as string,
        username: profile.username as string,
        display_name: profile.display_name as string | null,
        avatar_url: profile.avatar_url as string | null,
        xp_total: profile.xp_total as number,
        level: profile.level as number,
        badge_count: r.badge_count as number,
        streak_days: profile.streak_days as number,
        xp_earned: r.xp_earned as number,
      }
    })

    return json({ period, entries, updated_at: new Date().toISOString() })
  } catch (e) {
    console.error('leaderboard error', e)
    return json({ error: 'Failed to fetch leaderboard' }, 500)
  }
})

// deno-lint-ignore no-explicit-any
async function refreshSnapshot(supabase: any, period: string) {
  const snapshotAt = new Date().toISOString()

  let xpQuery = supabase.from('xp_log').select('user_id, xp_awarded')

  if (period === 'weekly') {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    xpQuery = xpQuery.gte('created_at', weekAgo)
  } else if (period === 'monthly') {
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    xpQuery = xpQuery.gte('created_at', monthAgo)
  }

  const { data: xpData, error: xpError } = await xpQuery
  if (xpError) {
    console.error('xp query failed', xpError)
    return
  }

  // Aggregate XP per user
  const userXp = new Map<string, number>()
  for (const row of xpData || []) {
    const uid = row.user_id as string
    userXp.set(uid, (userXp.get(uid) || 0) + (row.xp_awarded as number))
  }

  // Get badge counts
  const { data: badgeData } = await supabase
    .from('user_badges')
    .select('user_id')
    .not('unlocked_at', 'is', null)

  const userBadges = new Map<string, number>()
  for (const row of badgeData || []) {
    const uid = row.user_id as string
    userBadges.set(uid, (userBadges.get(uid) || 0) + 1)
  }

  // Sort by XP, assign ranks
  const sorted = Array.from(userXp.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([user_id, xp], index) => ({
      user_id,
      xp_earned: xp,
      badge_count: userBadges.get(user_id) || 0,
      rank: index + 1,
    }))
    .slice(0, 100)

  if (sorted.length > 0) {
    // Clear old snapshot for this period
    await supabase.from('leaderboard_snapshots').delete().eq('period', period)

    // Insert new snapshot
    const { error: insertError } = await supabase.from('leaderboard_snapshots').insert(
      sorted.map((s) => ({
        period,
        user_id: s.user_id,
        xp_earned: s.xp_earned,
        badge_count: s.badge_count,
        rank: s.rank,
        snapshot_at: snapshotAt,
      }))
    )
    if (insertError) {
      console.error('leaderboard insert failed', insertError)
    }
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(null), 'Content-Type': 'application/json' },
  })
}
