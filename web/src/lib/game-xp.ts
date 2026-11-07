/**
 * Game XP for the in-OS games (RELAY / BOTFIELD / COMPILER / DEBRIS /
 * FIREWALK / UNDERWEB / SUBSTRATE).
 *
 * Games award ordinary Roam XP through the unified `game-action` edge function
 * (which calls `apply_xp`), not a separate game-XP economy. The pure functions
 * (`LEVEL_XP`, `WIN_XP`, `gameOverXp`) are exported for unit tests and so the
 * games can show the exact amount a player is about to earn without touching
 * the DB.
 */

import { createClient } from '@/lib/supabase/client';

export type GameId =
  | 'snake'
  | 'minesweeper'
  | 'tetris'
  | 'asteroids'
  | 'frogger'
  | 'underweb'
  | 'substrate';

/** Flat XP awarded for clearing a single level (levels 1..100). */
export const LEVEL_XP = 10;

/**
 * Flat XP awarded for winning a game — a text adventure's completion, or an
 * arcade game clearing `WIN_LEVEL` (they have no natural end state).
 */
export const WIN_XP = 100;

/**
 * Arcade games (RELAY / COMPILER / DEBRIS / FIREWALK) are endless, so "win"
 * is defined as clearing this level. Level 10 is near the difficulty cap for
 * all four (see each game's speed ramp), so the win badge is a real milestone
 * rather than a trivial clear.
 */
export const WIN_LEVEL = 10;

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
  kind: 'level' | 'over' | 'win';
  runId: string;
  /** Current level (for the `level` award and idempotency). */
  level?: number;
  /** Final score (for the `over` award). */
  score?: number;
}

/**
 * Award XP for a game event via the unified `game-action` edge function (ordinary
 * Roam XP — no separate game XP). No-ops (resolves `null`) when there is no
 * signed-in user or the call fails, so games can fire-and-forget it safely.
 */
export async function awardGameXp(input: AwardGameXpInput): Promise<GameXpAward | null> {
  const { game, kind, runId, level, score } = input;

  const xp = kind === 'level' ? LEVEL_XP : kind === 'win' ? WIN_XP : gameOverXp(score ?? 0);
  if (xp <= 0) return null;

  const { data, error } = await createClient().functions.invoke('game-action', {
    body: { game, kind, runId, level, score },
  });

  if (error) {
    console.warn('[game-xp] award failed', error);
    return null;
  }

  const row = data as
    | { success?: boolean; xpAwarded?: number; newLevel?: number; newXpTotal?: number }
    | null
    | undefined;
  if (!row || row.xpAwarded === undefined) return null;

  return {
    xpAwarded: row.xpAwarded,
    newLevel: row.newLevel ?? 0,
    newXpTotal: row.newXpTotal ?? 0,
  };
}
