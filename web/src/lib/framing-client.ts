'use client';

/**
 * Client side of the frame-eligibility probe.
 *
 * The browser cannot read a third-party response's headers (CORS), so the verdict
 * comes from `POST /api/check-urls`, which fetches the page server-side and reads
 * `X-Frame-Options` / CSP `frame-ancestors`. Verdicts are cached for the session
 * so scanning, then opening, the same page probes it once.
 */

import type { FramePolicy } from '@/lib/framing';

interface CacheEntry {
  policy: FramePolicy;
  at: number;
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_URLS = 20;
const cache = new Map<string, CacheEntry>();

/** Forget every cached verdict (tests, and a manual re-probe). */
export function resetFramingCache(): void {
  cache.clear();
}

/**
 * Resolve a frame policy per URL. A URL missing from the map (or mapped to
 * `unknown`) means the probe could not tell — callers must keep their old
 * behaviour rather than blocking the frame.
 */
export async function checkFramable(urls: string[]): Promise<Map<string, FramePolicy>> {
  const out = new Map<string, FramePolicy>();
  const now = Date.now();
  const pending: string[] = [];

  for (const url of urls) {
    const hit = cache.get(url);
    if (hit && now - hit.at < CACHE_TTL_MS) out.set(url, hit.policy);
    else pending.push(url);
  }
  if (pending.length === 0) return out;

  try {
    const res = await fetch('/api/check-urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: pending.slice(0, MAX_URLS) }),
    });
    if (!res.ok) return out;
    const json = (await res.json()) as { results?: Array<{ url?: unknown; framable?: unknown }> };
    for (const row of json.results ?? []) {
      if (!row || typeof row.url !== 'string') continue;
      const policy: FramePolicy =
        row.framable === true ? 'allow' : row.framable === false ? 'refuse' : 'unknown';
      // `unknown` is a failed probe, not a verdict — leave it uncached so it retries.
      if (policy !== 'unknown') cache.set(row.url, { policy, at: Date.now() });
      out.set(row.url, policy);
    }
  } catch {
    /* probe unavailable: every URL stays unknown, which never blocks the frame */
  }
  return out;
}

/** Convenience wrapper for a single URL. */
export async function checkFramableOne(url: string): Promise<FramePolicy> {
  const map = await checkFramable([url]);
  return map.get(url) ?? 'unknown';
}
