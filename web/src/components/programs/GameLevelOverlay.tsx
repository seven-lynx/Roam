'use client';

import type { LevelPhase } from '@/components/programs/useGameLevel';

export interface GameLevelOverlayProps {
  phase: LevelPhase;
  level: number;
  countdown: number;
  lastXp: number;
  signedIn: boolean;
  /** Bespoke diegetic title for the game-over screen. */
  overTitle: string;
  /** Final-score label/value for the game-over screen. */
  scoreLabel?: string;
  score?: number;
  /** Start handler shown on the initial READY screen. */
  onStart?: () => void;
  /** Restart handler shown on the game-over screen. */
  onRestart?: () => void;
}

/**
 * The shared interstitial overlay for the action games: READY (START button),
 * LEVEL COMPLETE (with the XP award) and LEVEL START (a 3·2·1 countdown), plus
 * a unified game-over screen. Rendered inside a `position: relative` board
 * wrapper so it covers exactly the playfield.
 */
export function GameLevelOverlay(props: GameLevelOverlayProps) {
  const { phase, level, countdown, lastXp, signedIn, overTitle, scoreLabel, score, onStart, onRestart } = props;

  if (phase === 'playing') return null;

  const showXp = signedIn && lastXp > 0;

  return (
    <div className="game-level-overlay" role="status">
      {phase === 'ready' && (
        <>
          <div className="game-level-title">LEVEL {level}</div>
          {onStart && (
            <button type="button" className="program-btn" onClick={onStart} style={{ marginTop: 6 }}>
              START
            </button>
          )}
        </>
      )}

      {phase === 'complete' && (
        <>
          <div className="game-level-title">LEVEL {level} CLEAR</div>
          <div className="game-level-xp">{signedIn ? `+${lastXp} XP` : 'GUEST SESSION'}</div>
        </>
      )}

      {phase === 'start' && (
        <>
          <div className="game-level-title">LEVEL {level}</div>
          <div className="game-level-count">{countdown > 0 ? countdown : 'GO'}</div>
        </>
      )}

      {phase === 'over' && (
        <>
          <div className="game-level-over">{overTitle}</div>
          {scoreLabel && <div className="game-level-score">{scoreLabel} {score}</div>}
          {showXp && <div className="game-level-xp">+{lastXp} XP</div>}
          {onRestart && (
            <button type="button" className="program-btn" onClick={onRestart} style={{ marginTop: 6 }}>
              RESTART
            </button>
          )}
        </>
      )}
    </div>
  );
}
