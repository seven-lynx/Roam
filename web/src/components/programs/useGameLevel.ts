'use client';

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { awardGameXp, gameOverXp, LEVEL_XP, XP_LEVEL_CAP, type GameId } from '@/lib/game-xp';

export type LevelPhase = 'playing' | 'complete' | 'start' | 'over';

const COUNTDOWN_FROM = 3;
const COUNTDOWN_STEP_MS = 700;
const COMPLETE_MS = 1400;

export interface UseGameLevelOptions {
  game: GameId;
  /** Signed-in user id, or null when playing as a guest (no XP awarded). */
  userId: string | null;
  /** Stable per-run id so retries/restarts can't double-award the same level. */
  runId: string;
}

export interface GameLevelController {
  /** Current level (1-based). */
  level: number;
  phase: LevelPhase;
  /** Countdown value while `phase === 'start'`. */
  countdown: number;
  /** Most recent XP award (level clear or game over), for display. */
  lastXp: number;
  /** Ref mirrors of `level` / `phase` for reading inside a rAF/interval loop. */
  levelRef: MutableRefObject<number>;
  phaseRef: MutableRefObject<LevelPhase>;
  /** Call when the current level's win condition is met. */
  completeLevel: () => void;
  /** Call on death. Awards game-over XP only past the level cap. */
  gameOver: (score: number) => void;
  /** Reset back to level 1 (restart). Keeps `runId` so XP stays idempotent. */
  resetLevels: () => void;
}

/**
 * Drives the shared LEVEL COMPLETE → LEVEL START (countdown) → play loop for
 * the three action games. State lives here; the games read `phaseRef` /
 * `levelRef` inside their own loops to pause during the interstitial screens
 * and to apply per-level difficulty.
 */
export function useGameLevel(opts: UseGameLevelOptions): GameLevelController {
  const { game, userId, runId } = opts;

  const [level, setLevel] = useState(1);
  const [phase, setPhase] = useState<LevelPhase>('playing');
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
  const [lastXp, setLastXp] = useState(0);

  const levelRef = useRef(1);
  const phaseRef = useRef<LevelPhase>('playing');
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const setPhaseBoth = useCallback((p: LevelPhase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const resetLevels = useCallback(() => {
    clearTimers();
    levelRef.current = 1;
    setLevel(1);
    setLastXp(0);
    setPhaseBoth('playing');
  }, [clearTimers, setPhaseBoth]);

  const completeLevel = useCallback(
    () => {
      if (phaseRef.current !== 'playing') return;
      const lvl = levelRef.current;
      setPhaseBoth('complete');

      if (userId) {
        // Fire-and-forget: the award is idempotent, and the overlay only needs
        // the value for display (a signed-out guest shows the earned amount).
        setLastXp(LEVEL_XP);
        void awardGameXp({ userId, game, kind: 'level', level: lvl, runId }).then((r) => {
          if (r) setLastXp(r.xpAwarded);
        });
      } else {
        setLastXp(0);
      }

      timers.current.push(
        window.setTimeout(() => {
          setPhaseBoth('start');
          setCountdown(COUNTDOWN_FROM);
        }, COMPLETE_MS),
      );
    },
    [game, userId, runId, setPhaseBoth],
  );

  const gameOver = useCallback(
    (score: number) => {
      setPhaseBoth('over');
      if (userId && levelRef.current > XP_LEVEL_CAP) {
        const xp = gameOverXp(score);
        setLastXp(xp);
        if (xp > 0) {
          void awardGameXp({ userId, game, kind: 'over', level: levelRef.current, score, runId }).then(
            (r) => {
              if (r) setLastXp(r.xpAwarded);
            },
          );
        }
      } else {
        setLastXp(0);
      }
    },
    [game, userId, runId, setPhaseBoth],
  );

  // Countdown → advance to the next level and resume play.
  useEffect(() => {
    if (phase !== 'start') return;
    if (countdown <= 0) {
      levelRef.current += 1;
      setLevel(levelRef.current);
      setPhaseBoth('playing');
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => c - 1), COUNTDOWN_STEP_MS);
    return () => window.clearTimeout(t);
  }, [phase, countdown, setPhaseBoth]);

  // Clear any pending interstitial timers on unmount.
  useEffect(() => clearTimers, [clearTimers]);

  return { level, phase, countdown, lastXp, levelRef, phaseRef, completeLevel, gameOver, resetLevels };
}
