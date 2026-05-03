/**
 * lib/cache.js — per-page key/value cache with TTL
 *
 * Replaces the per-seeder "dump the whole run to one JSON file" pattern with a
 * key-addressed store that persists individual entries, enabling partial resume
 * when a seeder is interrupted mid-run.
 *
 * Usage:
 *
 *   import { createCache } from './lib/cache.js';
 *
 *   const cache = createCache('nyt');          // .cache/nyt.json, default 7-day TTL
 *   const cache = createCache('nyt', { ttl: 24 * 3600 * 1000 }); // 1-day TTL
 *
 *   // Read
 *   const cached = cache.get('2024-03');       // null if missing or expired
 *
 *   // Write (auto-persists)
 *   cache.set('2024-03', articles);
 *
 *   // Check the flag passed on CLI
 *   if (!cache.active) { ... re-fetch everything ... }
 *
 *   // Wipe all entries (--no-cache)
 *   cache.clear();
 *
 *   // Flush manually (writes are synchronous by default; this is a no-op unless
 *   // you switch to async mode in the future)
 *   cache.flush();
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR  = resolve(__dirname, '../.cache');
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * @param {string} name       Short identifier — becomes `.cache/<name>.json`
 * @param {{ ttl?: number, noCache?: boolean }} opts
 *   ttl     — entry expiry in ms (default 7 days)
 *   noCache — when true, cache.active is false and get() always returns null
 *             (callers can check cache.active to decide whether to re-fetch)
 */
export function createCache(name, { ttl = DEFAULT_TTL, noCache = false } = {}) {
  const file  = resolve(CACHE_DIR, `${name}.json`);
  const store = (!noCache && existsSync(file))
    ? (() => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return {}; } })()
    : {};

  function persist() {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(file, JSON.stringify(store));
  }

  return {
    /** False when --no-cache was passed; seeders can branch on this. */
    active: !noCache,

    /**
     * Get a cached value by key.
     * Returns null if the entry is missing, expired, or cache is inactive.
     */
    get(key) {
      if (noCache) return null;
      const entry = store[key];
      if (!entry) return null;
      if (Date.now() - entry.ts > ttl) {
        delete store[key];
        return null;
      }
      return entry.data;
    },

    /**
     * Store a value under key and immediately persist to disk.
     */
    set(key, data) {
      store[key] = { ts: Date.now(), data };
      persist();
    },

    /**
     * Remove a single entry.
     */
    delete(key) {
      delete store[key];
      persist();
    },

    /**
     * Wipe all entries and persist.
     */
    clear() {
      for (const k of Object.keys(store)) delete store[k];
      persist();
    },

    /** Number of live (non-expired) entries currently in the store. */
    get size() {
      const now = Date.now();
      return Object.values(store).filter((e) => now - e.ts <= ttl).length;
    },
  };
}
