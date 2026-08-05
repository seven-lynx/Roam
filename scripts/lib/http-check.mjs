/**
 * lib/http-check.mjs — HEAD-based liveness checker for dead-link sweeps
 *
 * Usage:
 *   import { checkUrl } from './lib/http-check.mjs';
 *   const result = await checkUrl('https://example.com/article');
 *   // → { alive: true,  status: 200, reason: null }
 *   // → { alive: false, status: 404, reason: 'HTTP 404' }
 *   // → { alive: false, status: null, reason: 'timeout' }
 *
 * Alive codes:  2xx, 3xx (after redirect follow), 401, 403, 405, 429
 *   • 401/403 — server responded; content may require auth but page exists
 *   • 405     — HEAD not allowed; server is alive, use GET for real access
 *   • 429     — rate-limited; unambiguously alive
 *
 * Dead codes:   404, 410, 451
 *   Soft-dead:  persistent network errors (ENOTFOUND, ECONNREFUSED, SSL),
 *               timeout after MAX_RETRIES attempts
 *
 * The treat403Alive flag (default true) controls whether 403 is alive or dead.
 * Sites that block scrapers universally return 403 — marking them dead would
 * incorrectly retire thousands of valid URLs. Recommended: keep true.
 */

const TIMEOUT_MS      = 8_000;
const MAX_RETRIES     = 3;
const RETRY_DELAY_MS  = 2_000; // base delay; multiplied by attempt number

// Definitively gone — no retry
const HARD_DEAD_STATUSES = new Set([404, 410, 451]);

// Server is alive even though access is denied
const LIVE_DENY_STATUSES = new Set([401, 403, 405, 406, 429]);

/**
 * @param {string} url
 * @param {{ treat403Alive?: boolean }} [opts]
 * @returns {Promise<{ alive: boolean, status: number|null, reason: string|null }>}
 */
export async function checkUrl(url, { treat403Alive = true } = {}) {
  let lastReason = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method:  'HEAD',
        signal:  controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'Roam-LinkChecker/1.0 (+https://roamtheweb.app)' },
      });
      clearTimeout(timer);

      const { status } = res;

      // Success range
      if (status >= 200 && status < 300) return { alive: true, status, reason: null };

      // Redirect already followed by fetch; if we're here it resolved to a 3xx
      // with redirect: 'follow' this shouldn't happen normally, but treat as alive
      if (status >= 300 && status < 400) return { alive: true, status, reason: null };

      // Denial codes that imply a live server
      if (LIVE_DENY_STATUSES.has(status)) {
        if (status === 403 && !treat403Alive) {
          return { alive: false, status, reason: 'HTTP 403' };
        }
        return { alive: true, status, reason: null };
      }

      // Hard dead — don't retry
      if (HARD_DEAD_STATUSES.has(status)) {
        return { alive: false, status, reason: `HTTP ${status}` };
      }

      // 5xx or other 4xx — record and retry
      lastReason = `HTTP ${status}`;
      // Other 4xx (400, 402, 407, etc.) treat as dead after retries
      if (status >= 400 && status < 500) {
        return { alive: false, status, reason: lastReason };
      }
      // 5xx — could be transient; retry
    } catch (err) {
      clearTimeout(timer);
      const msg = err?.message ?? String(err);

      if (err?.name === 'AbortError') {
        lastReason = 'timeout';
        // timeout — retry up to MAX_RETRIES
        continue;
      }

      // SSL errors are permanent — don't retry
      if (/SSL|certificate|cert|TLS/i.test(msg)) {
        return { alive: false, status: null, reason: 'SSL error' };
      }

      // DNS / connection refused — likely permanent but retry once
      if (msg.includes('ENOTFOUND')) {
        lastReason = 'DNS not found';
      } else if (msg.includes('ECONNREFUSED')) {
        lastReason = 'connection refused';
      } else if (msg.includes('ECONNRESET')) {
        lastReason = 'connection reset';
      } else {
        lastReason = msg.slice(0, 80);
      }
    }
  }

  return { alive: false, status: null, reason: lastReason ?? 'unknown error' };
}
