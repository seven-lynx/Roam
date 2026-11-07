'use client';

export interface GameTimerProps {
  /** Seconds left on the current level's clock (from `useGameLevel`). */
  timeLeft: number;
  /** Accent colour for the value while it is still comfortable. */
  color?: string;
}

/**
 * The shared per-level clock chip shown in each action game's HUD. Reads the
 * `timeLeft` the level loop arms every level; turns red in the final five
 * seconds. Renders nothing once the clock is not running.
 */
export function GameTimer({ timeLeft, color }: GameTimerProps) {
  if (timeLeft <= 0) return null;
  const mm = Math.floor(timeLeft / 60);
  const ss = timeLeft % 60;
  const label = mm > 0 ? `${mm}:${ss.toString().padStart(2, '0')}` : `${ss}s`;
  return (
    <span style={{ color: 'var(--muted)' }}>
      TIME{' '}
      <span style={{ color: timeLeft <= 5 ? 'var(--danger)' : (color ?? 'var(--phosphor)') }}>{label}</span>
    </span>
  );
}
