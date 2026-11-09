// exhaustion.ts — why a serve came back empty (issue #120)
//
// The `roam` function answers 404 when it has nothing to serve, and the body says
// which of three situations the user is in: the pool is genuinely read out, every
// domain in it is cooling down, or the user's own filters hide what is left. Those
// used to collapse into one "no results" screen.
//
// The wording mirrors the web app (web/src/components/ScanResult.tsx and
// web/src/lib/format.ts) so the extension does not invent a fourth vocabulary.

import type { RoamExhaustion, RoamExhaustionReason } from './messages';

function isExhaustionReason(value: unknown): value is RoamExhaustionReason {
  return value === 'pool_empty' || value === 'cooldown' || value === 'filters';
}

/**
 * Read the reason out of a 404 body. Anything unrecognised - an older deployment, a
 * bare error body, a non-object - yields null, and the caller keeps its generic copy.
 */
export function parseRoamExhaustion(body: unknown): RoamExhaustion | null {
  if (!body || typeof body !== 'object') return null;
  const raw = body as Record<string, unknown>;
  if (!isExhaustionReason(raw.reason)) return null;
  return {
    reason: raw.reason,
    scope: typeof raw.scope === 'string' && raw.scope ? raw.scope : null,
    available_later: typeof raw.available_later === 'string' ? raw.available_later : null,
  };
}

/**
 * Describe how long until `iso` in the terms a reader cares about. Identical
 * buckets to the web app's describeWait(), so both surfaces say "in about 3 hours"
 * rather than one of them saying "3.2 h".
 */
export function describeWait(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'soon';
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return 'soon';
  const minutes = Math.round((target - now.getTime()) / 60_000);
  if (minutes <= 5) return 'within minutes';
  if (minutes < 60) return `in about ${Math.round(minutes / 5) * 5} minutes`;
  const hours = Math.max(1, Math.round(minutes / 60));
  return `in about ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

export interface ExhaustionCopy {
  title: string;
  sub: string;
  /** Only an empty pool is fixed by adding categories; the other two are waits. */
  showCategories: boolean;
}

/**
 * Copy for the popup's noresults panel. A cooldown is a wait, an empty pool is a
 * wall, and hidden filters are the user's own doing - so only the pool case keeps
 * the "add categories" button, which would be useless advice for the other two.
 */
export function describeExhaustion(
  exhaustion: RoamExhaustion | null | undefined,
  now: Date = new Date(),
): ExhaustionCopy {
  if (exhaustion?.reason === 'cooldown') {
    return {
      title: 'Every site in this feed is resting.',
      sub: `Each domain rests 24 h after a visit. The first one returns ${describeWait(exhaustion?.available_later ?? null, now)}.`,
      showCategories: false,
    };
  }
  if (exhaustion?.reason === 'filters') {
    return {
      title: 'Your filters are hiding everything.',
      sub: 'Nothing left matches your focus category. Switch or clear it to reopen the feed.',
      showCategories: false,
    };
  }
  // pool_empty, no reason at all, or a reason this build does not know: the wall.
  return {
    title: "You've explored everything in your categories!",
    sub: 'Add more categories to see new pages.',
    showCategories: true,
  };
}
