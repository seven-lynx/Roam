import { createClient } from '@/lib/supabase/client';
import { roamBufferNext, parseRoamExhaustion, type RoamExhaustion } from '@/lib/roam-buffer';

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
  /**
   * Whether the page may render inside the in-OS browser. `false` means the site
   * refuses framing (X-Frame-Options / CSP `frame-ancestors`) and must open as a
   * real tab; `null`/undefined means it has not been probed yet.
   */
  framable?: boolean | null;
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

// NOTE: `categories` and `subcategories` are now ambiguous in PostgREST — the
// tag-graph migration added a `url_categories` junction table (many-to-many), so
// the bare `categories(name)` embed returns PGRST201 "Multiple Choices". The
// explicit `!urls_category_id_fkey` / `!urls_subcategory_id_fkey` hints pin the
// embed to the original many-to-one FK columns on `urls`.
const SCAN_SELECT =
  'id, title, original_url, upvotes, downvotes, wilson_score, category_id, subcategory_id, categories!urls_category_id_fkey(name), subcategories!urls_subcategory_id_fkey(name)';

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

/** Fetch one entry's full metadata by its normalized `url` (enrichment). */
async function fetchTargetByUrl(url: string): Promise<ScanTarget | null> {
  try {
    const { data } = await createClient()
      .from('urls')
      .select(SCAN_SELECT)
      .eq('url', url)
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
  /**
   * Set when the `roam` function reported a dry feed. Carries *why* so the result
   * card can explain the wait instead of showing a generic "no signal" (issue #120).
   * Absent when the reply predates v39 or had no fresh reason for the scope.
   */
  exhaustion?: RoamExhaustion | null;
}

/**
 * Fetch a roam target for the ROAM key.
 *
 * Resolution order:
 *   1. A validated (hot) entry from the prefetch buffer — instant + reachability
 *      checked, matching the Android hot-queue fast path.
 *   2. When signed in, the `roam` edge function — this records the roam event
 *      (XP / streak / seen_urls) and respects category prefs, matching Android's
 *      cold-roam path.
 *   3. A direct catalog query — the anonymous fallback (approved URLs are
 *      readable by everyone via RLS), also used if the edge function fails.
 *
 * Returns `{ target, error }` so callers can surface *why* a scan failed instead
 * of a generic "no signal".
 */
export async function fetchScanTarget(): Promise<ScanOutcome> {
  // 1. Prefer hot: it's already reachability-checked and ready to serve.
  const hot = roamBufferNext();
  if (hot) {
    const full = await fetchTargetByUrl(hot.url);
    // The buffer already knows whether the page can be framed; carry it so the
    // result card can offer the right action without probing again.
    if (full) return { target: { ...full, framable: hot.framable ?? null }, error: null };
  }

  // 2. Signed in → roam edge function (records gamification + respects prefs).
  const viaEdge = await fetchRoamViaEdge();
  if (viaEdge.target) return { target: viaEdge.target, error: null };

  // 3. Anonymous / edge-failure fallback → direct catalog query. The exhaustion
  // reason rides along: the card only shows it when this also found nothing, but
  // it is the honest answer for why the edge call came back empty.
  const direct = await fetchScanTargetDirect();
  return { ...direct, exhaustion: viaEdge.exhaustion };
}

/**
 * Ask the `roam` edge function for a single URL and enrich it into a full
 * `ScanTarget`. Returns null when signed out, the request fails, or the pool is
 * exhausted (404) — the caller then falls back to the direct query.
 *
 * The 404 body is not discarded: since v39 it carries `reason`, `scope` and
 * `available_later`, which is the difference between "try again" and "every
 * domain here is resting until 21:40".
 */
async function fetchRoamViaEdge(): Promise<{
  target: ScanTarget | null;
  exhaustion: RoamExhaustion | null;
}> {
  const none = { target: null, exhaustion: null };
  try {
    const supabase = createClient();
    if (typeof supabase.auth?.getSession !== 'function') return none;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return none;

    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) return none;

    const res = await fetch(`${base}/functions/v1/roam`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ count: 1 }),
    });
    // 404 = genuine pool exhaustion (the body explains why); any other non-2xx =
    // retry later.
    if (!res.ok) {
      if (res.status === 404) {
        const body = await res.json().catch(() => null);
        return { target: null, exhaustion: parseRoamExhaustion(body) };
      }
      return none;
    }

    const json = (await res.json().catch(() => null)) as { url?: unknown } | null;
    const url = typeof json?.url === 'string' ? json.url : null;
    if (!url) return none;

    // The edge function returns the normalized `url`; enrich it into the full
    // target (original_url, votes, category/subcategory names).
    return { target: await fetchTargetByUrl(url), exhaustion: null };
  } catch (e) {
    console.error('[roam] edge-function roam failed', e);
    return none;
  }
}

/** Direct catalog query: highest-rated approved site, two-pass active/any fallback. */
async function fetchScanTargetDirect(): Promise<ScanOutcome> {
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
      // A wide sample, not the podium: the top few dozen URLs are the mainstream
      // publishers that almost all refuse framing, so sampling only those put the
      // in-OS browser on a blank page after blank page. Reaching deeper into the
      // catalog surfaces the older, self-hosted pages the OS can actually show.
      const { data, error } = await query
        .order('wilson_score', { ascending: false })
        .limit(240);

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
      .select('id, wilson_score, upvotes, downvotes, categories!urls_category_id_fkey(name), subcategories!urls_subcategory_id_fkey(name)')
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
