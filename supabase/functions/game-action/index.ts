// POST /functions/v1/game-action
// Body: { game: GameId, kind: 'level' | 'over' | 'win', runId, level?, score? }
//
// The single entry point for in-OS game XP. Games award ordinary Roam XP
// through apply_xp() — there is no separate "game XP" economy. The action
// string stays `game:<id>:<kind>` so evaluate-badges can read wins/scores.
// Also records a user_actions row (action_type 'game') for audit + challenges
// and fires badge evaluation.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const LEVEL_XP = 10
const WIN_XP = 100

const GAMES = new Set(['snake', 'minesweeper', 'tetris', 'asteroids', 'frogger', 'underweb', 'substrate'])

/** Game-over bonus: min(500, floor(score / 10)). */
function gameOverXp(score: number): number {
  const s = Math.max(0, Math.floor(score))
  return Math.min(500, Math.floor(s / 10))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  let body: { game?: unknown; kind?: unknown; runId?: unknown; level?: unknown; score?: unknown }
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const game = body.game as string
  const kind = body.kind as string
  const runId = typeof body.runId === 'string' ? body.runId : ''

  if (!GAMES.has(game)) return json({ error: 'Unknown game' }, 400)
  if (kind !== 'level' && kind !== 'over' && kind !== 'win') return json({ error: 'Invalid kind' }, 400)
  if (!runId) return json({ error: 'runId required' }, 400)

  const level = typeof body.level === 'number' ? Math.floor(body.level) : undefined
  const score = typeof body.score === 'number' ? Math.floor(body.score) : undefined

  const xp = kind === 'level' ? LEVEL_XP : kind === 'win' ? WIN_XP : gameOverXp(score ?? 0)
  if (xp <= 0) return json({ success: true, xpAwarded: 0 })

  const action = `game:${game}:${kind}`
  const idempotencyKey =
    kind === 'level'
      ? `game:${game}:${runId}:level:${level ?? 0}`
      : `game:${game}:${runId}:${kind}`
  const metadata = kind === 'level' ? { level } : kind === 'win' ? {} : { level, score }

  const svc = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  // Audit + challenge progress (service role bypasses the authenticated policy).
  try {
    await svc.from('user_actions').insert({
      user_id: user.id,
      action_type: 'game',
      metadata: { game, kind, runId },
    })
  } catch (e) {
    console.error('[game-action] user_actions insert failed:', e)
  }

  let xpAwarded = 0
  let newLevel: number | undefined
  let newXpTotal: number | undefined

  try {
    const { data, error } = await svc.rpc('apply_xp', {
      p_user_id: user.id,
      p_action: action,
      p_xp: xp,
      p_metadata: metadata,
      p_idempotency_key: idempotencyKey,
    })
    if (error) {
      console.warn('[game-action] apply_xp failed:', error.message)
    } else {
      const row = (Array.isArray(data) ? data[0] : data) as
        | { new_xp_total: number; new_level: number; xp_awarded: number }
        | null
        | undefined
      if (row) {
        xpAwarded = row.xp_awarded
        newLevel = row.new_level
        newXpTotal = row.new_xp_total
      }
    }
  } catch (e) {
    console.error('[game-action] apply_xp failed:', e)
  }

  // Fire-and-forget badge evaluation.
  EdgeRuntime.waitUntil((async () => {
    try {
      await svc.functions.invoke('evaluate-badges', { body: { user_id: user.id } })
    } catch { /* best effort */ }
  })())

  return json({ success: true, xpAwarded, newLevel, newXpTotal })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
