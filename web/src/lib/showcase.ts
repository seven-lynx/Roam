/**
 * Deterministic monthly selection for the homepage slideshow.
 *
 * The showcase should feel fresh without churning on every page load, so we
 * select a stable set of sites for the current month. The same month key
 * always yields the same selection; when the month rolls over the set changes.
 */

/** FNV-1a hash — turns a month key like "2026-10" into a stable 32-bit seed. */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32 — a tiny deterministic PRNG given a 32-bit seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Return a deterministic subset of `items` (up to `count`) for the given
 * month key, using a Fisher–Yates shuffle seeded by the key. Does not mutate
 * the input array.
 */
export function selectMonthlySites<T>(
  items: readonly T[],
  count: number,
  monthKey: string,
): T[] {
  if (items.length <= count) return items.slice();
  const rand = mulberry32(hashSeed(monthKey));
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result.slice(0, count);
}

/** The current "YYYY-MM" month key, used to rotate the showcase monthly. */
export function currentMonthKey(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}
