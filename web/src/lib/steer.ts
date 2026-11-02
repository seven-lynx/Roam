/**
 * Four-way steering for in-OS games. A faithful TypeScript port of the Android
 * `SteerDirection.kt` utility so web and Android resolve swipes identically.
 */

export type Steer = 'up' | 'down' | 'left' | 'right';

/** Minimum drag distance (px) required to register a steering swipe. */
export const STEER_SWIPE_THRESHOLD_PX = 32;

/**
 * Resolves a drag delta into a steering intent for four-way games.
 *
 * The dominant axis must exceed both the cross-axis magnitude and `threshold`.
 * Screen coordinates have positive `y` downward, so a positive `dy` is `'down'`.
 * A perfect diagonal (equal axis magnitudes) yields `null`, as does any drag
 * at or below the threshold.
 */
export function resolveSteer(dx: number, dy: number, threshold: number = STEER_SWIPE_THRESHOLD_PX): Steer | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax > ay && ax > threshold) return dx > 0 ? 'right' : 'left';
  if (ay > ax && ay > threshold) return dy > 0 ? 'down' : 'up';
  return null;
}