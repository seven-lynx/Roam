// supabase.ts — Supabase client factory for the extension
//
// The SUPABASE_URL and SUPABASE_ANON_KEY constants are injected at build time
// by esbuild's `define` option (read from the root .env by build.mjs).

import { createClient, SupabaseClient } from '@supabase/supabase-js';

declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;

/** Storage adapter backed by chrome.storage.local.
 *  Supabase v2 supports async storage adapters, so Promises are fine. */
export const chromeStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    const result = await chrome.storage.local.get(key);
    return (result[key] as string | undefined) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  },
  async removeItem(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  },
};

let _client: SupabaseClient | null = null;

/**
 * Returns the shared Supabase client for this service-worker activation.
 * Service workers are re-created by the browser on each activation, so the
 * module runs fresh — calling createClient() once per activation is correct.
 */
export function getSupabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(__SUPABASE_URL__, __SUPABASE_ANON_KEY__, {
      auth: {
        storage: chromeStorageAdapter,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // no URL to detect in a service worker
      },
    });
  }
  return _client;
}
