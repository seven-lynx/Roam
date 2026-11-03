import { createClient } from '@/lib/supabase/client';
import { roamBufferNext } from '@/lib/roam-buffer';

export interface ScanTarget {
  id: string;
  title: string | null;
  original_url: string;
  upvotes: number;
  downvotes: number;
  wilson_score: number;
  category_id: string | null;
  subcategory_id: string | null;
  /** Resolved category name (joined from `categories`). */
  category: string | null;
  /** Resolved subcategory name (joined from `subcategories`). */
  subcategory: string | null;
}

/** URL metadata surfaced in the in-OS browser's control deck. */
export interface UrlMeta {
  urlId: string;
  category: string | null;
  subcategory: string | null;
  wilsonScore: number;
  upvotes: number;
  downvotes: number;
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

const SCAN_SELECT =
  'id, title, original_url, upvotes, downvotes, wilson_score, category_id, subcategory_id, categories(name), subcategories(name)';

function mapScanRow(row: Record<string, unknown>): ScanTarget {
  return {
    id: row.id,
    title: row.title,
    original_url: row.original_url,
    upvotes: row.upvotes,
    downvotes: row.downvotes,
    wilson_score: row.wilson_score,
    category_id: row.category_id,
    subcategory_id: row.subcategory_id,
    category: (row.categories as { name?: string } | null)?.name ?? null,
    subcategory: (row.subcategories as { name?: string } | null)?.name ?? null,
  } as ScanTarget;
}

/** Fetch one entry's full metadata by its `original_url` (enrichment). */
async function fetchTargetByUrl(url: string): Promise<ScanTarget | null> {
  try {
    const { data } = await createClient()
      .from('urls')
      .select(SCAN_SELECT)
      .eq('original_url', url)
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return mapScanRow(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

/** Result of a roam-target lookup, separating the target from any failure reason. */
export interface ScanOutcome {
  target: ScanTarget | null;
  error: string | null;
}

/**
 * Fetch a roam target. Prefers a validated (hot) entry from the prefetch buffer
 * so the ROAM key serves instantly; falls back to a random approved site from the
 * highest-rated pool. Returns `{ target, error }` so callers can surface *why* a
 * scan failed instead of a generic "no signal".
 */
export async function fetchScanTarget(): Promise<ScanOutcome> {
  // Prefer hot: it's already reachability-checked and ready to serve.
  const hot = roamBufferNext();
  if (hot) {
    const full = await fetchTargetByUrl(hot.url);
    if (full) return { target: full, error: null };
  }

  let lastError: string | null = null;

  // Two passes: first restrict to active sites, then (if that came up empty or
  // errored — e.g. the `inactive` column is missing, or passive retirement
  // marked every site inactive) retry against all approved sites. Either way we
  // surface the underlying error rather than swallowing it.
  for (const requireActive of [true, false]) {
    try {
      let query = createClient()
        .from('urls')
        .select(SCAN_SELECT)
        .eq('approved', true);
      if (requireActive) query = query.eq('inactive', false);
      const { data, error } = await query
        .order('wilson_score', { ascending: false })
        .limit(60);

      if (error) {
        lastError = error.message;
        console.error('[roam] catalog query failed', { requireActive, error });
        continue;
      }

      const rows = ((data ?? []) as Array<Record<string, unknown>>).map(mapScanRow);
      if (rows.length > 0) return { target: pickRandom(rows), error: null };
      lastError = 'catalog is empty';
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.error('[roam] catalog query threw', { requireActive, e });
    }
  }

  return { target: null, error: lastError ?? 'catalog unreachable' };
}

/**
 * Fetch category / subcategory names, Wilson score and vote counts for a URL by
 * its `original_url`. Used to enrich the browser's control deck when a link is
 * opened without full metadata (e.g. the homepage's random-page button).
 */
export async function fetchUrlMeta(url: string): Promise<UrlMeta | null> {
  try {
    const { data } = await createClient()
      .from('urls')
      .select('id, wilson_score, upvotes, downvotes, categories(name), subcategories(name)')
      .eq('original_url', url)
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    const row = data as Record<string, unknown>;
    return {
      urlId: row.id as string,
      category: (row.categories as { name?: string } | null)?.name ?? null,
      subcategory: (row.subcategories as { name?: string } | null)?.name ?? null,
      wilsonScore: row.wilson_score as number,
      upvotes: row.upvotes as number,
      downvotes: row.downvotes as number,
    };
  } catch {
    return null;
  }
}
