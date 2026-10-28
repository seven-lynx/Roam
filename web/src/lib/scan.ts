import { createClient } from '@/lib/supabase/client';

export interface ScanTarget {
  id: string;
  title: string | null;
  original_url: string;
  upvotes: number;
}

export type ScanStage = 'scan' | 'triangulate' | 'compile' | 'mount';

/** How long each animated stage lasts, in ms. `mount` is the resting state. */
export const STAGE_MS: Record<Exclude<ScanStage, 'mount'>, number> = {
  scan: 600,
  triangulate: 500,
  compile: 600,
};

export const COMPILE_LOG = [
  'resolving host…',
  'decoding snapshot…',
  'linking assets…',
  'mounting target…',
];

/** Pick one entry using the supplied random source (injectable for tests). */
export function pickRandom<T>(items: readonly T[], rand: () => number = Math.random): T | null {
  if (items.length === 0) return null;
  return items[Math.min(items.length - 1, Math.floor(rand() * items.length))];
}

/** A line of fake packet hex for the triangulation stream. Purely decorative. */
export function hexLine(rand: () => number = Math.random, bytes = 12): string {
  return Array.from({ length: bytes }, () =>
    Math.floor(rand() * 256).toString(16).padStart(2, '0'),
  ).join(' ');
}

/**
 * Fetch a random approved, active site from the highest-rated pool.
 * Returns null when the catalogue is unreachable or empty.
 */
export async function fetchScanTarget(): Promise<ScanTarget | null> {
  try {
    const { data, error } = await createClient()
      .from('urls')
      .select('id, title, original_url, upvotes')
      .eq('approved', true)
      .eq('inactive', false)
      .order('wilson_score', { ascending: false })
      .limit(60);
    if (error || !data) return null;
    return pickRandom(data as ScanTarget[]);
  } catch {
    return null;
  }
}
