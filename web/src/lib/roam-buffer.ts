'use client';

/**
 * Web port of the Android prefetch hot/warm queue (MainViewModel).
 *
 *   warm — URLs fetched from the roam edge function but not yet reachability
 *          checked. Filled in batches of `WARM_BATCH` and deduped by domain.
 *   hot  — warm URLs that passed a HEAD probe (or were HEAD-blocked, which we
 *          treat as servable). Popped first when the user roams.
 *
 * The browser can't HEAD arbitrary third-party URLs (CORS), so validation goes
 * through a same-origin API route (`/api/check-urls`) that probes server-side.
 * Both queues feed the deck's nixie tubes (display clamped to 9) and the ROAM
 * key / random-page button prefer hot entries.
 */

import { createClient } from '@/lib/supabase/client';
import { extractDomain } from '@/lib/url-utils';

/** Response shape from POST /functions/v1/roam (see supabase/functions/roam). */
export interface RoamBufferUrl {
  id: string;
  url: string;
  title?: string | null;
  description?: string | null;
  og_image_url?: string | null;
  category_id?: string | null;
  subcategory_id?: string | null;
  wilson_score?: number | null;
}

export const HOT_TARGET = 12;
export const WARM_TARGET = 15;
const WARM_BATCH = 5;
const VALIDATE_BATCH = 4;

/** Nixie tubes are single-digit; display saturates at 9. */
export const NIXIE_MAX = 9;

export interface RoamBufferSnapshot {
  hot: number;
  warm: number;
}

type Listener = () => void;

let hotQueue: RoamBufferUrl[] = [];
let warmQueue: RoamBufferUrl[] = [];
let busy = false;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

export function getRoamBufferSnapshot(): RoamBufferSnapshot {
  return { hot: hotQueue.length, warm: warmQueue.length };
}

export function subscribeRoamBuffer(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Drop both queues (sign-out, error, etc.). */
export function resetRoamBuffer(): void {
  hotQueue = [];
  warmQueue = [];
  emit();
}

async function fetchWarmBatch(count: number, excludeDomain?: string | null): Promise<RoamBufferUrl[]> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return [];

  const body: Record<string, unknown> = { count, prefetch: true };
  if (excludeDomain) body.exclude_domain = excludeDomain;
  // Prefetch records nothing (issue #122), so a second call has no memory of the
  // first and can return the same URLs. Ask the server to skip the domains we are
  // already holding — otherwise a full batch can come back entirely redundant and
  // the buffer stops filling until a serve cools a domain.
  const buffered = bufferedDomains();
  if (buffered.length > 0) body.exclude_domains = buffered;

  const res = await fetch(`${base}/functions/v1/roam`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });
  // 404 = genuine pool exhaustion (not an error); any other failure just stops
  // this fill — the next tick retries.
  if (res.status === 404) return [];
  if (!res.ok) return [];
  const json = (await res.json().catch(() => [])) as RoamBufferUrl[];
  return Array.isArray(json) ? json : [];
}

async function validateUrls(urls: string[]): Promise<Map<string, 'reachable' | 'blocked' | 'unreachable'>> {
  const out = new Map<string, 'reachable' | 'blocked' | 'unreachable'>();
  if (urls.length === 0) return out;
  try {
    const res = await fetch('/api/check-urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }),
    });
    if (!res.ok) return out;
    const json = (await res.json()) as { results?: Array<{ url: string; status: 'reachable' | 'blocked' | 'unreachable' }> };
    for (const r of json.results ?? []) out.set(r.url, r.status);
  } catch {
    /* validation unavailable: leave empty so nothing is promoted this tick */
  }
  return out;
}

/** Domains currently held in either queue, as the prefetch exclusion list. */
function bufferedDomains(): string[] {
  const out = new Set<string>();
  for (const entry of [...hotQueue, ...warmQueue]) {
    const d = extractDomain(entry.url);
    if (d) out.add(d);
  }
  return [...out];
}

function domainQueued(url: string): boolean {
  const d = extractDomain(url);
  if (!d) return false;
  return (
    warmQueue.some((w) => extractDomain(w.url) === d) ||
    hotQueue.some((h) => extractDomain(h.url) === d)
  );
}

/**
 * One pass of the prefetch loop: top up the warm queue, then promote a batch of
 * warm URLs to hot after reachability checking. Called on an interval from the
 * deck; idempotent and re-entrant (a `busy` guard prevents overlapping passes).
 */
export async function roamBufferTick(excludeDomain?: string | null): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    // Phase 1 — warm fill.
    if (warmQueue.length < WARM_TARGET) {
      const batchSize = Math.min(WARM_BATCH, WARM_TARGET - warmQueue.length);
      const candidates = await fetchWarmBatch(batchSize, excludeDomain);
      if (candidates.length > 0) {
        for (const candidate of candidates) {
          if (warmQueue.length >= WARM_TARGET) break;
          if (!domainQueued(candidate.url)) warmQueue.push(candidate);
        }
        emit();
      }
    }

    // Phase 2 — hot promotion.
    if (hotQueue.length < HOT_TARGET && warmQueue.length > 0) {
      const size = Math.min(VALIDATE_BATCH, warmQueue.length, HOT_TARGET - hotQueue.length);
      const batch = warmQueue.splice(0, size);
      const results = await validateUrls(batch.map((b) => b.url));
      let changed = false;
      for (const candidate of batch) {
        const status = results.get(candidate.url) ?? 'unreachable';
        // HEAD_BLOCKED (405/403/501) is treated as servable, matching Android.
        if (status !== 'unreachable' && hotQueue.length < HOT_TARGET) {
          const d = extractDomain(candidate.url);
          const dup = !!d && hotQueue.some((h) => extractDomain(h.url) === d);
          if (!dup) {
            hotQueue.push(candidate);
            changed = true;
          }
        }
      }
      if (changed || batch.length > 0) emit();
    }
  } finally {
    busy = false;
  }
}

/**
 * Record a buffered URL as seen.
 *
 * A prefetched URL carries no discovery state (issue #122): `roam_prefetch` writes
 * neither `seen_urls` nor a domain cooldown, so the row has to be created when the
 * URL actually reaches the screen. Without this, `report-engagement` would update
 * nothing, the skip penalty would never set, and the 24 h domain cooldown would
 * never fire for a served URL — the deck would keep re-serving the same domain.
 *
 * Fire-and-forget on purpose: the URL is already on its way to the screen, and a
 * failed bookkeeping call must not cost the user their page.
 */
function markSeen(urlId: string): void {
  void (async () => {
    try {
      const supabase = createClient();
      if (typeof supabase.rpc !== 'function') return;
      const { error } = await supabase.rpc('mark_url_seen', { p_url_id: urlId });
      if (error) console.error('[roam] mark_url_seen failed', error.message);
    } catch (e) {
      console.error('[roam] mark_url_seen failed', e);
    }
  })();
}

/**
 * Pop the next validated (hot) URL, skipping any entry whose domain matches
 * `excludeDomain`. Returns null when the hot queue has nothing servable — the
 * caller should fall back to a direct catalog query.
 */
export function roamBufferNext(excludeDomain?: string | null): RoamBufferUrl | null {
  for (let i = 0; i < hotQueue.length; i++) {
    if (excludeDomain && extractDomain(hotQueue[i].url) === excludeDomain) continue;
    const [entry] = hotQueue.splice(i, 1);
    emit();
    // Handing it over is the serve, so this is where it gets recorded.
    if (entry.id) markSeen(entry.id);
    return entry;
  }
  return null;
}


