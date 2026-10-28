import { hashSeed } from '@/lib/showcase';

/**
 * Deterministic scatter for the desk clutter. Values derive from each item's
 * id, so the desk looks hand-placed but renders identically on the server and
 * the client (no hydration mismatch) and never reshuffles between visits.
 */

/** A stable value in [-1, 1] for an id (and optional salt). */
export function unit(id: string, salt = ''): number {
  return (hashSeed(id + salt) / 0xffffffff) * 2 - 1;
}

/** Rotation in degrees, within ±maxDeg. */
export function rotationFor(id: string, maxDeg: number): number {
  return Number((unit(id, ':r') * maxDeg).toFixed(2));
}

/** Horizontal nudge as a percentage of the item's own width, within ±maxPct. */
export function offsetFor(id: string, maxPct: number): number {
  return Number((unit(id, ':x') * maxPct).toFixed(2));
}
