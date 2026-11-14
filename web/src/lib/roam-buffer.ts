'use client';

/**
 * Web port of the Android prefetch hot/warm queue (MainViewModel).
 *
 *   warm — URLs fetched from the roam edge function but not yet reachability
 *          checked. Filled in batches of `WARM_BATCH` and deduped by domain.
 *   hot  — warm URLs that passed a reachability probe *and* answered that they
 *          may be framed. Popped first when the user roams.
 *   cool — URLs that are alive but refuse framing (X-Frame-Options / CSP
 *          `frame-ancestors`). Never handed out ahead of a hot entry; used only
 *          when nothing else is ready, and then opened as a real tab.
 *
 * The browser can't inspect arbitrary third-party origins (CORS), so validation
 * goes through a same-origin API route (`/api/check-urls`) that probes
 * server-side. Both queues feed the deck's nixie tubes (display clamped to 9) and
 * the ROAM key / random-page button prefer hot entries.
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
  /** true when the page renders in the OS, false when it must open as a tab. */
  framable?: boolean | null;
}

export const HOT_TARGET = 12;
export const WARM_TARGET = 15;
const WARM_BATCH = 5;
const VALIDATE_BATCH = 4;
/** Refused pages kept on standby so an empty hot queue still serves something. */
const MAX_COOL = 6;
/** Refused domains remembered for 40 entries, to keep prefetch from re-offering them. */
const MAX_REFUSED_DOMAINS = 40;

/** Nixie tubes are single-digit; display saturates at 9. */
export const NIXIE_MAX = 9;

export interface RoamBufferSnapshot {
  hot: number;
  warm: number;
}

// ── Exhaustion (issue #120) ──────────────────────────────────────────────────
// The `roam` 404 has always meant "nothing to serve", but until v39 the body said
// nothing about *why*, so every dry feed read as the same dead end. The reason now
// arrives with the 404; it is kept here so the deck's scan result can explain the
// wait instead of apologising for it.

/** What `roam()` recorded at its exit: the loose pool was empty, every candidate
 *  was inside a domain cooldown, or the user's filters excluded the rest. */
export type RoamExhaustionReason = 'pool_empty' | 'cooldown' | 'filters';

export interface RoamExhaustion {
  /** null when the reply carried no fresh reason (older server, or a row that had
   *  aged out) — callers then keep their generic copy rather than inventing one. */
  reason: RoamExhaustionReason | null;
  /** `global`, `category:<uuid>`, `subcategory:<uuid>` or `collection:<uuid>`. */
  scope: string | null;
  /** ISO timestamp for the earliest cooldown expiry; only set for `cooldown`. */
  available_later: string | null;
}

const EXHAUSTION_REASONS: readonly string[] = ['pool_empty', 'cooldown', 'filters'];

/**
 * Parse a `roam` 404 body into `RoamExhaustion`. Returns null when the body is not
 * an exhaustion reply at all, so a caller can tell "dry feed" from "malformed".
 */
export function parseRoamExhaustion(body: unknown): RoamExhaustion | null {
  if (!body || typeof body !== 'object') return null;
  const raw = body as Record<string, unknown>;
  if (raw.exhausted !== true && typeof raw.reason !== 'string') return null;
  return {
    reason: typeof raw.reason === 'string' && EXHAUSTION_REASONS.includes(raw.reason)
      ? (raw.reason as RoamExhaustionReason)
      : null,
    scope: typeof raw.scope === 'string' ? raw.scope : null,
    available_later: typeof raw.available_later === 'string' ? raw.available_later : null,
  };
}

type Listener = () => void;

let hotQueue: RoamBufferUrl[] = [];
let warmQueue: RoamBufferUrl[] = [];
/** Alive but unframable: standby only, served when nothing hot is ready. */
let coolQueue: RoamBufferUrl[] = [];
/** Domains we already know refuse framing, kept out of the next prefetch. */
let refusedDomains: string[] = [];
let busy = false;
const listeners = new Set<Listener>();

/** Last exhaustion reason, or null when the feed is healthy or never tried. */
let exhaustion: RoamExhaustion | null = null;

function emit() {
  for (const l of listeners) l();
}

export function getRoamBufferSnapshot(): RoamBufferSnapshot {
  return { hot: hotQueue.length, warm: warmQueue.length };
}

/** Why the last prefetch or serve came back empty, if it did. */
export function getRoamExhaustion(): RoamExhaustion | null {
  return exhaustion;
}

/**
 * Store the reason and notify subscribers — but only when it actually changed.
 * The prefetch loop retries every few seconds, so an unconditional emit would
 * re-render the deck on every dry tick.
 */
function setExhaustion(next: RoamExhaustion | null): void {
  const unchanged =
    exhaustion === next ||
    (exhaustion !== null &&
      next !== null &&
      exhaustion.reason === next.reason &&
      exhaustion.scope === next.scope &&
      exhaustion.available_later === next.available_later);
  if (unchanged) return;
  exhaustion = next;
  emit();
}

export function subscribeRoamBuffer(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Drop all queues (sign-out, error, etc.). */
export function resetRoamBuffer(): void {
  hotQueue = [];
  warmQueue = [];
  coolQueue = [];
  refusedDomains = [];
  exhaustion = null;
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
  // already holding — and the ones that just refused framing, or a full batch can
  // come back entirely unusable and the buffer stops filling.
  const excluded = exclusions();
  if (excluded.length > 0) body.exclude_domains = excluded;

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
  if (res.status === 404) {
    // Keep the reason so the UI can explain the gap instead of showing an
    // unexplained dead end. A body without one (older server, aged-out row) still
    // counts as dry, so the generic copy keeps working.
    const body = await res.json().catch(() => null);
    setExhaustion(parseRoamExhaustion(body) ?? { reason: null, scope: null, available_later: null });
    return [];
  }
  if (!res.ok) return [];
  const json = (await res.json().catch(() => [])) as RoamBufferUrl[];
  if (!Array.isArray(json)) return [];
  // Anything to serve means the feed is healthy again, whatever it said before.
  if (json.length > 0) setExhaustion(null);
  return json;
}

type UrlStatus = 'reachable' | 'blocked' | 'unreachable';

interface UrlVerdict {
  status: UrlStatus;
  /** false = the page refuses framing; null/absent = could not tell. */
  framable: boolean | null;
}

async function validateUrls(urls: string[]): Promise<Map<string, UrlVerdict>> {
  const out = new Map<string, UrlVerdict>();
  if (urls.length === 0) return out;
  try {
    const res = await fetch('/api/check-urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }),
    });
    if (!res.ok) return out;
    const json = (await res.json()) as {
      results?: Array<{ url: string; status: UrlStatus; framable?: boolean | null }>;
    };
    for (const r of json.results ?? []) {
      out.set(r.url, { status: r.status, framable: r.framable ?? null });
    }
  } catch {
    /* validation unavailable: leave empty so nothing is promoted this tick */
  }
  return out;
}

/** Domains currently held in either queue, as the prefetch exclusion list. */
function bufferedDomains(): string[] {
  const out = new Set<string>();
  for (const entry of [...hotQueue, ...warmQueue, ...coolQueue]) {
    const d = extractDomain(entry.url);
    if (d) out.add(d);
  }
  return [...out];
}

/**
 * Domains the next prefetch should not return: everything already held, plus the
 * ones that only just told us they refuse framing.
 */
function exclusions(): string[] {
  const out = new Set(bufferedDomains());
  for (const d of refusedDomains) out.add(d);
  return [...out];
}

/** Remember a page that refused framing, so prefetch stops offering its domain. */
function rememberRefused(url: string): void {
  const d = extractDomain(url);
  if (!d || refusedDomains.includes(d)) return;
  refusedDomains.push(d);
  if (refusedDomains.length > MAX_REFUSED_DOMAINS) {
    refusedDomains = refusedDomains.slice(-MAX_REFUSED_DOMAINS);
  }
}

/** Park a live-but-unframable entry for the empty-hot-queue fallback. */
function cool(candidate: RoamBufferUrl): void {
  const d = extractDomain(candidate.url);
  if (d && coolQueue.some((c) => extractDomain(c.url) === d)) return;
  coolQueue.push({ ...candidate, framable: false });
  if (coolQueue.length > MAX_COOL) coolQueue.shift();
}

function domainQueued(url: string): boolean {
  const d = extractDomain(url);
  if (!d) return false;
  return (
    warmQueue.some((w) => extractDomain(w.url) === d) ||
    hotQueue.some((h) => extractDomain(h.url) === d) ||
    coolQueue.some((c) => extractDomain(c.url) === d)
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
        const verdict = results.get(candidate.url);
        // An unreachable page is dropped; an unprobed one (validation down) keeps
        // its old behaviour and is treated as servable.
        if (!verdict || verdict.status === 'unreachable') continue;
        // Alive but refuses framing: park it for the empty-hot fallback instead of
        // promoting a page that would only ever show a blank frame.
        if (verdict.framable === false) {
          rememberRefused(candidate.url);
          cool(candidate);
          changed = true;
          continue;
        }
        if (hotQueue.length >= HOT_TARGET) continue;
        const d = extractDomain(candidate.url);
        const dup = !!d && hotQueue.some((h) => extractDomain(h.url) === d);
        if (!dup) {
          hotQueue.push({ ...candidate, framable: verdict.framable });
          changed = true;
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
 * URL actually reaches the screen. Without this, a buffered-then-shown URL would
 * get no row at all and the 24 h domain cooldown would never fire for it — the
 * deck would keep re-serving the same domain.
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

/** Take the first entry in `queue` whose domain is not excluded, else null. */
function take(queue: RoamBufferUrl[], excludeDomain?: string | null): RoamBufferUrl | null {
  for (let i = 0; i < queue.length; i++) {
    if (excludeDomain && extractDomain(queue[i].url) === excludeDomain) continue;
    const [entry] = queue.splice(i, 1);
    emit();
    // Handing it over is the serve, so this is where it gets recorded.
    if (entry.id) markSeen(entry.id);
    return entry;
  }
  return null;
}

/**
 * Pop the next validated (hot) URL, skipping any entry whose domain matches
 * `excludeDomain`. When nothing framable is ready but a refused page is on
 * standby, that page is handed over instead (flagged `framable: false`) so the
 * operator still gets a URL — the UI opens it as a real tab. Returns null only
 * when both queues are empty; the caller then falls back to a catalog query.
 */
export function roamBufferNext(excludeDomain?: string | null): RoamBufferUrl | null {
  return take(hotQueue, excludeDomain) ?? take(coolQueue, excludeDomain);
}


