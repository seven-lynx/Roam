/**
 * Game XP economy for the in-OS action games (RELAY / COMPILER / DEBRIS).
 *
 * Awards are variable (per-level + score-derived game-over bonus), so they go
 * through `award_game_xp` rather than the fixed `award_xp`. The pure functions
 * (`LEVEL_XP`, `gameOverXp`) are exported for unit tests and so the games can
 * show the exact amount a player is about to earn without touching the DB.
 */

import { createClient } from '@/lib/supabase/client';

export type GameId = 'snake' | 'tetris' | 'asteroids';

/** Flat XP awarded for clearing a single level (levels 1..100). */
export const LEVEL_XP = 10;

/** The highest level that still awards per-level XP; after this the run is endless. */
export const XP_LEVEL_CAP = 100;

/** Unique per-run id for idempotent XP awards (UUID when available). */
export function makeRunId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Game-over bonus XP, only awarded after a run has cleared `XP_LEVEL_CAP`.
 * `min(500, floor(score / 10))` — score is whatever the game reports.
 */
export function gameOverXp(score: number): number {
  const s = Math.max(0, Math.floor(score));
  return Math.min(500, Math.floor(s / 10));
}

export interface GameXpAward {
  xpAwarded: number;
  newLevel: number;
  newXpTotal: number;
}

export interface AwardGameXpInput {
  userId: string;
  game: GameId;
  kind: 'level' | 'over';
  runId: string;
  /** Current level (for the `level` award and idempotency). */
  level?: number;
  /** Final score (for the `over` award). */
  score?: number;
}

/**
 * Award XP for a game event. No-ops (resolves `null`) when there is no signed-in
 * user or the RPC fails, so games can fire-and-forget it safely.
 */
export async function awardGameXp(input: AwardGameXpInput): Promise<GameXpAward | null> {
  const { userId, game, kind, runId, level, score } = input;

  const xp = kind === 'level' ? LEVEL_XP : gameOverXp(score ?? 0);
  if (xp <= 0) return null;

  const action = `game:${game}:${kind}`;
  const idempotencyKey =
    kind === 'level'
      ? `game:${game}:${runId}:level:${level ?? 0}`
      : `game:${game}:${runId}:over`;

  const { data, error } = await createClient().rpc('award_game_xp', {
    p_user_id: userId,
    p_action: action,
    p_xp: xp,
    p_metadata: kind === 'level' ? { level } : { level, score },
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    console.warn('[game-xp] award failed', error);
    return null;
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { new_xp_total: number; new_level: number; xp_awarded: number }
    | null
    | undefined;
  if (!row) return null;

  return {
    xpAwarded: row.xp_awarded,
    newLevel: row.new_level,
    newXpTotal: row.new_xp_total,
  };
}
