'use client';

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { awardGameXp, gameOverXp, LEVEL_XP, WIN_XP, XP_LEVEL_CAP, type GameId } from '@/lib/game-xp';

export type LevelPhase = 'ready' | 'playing' | 'complete' | 'start' | 'over';

const COUNTDOWN_FROM = 3;
const COUNTDOWN_STEP_MS = 1000;
const COMPLETE_MS = 1400;

export interface UseGameLevelOptions {
  game: GameId;
  /** Signed-in user id, or null when playing as a guest (no XP awarded). */
  userId: string | null;
  /** Stable per-run id so retries/restarts can't double-award the same level. */
  runId: string;
  /** Arcade games have no end; clearing this level also awards the flat WIN_XP. */
  winLevel?: number;
  /** Seconds allowed for a level (1-based). Absent/0 ⇒ no time limit. */
  timeLimitFor?: (level: number) => number;
  /** Current score, read when the clock expires so the game-over is scored. */
  getScore?: () => number;
}

export interface GameLevelController {
  /** Current level (1-based). */
  level: number;
  phase: LevelPhase;
  /** Countdown value while `phase === 'start'`. */
  countdown: number;
  /** Seconds left on the current level's clock (0 when no limit / not playing). */
  timeLeft: number;
  /** Most recent XP award (level clear or game over), for display. */
  lastXp: number;
  /** Ref mirrors of `level` / `phase` for reading inside a rAF/interval loop. */
  levelRef: MutableRefObject<number>;
  phaseRef: MutableRefObject<LevelPhase>;
  /** Start the current level from the initial READY screen. */
  begin: () => void;
  /** Call when the current level's win condition is met (a win at `winLevel`). */
  completeLevel: () => void;
  /** Call on death. Awards game-over XP only past the level cap. */
  gameOver: (score: number) => void;
  /** Reset back to level 1 (restart). Keeps `runId` so XP stays idempotent. */
  resetLevels: () => void;
}

/**
 * Drives the shared READY → play → LEVEL COMPLETE → LEVEL START (countdown) →
 * play loop for the action games. State lives here; the games read `phaseRef` /
 * `levelRef` inside their own loops to pause during the interstitial screens
 * and to apply per-level difficulty.
 */
export function useGameLevel(opts: UseGameLevelOptions): GameLevelController {
  const { game, userId, runId, winLevel, timeLimitFor, getScore } = opts;

  const [level, setLevel] = useState(1);
  const [phase, setPhase] = useState<LevelPhase>('ready');
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
  const [timeLeft, setTimeLeft] = useState(0);
  const [lastXp, setLastXp] = useState(0);

  const levelRef = useRef(1);
  const phaseRef = useRef<LevelPhase>('ready');
  const timers = useRef<number[]>([]);
  // The armed limit for the current level; 0 means the clock is not running.
  const armedRef = useRef(0);

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
    setTimeLeft(0);
    armedRef.current = 0;
    setLastXp(0);
    setPhaseBoth('ready');
  }, [clearTimers, setPhaseBoth]);

  const begin = useCallback(() => {
    if (phaseRef.current !== 'ready') return;
    setCountdown(COUNTDOWN_FROM);
    setPhaseBoth('start');
  }, [setPhaseBoth]);

  const completeLevel = useCallback(
    () => {
      if (phaseRef.current !== 'playing') return;
      const lvl = levelRef.current;
      const isWin = winLevel !== undefined && lvl === winLevel;
      setPhaseBoth('complete');

      if (userId) {
        // Fire-and-forget: awards are idempotent, and the overlay only needs
        // the value for display (a signed-out guest shows the earned amount).
        // Clearing the win level pays the level XP plus the flat win bonus.
        setLastXp(isWin ? LEVEL_XP + WIN_XP : LEVEL_XP);
        void awardGameXp({ userId, game, kind: 'level', level: lvl, runId }).then((r) => {
          if (r && !isWin) setLastXp(r.xpAwarded);
        });
        if (isWin) {
          void awardGameXp({ userId, game, kind: 'win', runId });
        }
      } else {
        setLastXp(0);
      }

      timers.current.push(
        window.setTimeout(() => {
          // Advance to the next level now so the LEVEL START countdown already
          // shows the level it is counting down *into*.
          levelRef.current = lvl + 1;
          setLevel(lvl + 1);
          setCountdown(COUNTDOWN_FROM);
          setPhaseBoth('start');
        }, COMPLETE_MS),
      );
    },
    [game, userId, runId, winLevel, setPhaseBoth],
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

  // Countdown → resume play.
  useEffect(() => {
    if (phase !== 'start') return;
    if (countdown <= 0) {
      setPhaseBoth('playing');
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => c - 1), COUNTDOWN_STEP_MS);
    return () => window.clearTimeout(t);
  }, [phase, countdown, setPhaseBoth]);

  // Per-level clock: arms when play begins, ticks once a second, and ends the
  // run when it reaches zero. Re-arms for each new level; cleared otherwise.
  useEffect(() => {
    if (phase !== 'playing') {
      armedRef.current = 0;
      return;
    }
    if (armedRef.current === 0) {
      const limit = timeLimitFor ? timeLimitFor(level) : 0;
      armedRef.current = limit;
      if (limit > 0) setTimeLeft(limit);
      return;
    }
    if (timeLeft <= 0) {
      armedRef.current = 0;
      gameOver(getScore ? getScore() : 0);
      return;
    }
    const t = window.setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => window.clearTimeout(t);
  }, [phase, level, timeLeft, gameOver, timeLimitFor, getScore]);

  // Clear any pending interstitial timers on unmount.
  useEffect(() => clearTimers, [clearTimers]);

  return {
    level,
    phase,
    countdown,
    timeLeft,
    lastXp,
    levelRef,
    phaseRef,
    begin,
    completeLevel,
    gameOver,
    resetLevels,
  };
}
