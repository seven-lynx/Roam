// background.ts — Roam extension background service worker
//
// Event-driven only. No background loops.
// Chrome may terminate and restart this SW at any time.
// The Supabase client rehydrates its session from chrome.storage.local automatically.

import { Sentry } from '../lib/sentry';
import { validateEnvironment } from '../lib/env';
import type { Request, Response, StateData, RoamData, CheckUrlData, Collection, CategoryItem, ProfileData, SubcategoryItem, SavedUrlItem } from '../lib/messages';
import { getSupabase, clearAuthStorage } from '../lib/supabase';
import { FALLBACK_CATEGORIES } from '../lib/constants';

declare const __SUPABASE_URL__: string;

// Validate env vars at SW startup. Throws (crashing the SW with a clear message) if missing.
validateEnvironment();

const PREFETCH_KEY = 'prefetch_queue';
const PERSISTENT_PREFETCH_KEY = 'prefetch_queue_persist'; // survives browser restarts
const PREFETCH_TTL = 5 * 60 * 1000; // 5 minutes
const PREFETCH_TARGET = 5; // number of URLs to keep buffered (matches Android warm queue target)
const RECENT_DOMAINS_KEY = 'recent_domains';
const RECENT_DOMAINS_MAX = 20; // up to 20 recent domains to exclude (was 5)
const RECENT_DOMAINS_TTL = 30 * 60 * 1000; // 30 minutes per entry (was 2 min)
const RATING_QUEUE_KEY = 'pending_ratings';
const RATING_FLUSH_BATCH = 10; // max ratings to flush at once
const CURRENT_URL_KEY = 'current_url';  // { url_id: string, served_at: number }
const URL_HISTORY_KEY = 'extension_url_history';
const MAX_HISTORY_ENTRIES = 100;

// Deduplicates concurrent prefetch calls within a single SW activation.
let prefetchInFlight: Promise<void> | null = null;
let lastPrefetchTime = 0;
const MIN_PREFETCH_INTERVAL = 30 * 1000; // 30 seconds between prefetches

// Focus mode context — tracked so fillPrefetch() can fill with filtered URLs
// when the user has a category or subcategory filter active.
let focusContext: { categoryId?: string; subcategoryId?: string } | null = null;

// ── URL normaliser ────────────────────────────────────────────────────────────
//
// NOTE: This is the browser-extension copy of the URL normalisation logic.
// The canonical Deno version lives at:
//   supabase/functions/_shared/normalise.ts
// The Node.js (seeder) version is at:
//   scripts/lib/seed.js (see its header comment for cross-ref)
//
// ALL THREE COPIES MUST BE KEPT IN SYNC when adding new tracking params or
// normalisation rules. The extension cannot import the Deno module (it runs in
// a browser service worker), so this stand-alone implementation is intentional.
//
function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    u.protocol = 'https:';
    u.hostname = u.hostname.toLowerCase();
    if (u.hostname.startsWith('www.')) u.hostname = u.hostname.slice(4);
    // Canonical tracking-param strip list — keep in sync with:
    // - Android: MainViewModel.normalizeUrl() (trackingKeys set)
    // - Web: web/src/lib/constants.ts (TRACKING_PARAMS export)
    const STRIP = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_id','fbclid','gclid','ref','source','mc_cid','mc_eid'];
    STRIP.forEach((p) => u.searchParams.delete(p));
    u.hash = '';
    if (u.pathname !== '/' && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
    return u.toString();
  } catch { return null; }
}

function getDomain(url: string): string | null {
  try {
    const u = new URL(url);
    let domain = u.hostname.toLowerCase();
    if (domain.startsWith('www.')) domain = domain.slice(4);
    const parts = domain.split('.');
    if (parts.length >= 3) return parts.slice(-2).join('.');
    return domain;
  } catch { return null; }
}

// ── Retry helper ──────────────────────────────────────────────────────────────
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3, baseDelay = 500): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts) break;
      // Only retry on network/timeout errors, not 4xx
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      if (msg.includes('timeout') || msg.includes('fetch') || msg.includes('network') || msg.includes('abort')) {
        await new Promise(r => setTimeout(r, baseDelay * attempt));
        continue;
      }
      break;
    }
  }
  throw lastError;
}

// ── Badge helpers ─────────────────────────────────────────────────────────────
async function updateBadge(): Promise<void> {
  const stored = await chrome.storage.session.get(PREFETCH_KEY);
  const queue = (stored[PREFETCH_KEY] as { data: RoamData; cachedAt: number }[] | undefined) ?? [];
  const fresh = queue.filter(e => Date.now() - e.cachedAt < PREFETCH_TTL);
  const count = fresh.length;
  if (count > 0) {
    chrome.action.setBadgeText({ text: String(count) });
    chrome.action.setBadgeBackgroundColor({ color: '#6366f1' }); // Indigo-500
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// ── Recent domains helpers ────────────────────────────────────────────────────
async function getRecentDomains(): Promise<string[]> {
  const stored = await chrome.storage.local.get(RECENT_DOMAINS_KEY);
  const entries = (stored[RECENT_DOMAINS_KEY] ?? []) as { domain: string; ts: number }[];
  const now = Date.now();
  const fresh = entries.filter(e => now - e.ts < RECENT_DOMAINS_TTL).map(e => e.domain);
  return fresh.slice(0, RECENT_DOMAINS_MAX);
}

async function addRecentDomain(domain: string): Promise<void> {
  const stored = await chrome.storage.local.get(RECENT_DOMAINS_KEY);
  const entries = (stored[RECENT_DOMAINS_KEY] ?? []) as { domain: string; ts: number }[];
  const now = Date.now();
  const fresh = entries.filter(e => now - e.ts < RECENT_DOMAINS_TTL && e.domain !== domain);
  fresh.push({ domain, ts: now });
  while (fresh.length > RECENT_DOMAINS_MAX) fresh.shift();
  await chrome.storage.local.set({ [RECENT_DOMAINS_KEY]: fresh });
}

// ── Prefetch queue helpers ────────────────────────────────────────────────────
async function getPrefetchQueue(): Promise<{ data: RoamData; cachedAt: number }[]> {
  const stored = await chrome.storage.session.get(PREFETCH_KEY);
  const queue = (stored[PREFETCH_KEY] as { data: RoamData; cachedAt: number }[] | undefined) ?? [];
  return queue.filter(e => Date.now() - e.cachedAt < PREFETCH_TTL);
}

async function savePrefetchQueue(queue: { data: RoamData; cachedAt: number }[]): Promise<void> {
  await chrome.storage.session.set({ [PREFETCH_KEY]: queue });
  // Backup to persistent storage so the queue survives browser restarts.
  // chrome.storage.session is wiped when the browser closes (both Chrome MV3
  // and Firefox MV3). This persistent copy lets us serve cached URLs immediately
  // on the next launch, before the prefetch pipeline has time to refill.
  chrome.storage.local.set({ [PERSISTENT_PREFETCH_KEY]: queue }).catch(() => {});
  void updateBadge();
}

/** Restores the prefetch queue from persistent storage (survives browser restarts).
 *  Validates TTL and filters stale entries — called on SW startup. */
async function restorePersistentPrefetch(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(PERSISTENT_PREFETCH_KEY);
    const entries = (stored[PERSISTENT_PREFETCH_KEY] ?? []) as { data: RoamData; cachedAt: number }[];
    const fresh = entries.filter(e => Date.now() - e.cachedAt < PREFETCH_TTL);
    if (fresh.length > 0) {
      // Restore to session storage (primary store) so the first roam() call hits cache
      await chrome.storage.session.set({ [PREFETCH_KEY]: fresh });
      void updateBadge();
    }
    // Clean up stale persistent entries regardless
    if (fresh.length !== entries.length) {
      await chrome.storage.local.set({ [PERSISTENT_PREFETCH_KEY]: fresh });
    }
  } catch {
    // Never let prefetch restore failures block SW startup
  }
}

async function popFromPrefetch(): Promise<RoamData | null> {
  const queue = await getPrefetchQueue();
  if (queue.length === 0) return null;
  const entry = queue.shift()!;
  await savePrefetchQueue(queue);
  return entry.data;
}

// Simple HEAD check to validate URLs before serving (matching Android's isUrlReachable)
async function isUrlReachable(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal, redirect: 'follow' });
    clearTimeout(timeout);
    return res.ok;
  } catch { return false; }
}

async function fillPrefetch(): Promise<void> {
  const queue = await getPrefetchQueue();
  const needed = PREFETCH_TARGET - queue.length;
  if (needed <= 0) return;

  // Skip prefetch when focus mode is active — the queue would fill with
  // unfocused URLs that the next roam() call would have to discard anyway.
  if (focusContext) return;

  const recentDomains = await getRecentDomains();
  const existingDomains = new Set(queue.map(e => getDomain(e.data.url)).filter(Boolean));

  const promises: Promise<Response<RoamData>>[] = [];
  for (let i = 0; i < needed; i++) {
    const body: Record<string, unknown> = {};
    if (recentDomains.length > 0) body.exclude_domains = recentDomains;
    promises.push(callRoamApi(body));
  }

  const results = await Promise.allSettled(promises);
  const candidates: { data: RoamData; domain: string }[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.ok && r.value.data.url) {
      const domain = getDomain(r.value.data.url);
      if (domain && existingDomains.has(domain)) continue;
      candidates.push({ data: r.value.data, domain: domain ?? '' });
      if (domain) existingDomains.add(domain);
    }
  }
  // Parallel reachability checks — the HEAD requests are independent
  const reachableChecks = await Promise.allSettled(
    candidates.map(async c => ({ ...c, reachable: await isUrlReachable(c.data.url) }))
  );
  for (const r of reachableChecks) {
    if (r.status === 'fulfilled' && r.value.reachable) {
      queue.push({ data: r.value.data, cachedAt: Date.now() });
    }
  }
  await savePrefetchQueue(queue);
}

// ── Offline rating queue ──────────────────────────────────────────────────────
async function getPendingRatings(): Promise<{ url_id: string; vote: 1 | -1 }[]> {
  const stored = await chrome.storage.local.get(RATING_QUEUE_KEY);
  return (stored[RATING_QUEUE_KEY] ?? []) as { url_id: string; vote: 1 | -1 }[];
}

async function savePendingRatings(ratings: { url_id: string; vote: 1 | -1 }[]): Promise<void> {
  await chrome.storage.local.set({ [RATING_QUEUE_KEY]: ratings });
}

async function queueFailedRating(url_id: string, vote: 1 | -1): Promise<void> {
  const ratings = await getPendingRatings();
  // Deduplicate
  if (!ratings.some(r => r.url_id === url_id)) {
    ratings.push({ url_id, vote });
    await savePendingRatings(ratings);
  }
}

async function flushPendingRatings(): Promise<void> {
  const ratings = await getPendingRatings();
  if (ratings.length === 0) return;

  const batch = ratings.slice(0, RATING_FLUSH_BATCH);
  const supabase = getSupabase();

  // Fire all rating invocations in parallel
  const results = await Promise.allSettled(
    batch.map(async r => {
      try {
        const { error } = await supabase.functions.invoke('rate', { body: { url_id: r.url_id, value: r.vote } });
        return { url_id: r.url_id, ok: !error };
      } catch { return { url_id: r.url_id, ok: false }; }
    })
  );

  const failed = results
    .filter((r): r is PromiseFulfilledResult<{ url_id: string; ok: boolean }> => r.status === 'fulfilled')
    .filter(r => !r.value.ok)
    .map(r => r.value.url_id);

  // Keep only failed ones + any not in the batch
  const unprocessed = ratings.slice(RATING_FLUSH_BATCH);
  const remaining = batch.filter(r => failed.includes(r.url_id));
  await savePendingRatings([...remaining, ...unprocessed]);
}

// ── URL History ───────────────────────────────────────────────────────────────
async function recordUrlVisit(url: string, title: string): Promise<void> {
  const normalized = normalizeUrl(url) ?? url;
  const trimmedTitle = (title || url).slice(0, 200);
  const stored = await chrome.storage.local.get(URL_HISTORY_KEY);
  const history = (stored[URL_HISTORY_KEY] ?? []) as { url: string; title: string; visitedAt: number }[];
  // Remove duplicates
  const filtered = history.filter(e => normalizeUrl(e.url) !== normalized);
  filtered.unshift({ url: normalized, title: trimmedTitle, visitedAt: Date.now() });
  // Trim to max
  while (filtered.length > MAX_HISTORY_ENTRIES) filtered.pop();
  await chrome.storage.local.set({ [URL_HISTORY_KEY]: filtered });
}

// ── Global error capture ──────────────────────────────────────────────────────
self.addEventListener('unhandledrejection', (event) => {
  Sentry.captureException((event as PromiseRejectionEvent).reason ?? new Error('Unhandled promise rejection'), { tags: { context: 'sw-unhandledrejection' } });
});
self.addEventListener('error', (event) => {
  const e = event as ErrorEvent;
  Sentry.captureException(e.error ?? new Error(e.message || 'Unknown SW error'), { tags: { context: 'sw-error' } });
});

// ── Message router ────────────────────────────────────────────────────────────
// Restore persistent prefetch on SW startup so the first roam() call after a
// browser restart hits cache instead of waiting for a cold network round-trip.
restorePersistentPrefetch().finally(() => prefetchNext());
chrome.runtime.onStartup.addListener(() => { prefetchNext(); });
chrome.runtime.onInstalled.addListener(() => { prefetchNext(); });
chrome.runtime.onConnect.addListener((_port) => {
  prefetchNext();
  flushPendingRatings(); // flush ratings whenever popup opens
});

// Keyboard shortcut: Roam without opening popup (Chrome only — Firefox doesn't expose chrome.commands)
if (chrome.commands) {
  chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'roam') {
      try {
        const result = await roam();
        if (result.ok && result.data.url) {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) chrome.tabs.update(tab.id, { url: result.data.url });
        }
      } catch (err) {
        Sentry.captureException(err, { tags: { context: 'command-roam' } });
      }
    }
  });
}

chrome.runtime.onMessage.addListener(
  (message: Request, _sender, sendResponse: (r: Response) => void) => {
    dispatch(message).then(sendResponse).catch((err: Error) => {
      Sentry.captureException(err, { extra: { messageType: message.type }, tags: { context: 'background-dispatch' } });
      sendResponse({ ok: false, error: err.message });
    });
    return true;
  }
);

async function dispatch(req: Request): Promise<Response> {
  const result = await _dispatch(req);
  if (!result.ok) {
    const expected = new Set(['SIGN_IN_EMAIL', 'SIGN_UP_EMAIL', 'GET_PROFILE']);
    if (!expected.has(req.type)) {
      Sentry.captureMessage(`[bg] ${req.type} failed: ${result.error}`, { level: 'error', tags: { messageType: req.type } });
    }
  }
  return result;
}

async function _dispatch(req: Request): Promise<Response> {
  switch (req.type) {
    case 'GET_STATE':             return getState();
    case 'SIGN_IN_GOOGLE':        return signInWithOAuth('google');
    case 'SIGN_IN_EMAIL':         return signInWithEmail(req.email, req.password);
    case 'SIGN_UP_EMAIL':         return signUpWithEmail(req.email, req.password);
    case 'EXCHANGE_CODE':         return exchangeCode(req.code);
    case 'SAVE_SESSION':          return saveSession(req.accessToken, req.refreshToken);
    case 'SIGN_OUT':              return signOut();
    case 'GET_CATEGORIES':        return getCategories();
    case 'GET_USER_CATEGORIES':   return getUserCategories();
    case 'SET_USER_CATEGORIES':   return setUserCategories(req.categoryIds);
    case 'GET_USER_INTERESTS':    return getUserInterests();
    case 'SET_USER_INTERESTS':    return setUserInterests(req.pillarIds, req.topicIds);
    case 'GET_ALL_SUBCATEGORIES': return getAllSubcategories();
    case 'ROAM':                  return roam(req.categoryId, req.subcategoryId);
    case 'ROAM_COLLECTION':       return roamCollection(req.collectionId);
    case 'ROAM_CATEGORY':         return roamCategory(req.categoryId);
    case 'RATE':                  return rate(req.url_id, req.vote);
    case 'CHECK_URL':             return checkUrl(req.url);
    case 'SUBMIT_URL':            return submitUrl(req.url, req.categoryId);
    case 'SAVE_LATER':            return saveLater(req.url, req.title);
    case 'GET_SAVED_URLS':        return getSavedUrls();
    case 'REMOVE_SAVED_URL':      return removeSavedUrl(req.savedUrlId);
    case 'SET_PAYWALL_PREF':      return setPaywallPref(req.skip);
    case 'SET_LANGUAGE_PREF':     return setLanguagePref(req.languages);
    case 'SET_DISCOVERY_MODE':    return setDiscoveryMode(req.mode);
    case 'SET_AUTO_TRANSLATE':    return setAutoTranslate(req.enabled);
    case 'SET_DISCOVERY_LANGUAGE': return setDiscoveryLanguage(req.language);
    case 'GET_COLLECTIONS':       return getCollections();
    case 'CREATE_COLLECTION':     return createCollection(req.name);
    case 'ADD_URL_TO_COLLECTION': return addUrlToCollection(req.url, req.collectionId);
    case 'DELETE_COLLECTION':     return deleteCollection(req.collectionId);
    case 'RENAME_COLLECTION':     return renameCollection(req.collectionId, req.name);
    case 'UPDATE_COLLECTION_PUBLIC': return updateCollectionPublic(req.collectionId, req.isPublic);
    case 'GET_PROFILE':           return getProfile();
    case 'GET_PROFILE_STATS':     return getProfileStats();
    case 'SEND_FEEDBACK':         return sendFeedback(req.message, req.email, req.platform);
    case 'REPORT_URL':            return reportUrl(req.url_id);
    case 'GET_SUBCATEGORIES':     return getSubcategories(req.categoryId);
    case 'GET_SUBCATEGORIES_FOR_CATEGORY': return getSubcategories(req.categoryId);
    case 'SET_PROFILE_PUBLIC':    return setProfilePublic(req.isPublic);
    case 'GET_PROFILE_PUBLIC':    return getProfilePublic();
    case 'SHARE_URL_WITH_USER':   return shareUrlWithUser(req.url, req.recipientId);
    case 'GET_SHARE_RECIPIENTS':  return getShareRecipients(req.search);
    case 'REPORT_ENGAGEMENT':     return reportEngagement(req.url_id, req.dwell_ms, req.skipped);
    case 'GET_NOTIFICATIONS':     return getNotifications();
    case 'GET_UNREAD_COUNT':      return getUnreadNotificationCount();
    case 'MARK_NOTIFICATIONS_READ': return markNotificationsRead();
    case 'DELETE_NOTIFICATION':   return deleteNotification(req.notificationId);
    case 'GET_BADGES':            return getBadges();
    case 'GET_URL_HISTORY':       return getUrlHistory(req.limit);
    case 'CLEAR_URL_HISTORY':     return clearUrlHistory();
    default:                      return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function getState(): Promise<Response<StateData>> {
  const { data: { session }, error } = await getSupabase().auth.getSession();
  if (error) return { ok: false, error: error.message };
  if (!session) return { ok: true, data: { signedIn: false } };

  const expiresAt = (session as any).expires_at as number | undefined ?? 0;
  if (expiresAt <= Math.floor(Date.now() / 1000) + 60) {
    const { data: refreshed, error: rErr } = await getSupabase().auth.refreshSession();
    if (rErr) {
      await clearAuthStorage();
      return { ok: true, data: { signedIn: false } };
    }
    if (!refreshed.session) return { ok: true, data: { signedIn: false } };
    return { ok: true, data: { signedIn: true, email: refreshed.session.user.email, userId: refreshed.session.user.id } };
  }

  return { ok: true, data: { signedIn: true, email: session.user.email, userId: session.user.id } };
}

async function signInWithOAuth(provider: 'google'): Promise<Response<StateData>> {
  // Try launchWebAuthFlow first (popup, no tab needed). Falls back to
  // tab + callback.html if identity API is unavailable or fails.
  console.log('[roam] signInWithOAuth: starting flow for', provider);

  try {
    // Use the stable web app callback URL instead of the ephemeral extension
    // origin. Firefox "Load Temporary Add-on" generates a random UUID per install,
    // making the extension origin impossible to whitelist in Supabase's Redirect
    // URLs. The web app's /auth/callback is already trusted by Supabase and works
    // with launchWebAuthFlow regardless of origin (it captures any final URL).
    const redirectTo = 'https://roamtheweb.app/auth/callback';
    console.log('[roam] signInWithOAuth: using redirectTo =', redirectTo);

    const { data, error } = await getSupabase().auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data.url) {
      console.error('[roam] signInWithOAuth: supabase error', error);
      Sentry.captureException(error || new Error('signInWithOAuth returned no URL'), { tags: { context: `signInWith_${provider}` } });
      return { ok: false, error: 'Could not open the sign-in page. Please try again.' };
    }
    console.log('[roam] signInWithOAuth: got OAuth URL, length =', data.url.length);

    // Path 1: launchWebAuthFlow (Chrome identity API or Firefox identity)
    if (chrome.identity?.launchWebAuthFlow) {
      console.log('[roam] signInWithOAuth: trying launchWebAuthFlow');
      try {
        // 120s timeout — launcWebAuthFlow can hang indefinitely if the user
        // closes the auth window or the redirect is rejected server-side.
        const resultUrl = await Promise.race([
          chrome.identity.launchWebAuthFlow({
            url: data.url,
            interactive: true,
          }),
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error('Auth flow timed out')), 120_000),
          ),
        ]);
        console.log('[roam] signInWithOAuth: launchWebAuthFlow returned', resultUrl ? 'URL' : 'null');

        if (resultUrl) {
          const parsed = parseAuthRedirect(resultUrl);
          console.log('[roam] signInWithOAuth: parsed redirect — accessToken:', !!parsed.accessToken, 'refreshToken:', !!parsed.refreshToken, 'code:', !!parsed.code);

          if (parsed.accessToken && parsed.refreshToken) {
            const { error: sessionErr } = await getSupabase().auth.setSession({
              access_token: parsed.accessToken,
              refresh_token: parsed.refreshToken,
            });
            if (sessionErr) {
              console.error('[roam] signInWithOAuth: setSession error', sessionErr);
              Sentry.captureException(sessionErr, { tags: { context: `signInWith_${provider}` } });
              return { ok: false, error: sessionErr.message };
            }
            const session = (await getSupabase().auth.getSession()).data.session;
            console.log('[roam] signInWithOAuth: success via launchWebAuthFlow, email =', session?.user.email);
            return { ok: true, data: { signedIn: true, email: session?.user.email, userId: session?.user.id } };
          }

          if (parsed.code) {
            console.log('[roam] signInWithOAuth: got code, exchanging');
            return exchangeCode(parsed.code);
          }

          console.warn('[roam] signInWithOAuth: launchWebAuthFlow returned URL but no tokens');
        }
      } catch (flowErr) {
        console.warn('[roam] signInWithOAuth: launchWebAuthFlow error, falling back to tab', flowErr);
      }
    }

    // Path 2: fallback — open tab + wait for callback.html to save the session
    console.log('[roam] signInWithOAuth: falling back to tab + callback');
    await chrome.tabs.create({ url: data.url });
    return { ok: true, data: { signedIn: false } }; // popup will poll for session
  } catch (err) {
    console.error('[roam] signInWithOAuth: unexpected error', err);
    Sentry.captureException(err, { tags: { context: `signInWith_${provider}` } });
    return { ok: false, error: 'Could not open the sign-in page. Please try again.' };
  }
}

/** Extracts access_token, refresh_token, or code from a redirect URL. */
function parseAuthRedirect(url: string): { accessToken?: string; refreshToken?: string; code?: string } {
  try {
    const u = new URL(url);
    const hash = u.hash.slice(1);
    const hashParams = new URLSearchParams(hash);
    return {
      accessToken: hashParams.get('access_token') || u.searchParams.get('access_token') || undefined,
      refreshToken: hashParams.get('refresh_token') || u.searchParams.get('refresh_token') || undefined,
      code: u.searchParams.get('code') || hashParams.get('code') || undefined,
    };
  } catch {
    return {};
  }
}

async function signInWithEmail(email: string, password: string): Promise<Response<StateData>> {
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { signedIn: true, email: data.user?.email, userId: data.user?.id } };
}

async function signUpWithEmail(email: string, password: string): Promise<Response<{ needsVerification: boolean }>> {
  const { data, error } = await getSupabase().auth.signUp({
    email,
    password,
    options: { emailRedirectTo: 'https://roamtheweb.app/auth/callback' },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { needsVerification: !data.session } };
}

async function exchangeCode(code: string): Promise<Response<StateData>> {
  const { error } = await getSupabase().auth.exchangeCodeForSession(code);
  if (error) { Sentry.captureException(error, { tags: { context: 'exchangeCode' } }); return { ok: false, error: error.message }; }
  return getState();
}

async function saveSession(accessToken: string, refreshToken: string): Promise<Response<StateData>> {
  try {
    const { error } = await getSupabase().auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) return { ok: false, error: error.message };
    return getState();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

async function signOut(): Promise<Response<StateData>> {
  const { error } = await getSupabase().auth.signOut();
  if (error) return { ok: false, error: error.message };
  await clearAuthStorage();
  return { ok: true, data: { signedIn: false } };
}

// ── Categories ────────────────────────────────────────────────────────────────
let categoriesCache: { items: CategoryItem[]; fetchedAt: number } | null = null;
const CATEGORIES_TTL = 20 * 60 * 1000;

async function getCategories(): Promise<Response<CategoryItem[]>> {
  const now = Date.now();
  if (categoriesCache && now - categoriesCache.fetchedAt < CATEGORIES_TTL) return { ok: true, data: categoriesCache.items };
  try {
    const { data, error } = await getSupabase().from('categories').select('id, name, icon, sort_order').order('sort_order');
    if (!error && data && data.length > 0) { categoriesCache = { items: data as CategoryItem[], fetchedAt: now }; return { ok: true, data: data as CategoryItem[] }; }
  } catch { /* fall through */ }
  return { ok: true, data: FALLBACK_CATEGORIES };
}

async function getUserCategories(): Promise<Response<{ categoryIds: string[] }>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: "You're not signed in. Please sign in and try again." };
  const { data, error } = await getSupabase().from('user_categories').select('category_id').eq('user_id', session.user.id);
  if (error) return { ok: false, error: "Couldn't load your categories. Please try again." };
  return { ok: true, data: { categoryIds: (data || []).map((r: any) => r.category_id) } };
}

async function setUserCategories(categoryIds: string[]): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: "You're not signed in. Please sign in and try again." };
  const { error: delError } = await getSupabase().from('user_categories').delete().eq('user_id', session.user.id);
  if (delError) return { ok: false, error: "Couldn't save your categories. Please try again." };
  if (categoryIds.length > 0) {
    const rows = categoryIds.map((id) => ({ user_id: session.user.id, category_id: id }));
    const { error: insError } = await getSupabase().from('user_categories').insert(rows);
    if (insError) return { ok: false, error: "Couldn't save your categories. Please try again." };
  }
  return { ok: true, data: null };
}

async function getUserInterests(): Promise<Response<{ mode: 'pillars' | 'topics'; pillarIds: string[]; topicIds: string[] }>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: "You're not signed in. Please sign in and try again." };
  const { data, error } = await getSupabase()
    .from('user_categories')
    .select('category_id, subcategory_id')
    .eq('user_id', session.user.id);
  if (error) return { ok: false, error: "Couldn't load your interests. Please try again." };
  const rows = data || [];
  const topicRows = rows.filter((r: any) => r.subcategory_id !== null);
  const pillarRows = rows.filter((r: any) => r.subcategory_id === null);
  if (topicRows.length > 0) {
    return { ok: true, data: { mode: 'topics', pillarIds: [], topicIds: topicRows.map((r: any) => r.subcategory_id) } };
  }
  return { ok: true, data: { mode: 'pillars', pillarIds: pillarRows.map((r: any) => r.category_id), topicIds: [] } };
}

async function getAllSubcategories(): Promise<Response<SubcategoryItem[]>> {
  try {
    const { data, error } = await getSupabase()
      .from('subcategories')
      .select('id, name, category_id, sort_order')
      .order('sort_order');
    if (error || !data) return { ok: true, data: [] };
    return { ok: true, data: data as SubcategoryItem[] };
  } catch {
    return { ok: true, data: [] };
  }
}

async function setUserInterests(pillarIds: string[], topicIds: string[]): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: "You're not signed in. Please sign in and try again." };
  const { error: delError } = await getSupabase().from('user_categories').delete().eq('user_id', session.user.id);
  if (delError) return { ok: false, error: "Couldn't save your preferences. Please try again." };
  if (topicIds.length > 0) {
    const { data: scData, error: scError } = await getSupabase()
      .from('subcategories')
      .select('id, category_id')
      .in('id', topicIds);
    if (scError || !scData) return { ok: false, error: "Couldn't save your preferences. Please try again." };
    const parentMap = Object.fromEntries((scData as any[]).map((r: any) => [r.id, r.category_id]));
    const rows = topicIds.map((id) => ({ user_id: session.user.id, category_id: parentMap[id], subcategory_id: id }));
    const { error: insError } = await getSupabase().from('user_categories').insert(rows);
    if (insError) return { ok: false, error: "Couldn't save your preferences. Please try again." };
  } else if (pillarIds.length > 0) {
    const rows = pillarIds.map((id) => ({ user_id: session.user.id, category_id: id }));
    const { error: insError } = await getSupabase().from('user_categories').insert(rows);
    if (insError) return { ok: false, error: "Couldn't save your preferences. Please try again." };
  }
  return { ok: true, data: null };
}

// ── Roam ──────────────────────────────────────────────────────────────────────
async function callRoamApi(body: Record<string, unknown> = {}): Promise<Response<RoamData>> {
  const recentDomains = await getRecentDomains();

  const mergedBody = { ...body };
  if (recentDomains.length > 0) {
    const existing = (body.exclude_domains as string[] | undefined) ?? [];
    mergedBody.exclude_domains = [...new Set([...existing, ...recentDomains])];
  }

  const invoker = async () => {
    const supabase = getSupabase();
    const { data, error } = await supabase.functions.invoke('roam', { body: mergedBody });
    if (error) {
      const status = (error as any).context?.status;
      if (status === 404) return { ok: true, data: { url: '' } } as Response<RoamData>;
      let parsed: { error?: string } | null = null;
      try { parsed = await (error as any).context?.json?.(); } catch { /* ignore */ }
      if (parsed?.error) return { ok: false, error: parsed.error } as Response<RoamData>;
      return { ok: false, error: error.message } as Response<RoamData>;
    }
    if (data?.error) return { ok: false, error: data.error } as Response<RoamData>;
    return { ok: true, data: data as RoamData } as Response<RoamData>;
  };

  try {
    const result = await withRetry(invoker, 3, 500);
    if (result.ok && result.data.url) {
      const domain = getDomain(result.data.url);
      if (domain) await addRecentDomain(domain);
    }
    return result;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Discovery failed. Please try again.' };
  }
}

async function prefetchNext(): Promise<void> {
  if (prefetchInFlight) return;
  // Guard against excessive prefetching — rate-limit to once per MIN_PREFETCH_INTERVAL
  if (Date.now() - lastPrefetchTime < MIN_PREFETCH_INTERVAL) return;
  lastPrefetchTime = Date.now();
  prefetchInFlight = (async () => {
    try {
      await fillPrefetch();
    } catch { /* never block the popup */ }
    finally { prefetchInFlight = null; }
  })();
}

async function roam(categoryId?: string, subcategoryId?: string): Promise<Response<RoamData>> {
  const hasFocus = categoryId || subcategoryId;

  // Track focus context so fillPrefetch() doesn't fill with unfocused URLs
  focusContext = hasFocus ? { categoryId, subcategoryId } : null;

  if (!hasFocus) {
    const cached = await popFromPrefetch();
    if (cached) {
      prefetchNext();
      void recordUrlVisit(cached.url, cached.title || cached.url); // fire-and-forget — don't block the response
      const translatedUrl = await maybeTranslate(cached.url);
      await chrome.storage.session.set({ auto_translate: false });
      return { ok: true, data: { ...cached, url: translatedUrl } };
    }

    if (prefetchInFlight) {
      await prefetchInFlight;
      const cached2 = await popFromPrefetch();
      if (cached2) {
        prefetchNext();
        void recordUrlVisit(cached2.url, cached2.title || cached2.url); // fire-and-forget — don't block the response
        const translatedUrl2 = await maybeTranslate(cached2.url);
        await chrome.storage.session.set({ auto_translate: false });
        return { ok: true, data: { ...cached2, url: translatedUrl2 } };
      }
    }
  }

  const body: Record<string, unknown> = {};
  if (categoryId) body.category_id = categoryId;
  if (subcategoryId) body.subcategory_id = subcategoryId;

  const live = await callRoamApi(body);
  if (live.ok && live.data.url) {
    void recordUrlVisit(live.data.url, live.data.title || live.data.url); // fire-and-forget — don't block the response
    // Store current URL for engagement tracking (Phase 1 — skip + dwell)
    chrome.storage.session.set({ [CURRENT_URL_KEY]: { url_id: live.data.id, served_at: Date.now() } }).catch(() => {});
    const translatedUrl = await maybeTranslate(live.data.url);
    await chrome.storage.session.set({ auto_translate: false });
    return { ok: true, data: { ...live.data, url: translatedUrl } };
  }
  return live;
}

async function roamCollection(collectionId: string): Promise<Response<RoamData>> {
  const result = await callRoamApi({ collection_id: collectionId });
  if (result.ok && result.data.url) {
    void recordUrlVisit(result.data.url, result.data.title || result.data.url); // fire-and-forget
    const translatedUrl = await maybeTranslate(result.data.url);
    return { ok: true, data: { ...result.data, url: translatedUrl } };
  }
  return result;
}

async function roamCategory(categoryId: string): Promise<Response<RoamData>> {
  // Category-specific browsing clears focus context so fillPrefetch can run again
  focusContext = null;
  const result = await callRoamApi({ category_id: categoryId });
  if (result.ok && result.data.url) {
    void recordUrlVisit(result.data.url, result.data.title || result.data.url); // fire-and-forget
    const translatedUrl = await maybeTranslate(result.data.url);
    return { ok: true, data: { ...result.data, url: translatedUrl } };
  }
  return result;
}

// ── Rate / Check / Submit ─────────────────────────────────────────────────────
async function rate(url_id: string, vote: 1 | -1): Promise<Response<null>> {
  const supabase = getSupabase();
  try {
    const { data, error } = await supabase.functions.invoke('rate', { body: { url_id, value: vote } });
    if (error) {
      await queueFailedRating(url_id, vote);
      return { ok: false, error: error.message };
    }
    if (data?.error) return { ok: false, error: data.error };
    await chrome.storage.session.remove(PREFETCH_KEY);
    return { ok: true, data: null };
  } catch {
    await queueFailedRating(url_id, vote);
    return { ok: false, error: 'Rating queued for retry.' };
  }
}

async function checkUrl(url: string): Promise<Response<CheckUrlData>> {
  const normalized = normalizeUrl(url);
  if (!normalized) return { ok: true, data: { known: false } };
  let { data, error } = await getSupabase().from('urls').select('id,category_id').eq('url', normalized).eq('approved', true).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (data) return { ok: true, data: { known: true, url_id: data.id as string, category_id: data.category_id ?? undefined } };
  const withSlash = normalized.endsWith('/') ? normalized : normalized + '/';
  ({ data, error } = await getSupabase().from('urls').select('id,category_id').eq('url', withSlash).eq('approved', true).maybeSingle());
  if (error) return { ok: false, error: error.message };
  if (data) return { ok: true, data: { known: true, url_id: data.id as string, category_id: data.category_id ?? undefined } };
  return { ok: true, data: { known: false } };
}

async function submitUrl(url: string, categoryId: string): Promise<Response<{ duplicate?: boolean; message?: string }>> {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!categoryId || !UUID_RE.test(categoryId)) return { ok: false, error: 'Invalid category selection.' };
  const { data, error } = await getSupabase().functions.invoke('submit-url', { body: { url, category_id: categoryId } });
  if (error) {
    type FnErr = Error & { context?: globalThis.Response };
    const ctx = (error as FnErr).context;
    let body: { error?: string; message?: string; duplicate?: boolean } | null = null;
    if (ctx && typeof ctx.json === 'function') {
      try { body = await ctx.json(); } catch { /* not JSON */ }
    }
    if (body?.duplicate) {
      return { ok: true, data: { duplicate: true, message: body.message ?? 'This URL is already in our database.' } };
    }
    return { ok: false, error: body?.error ?? body?.message ?? error.message };
  }
  if (data?.duplicate) {
    return { ok: true, data: { duplicate: true, message: data.message ?? 'This URL is already in our database.' } };
  }
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true, data: { message: data?.message ?? 'URL submitted for review' } };
}

// ── Save for later ────────────────────────────────────────────────────────────
async function saveLater(url: string, title?: string): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (session) {
    const { error } = await getSupabase()
      .from('saved_urls')
      .upsert(
        { user_id: session.user.id, url, title: title ?? '' },
        { onConflict: 'user_id,url' }
      );
    if (!error) return { ok: true, data: null };
  }
  const storage = await chrome.storage.local.get('saved_urls');
  const saved = (storage.saved_urls || []) as string[];
  if (!saved.includes(url)) { saved.push(url); await chrome.storage.local.set({ saved_urls: saved }); }
  return { ok: true, data: null };
}

async function getSavedUrls(): Promise<Response<SavedUrlItem[]>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: true, data: [] };
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await getSupabase()
    .from('saved_urls')
    .select('id, url, title, saved_at')
    .eq('user_id', session.user.id)
    .gt('saved_at', since)
    .order('saved_at', { ascending: false })
    .limit(50);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []) as SavedUrlItem[] };
}

async function removeSavedUrl(savedUrlId: string): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };
  const { error } = await getSupabase()
    .from('saved_urls')
    .delete()
    .eq('id', savedUrlId)
    .eq('user_id', session.user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// ── Preferences ───────────────────────────────────────────────────────────────
async function setPaywallPref(skip: boolean): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: "You're not signed in. Please sign in and try again." };
  await chrome.storage.local.set({ skip_paywalled: skip });
  const { error } = await getSupabase().from('user_settings').upsert({ user_id: session.user.id, skip_paywalled: skip }, { onConflict: 'user_id' });
  if (error) console.warn('[roam] setPaywallPref DB error:', error.message);
  return { ok: true, data: null };
}

async function setLanguagePref(languages: string[]): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: "You're not signed in. Please sign in and try again." };
  const langs = languages.length > 0 ? languages : ['en'];
  await chrome.storage.local.set({ preferred_languages: langs });
  const { error } = await getSupabase().from('user_settings').upsert({ user_id: session.user.id, preferred_languages: langs }, { onConflict: 'user_id' });
  if (error) console.warn('[roam] setLanguagePref DB error:', error.message);
  return { ok: true, data: null };
}

async function setDiscoveryMode(mode: 'discovery' | 'deep_dive'): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: "You're not signed in. Please sign in and try again." };
  await chrome.storage.local.set({ discovery_mode: mode });
  const { error } = await getSupabase().from('user_settings').upsert({ user_id: session.user.id, discovery_mode: mode }, { onConflict: 'user_id' });
  if (error) console.warn('[roam] setDiscoveryMode DB error:', error.message);
  return { ok: true, data: null };
}

async function setDiscoveryLanguage(language: string): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: "You're not signed in. Please sign in and try again." };
  await chrome.storage.local.set({ preferred_languages: [language] });
  const { error } = await getSupabase().from('user_settings').upsert({ user_id: session.user.id, preferred_languages: [language] }, { onConflict: 'user_id' });
  if (error) console.warn('[roam] setDiscoveryLanguage DB error:', error.message);
  return { ok: true, data: null };
}

async function setAutoTranslate(enabled: boolean): Promise<Response<null>> {
  await chrome.storage.session.set({ auto_translate: enabled });
  return { ok: true, data: null };
}

// ── Translate URL helper ──────────────────────────────────────────────────────
async function maybeTranslate(url: string): Promise<string> {
  const [session, local] = await Promise.all([
    chrome.storage.session.get('auto_translate'),
    chrome.storage.local.get('translate_language'),
  ]);
  if (!session.auto_translate) return url;
  const targetLang = (local.translate_language as string) ?? 'en';
  return `https://translate.google.com/translate?sl=auto&tl=${targetLang}&u=${encodeURIComponent(url)}`;
}

// ── Collections ───────────────────────────────────────────────────────────────
async function getCollections(): Promise<Response<Collection[]>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: "You're not signed in. Please sign in and try again." };
  const { data, error } = await getSupabase().from('collections').select('id,name,slug,is_public,item_count:collection_items(count)').eq('user_id', session.user.id).order('name');
  if (error) return { ok: false, error: error.message };
  const collections = (data || []).map((c: any) => ({ id: c.id, name: c.name, slug: c.slug, is_public: c.is_public, item_count: Array.isArray(c.item_count) && c.item_count[0]?.count ? c.item_count[0].count : 0 }));
  return { ok: true, data: collections };
}

async function createCollection(name: string): Promise<Response<Collection>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: "You're not signed in. Please sign in and try again." };
  const { data, error } = await getSupabase().functions.invoke('collection', {
    body: { action: 'create', name },
  });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  if (!data?.id) return { ok: false, error: "Couldn't create collection." };
  return { ok: true, data: { id: data.id, name: data.name, slug: data.slug, is_public: data.is_public, item_count: 0 } };
}

async function addUrlToCollection(url: string, collectionId: string): Promise<Response<null>> {
  const normalized = normalizeUrl(url);
  if (!normalized) return { ok: false, error: "That doesn't look like a valid URL." };
  const { data: urlData, error: urlError } = await getSupabase().from('urls').select('id').eq('url', normalized).eq('approved', true).maybeSingle();
  if (urlError) return { ok: false, error: "Couldn't add to collection. Please try again." };
  let urlId = urlData?.id;
  if (!urlId) {
    const { data: newUrl, error: createError } = await getSupabase().from('urls').insert({ url: normalized, original_url: normalized, approved: false, source: 'user_submission' }).select('id').single();
    if (createError) return { ok: false, error: "Couldn't add to collection. Please try again." };
    urlId = newUrl.id;
  }
  const { data, error: addError } = await getSupabase().functions.invoke('collection', {
    body: { action: 'add_item', collection_id: collectionId, url_id: urlId },
  });
  if (addError) return { ok: false, error: addError.message };
  if (data?.error) {
    if (data.error.includes('already in collection')) return { ok: true, data: null };
    return { ok: false, error: data.error };
  }
  return { ok: true, data: null };
}

async function deleteCollection(collectionId: string): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };
  const { error } = await getSupabase().from('collections').delete().eq('id', collectionId).eq('user_id', session.user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

async function renameCollection(collectionId: string, name: string): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };
  const { error } = await getSupabase().from('collections').update({ name }).eq('id', collectionId).eq('user_id', session.user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

async function updateCollectionPublic(collectionId: string, isPublic: boolean): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };
  const { error } = await getSupabase().from('collections').update({ is_public: isPublic }).eq('id', collectionId).eq('user_id', session.user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// ── Subcategories ─────────────────────────────────────────────────────────────
async function getSubcategories(categoryId: string): Promise<Response<SubcategoryItem[]>> {
  const { data, error } = await getSupabase()
    .from('subcategories')
    .select('id, name, category_id, sort_order')
    .eq('category_id', categoryId)
    .order('sort_order');
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []) as SubcategoryItem[] };
}

// ── Profile ───────────────────────────────────────────────────────────────────
async function getProfile(): Promise<Response<ProfileData>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };
  const { data, error } = await getSupabase().from('profiles').select('username').eq('id', session.user.id).single();
  if (error || !data) return { ok: false, error: 'Profile not found.' };
  return { ok: true, data: { username: data.username } };
}

async function getProfileStats(): Promise<Response<{ roamed: number; submitted: number }>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };
  const { data: stats, error } = await getSupabase()
    .from('profiles')
    .select('roamed_count, submitted_count')
    .eq('id', session.user.id)
    .single();
  if (error || !stats) return { ok: true, data: { roamed: 0, submitted: 0 } };
  return { ok: true, data: { roamed: (stats as any).roamed_count ?? 0, submitted: (stats as any).submitted_count ?? 0 } };
}

// ── Feedback & moderation ─────────────────────────────────────────────────────
async function sendFeedback(message: string, email: string | undefined, platform: string): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session) headers['Authorization'] = `Bearer ${session.access_token}`;
  const res = await fetch(`${__SUPABASE_URL__}/functions/v1/feedback`, { method: 'POST', headers, body: JSON.stringify({ message, email: email || undefined, platform }) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: (err as any).error ?? "Couldn't send your feedback. Please try again." };
  }
  return { ok: true, data: null };
}

async function reportUrl(url_id: string): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'You must be signed in to report a link.' };
  const res = await fetch(`${__SUPABASE_URL__}/functions/v1/report-url`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }, body: JSON.stringify({ url_id }) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: (err as any).error ?? "Couldn't report the link. Please try again." };
  }
  return { ok: true, data: null };
}

// ── Profile privacy settings ──────────────────────────────────────────────────
async function setProfilePublic(isPublic: boolean): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };
  const { error } = await getSupabase()
    .from('profiles')
    .update({ is_public: isPublic })
    .eq('id', session.user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

async function getProfilePublic(): Promise<Response<{ is_public: boolean; username: string }>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('is_public, username')
    .eq('id', session.user.id)
    .single();
  if (error || !data) return { ok: false, error: 'Profile not found.' };
  return {
    ok: true,
    data: { is_public: data.is_public, username: data.username },
  };
}

// ── Engagement reporting ─────────────────────────────────────────────────────
async function reportEngagement(url_id: string, dwell_ms: number, skipped: boolean): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: true, data: null }; // silently skip if not signed in

  try {
    const res = await fetch(`${__SUPABASE_URL__}/functions/v1/report-engagement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ url_id, dwell_ms, skipped }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('[roam] reportEngagement failed:', (err as any).error ?? res.status);
    }
  } catch {
    // Never block UX — engagement reporting is fire-and-forget
  }
  return { ok: true, data: null };
}

// ── URL sharing ───────────────────────────────────────────────────────────────
async function shareUrlWithUser(url: string, recipientId: string): Promise<Response<{ share_id?: string; message?: string }>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };
  const normalized = normalizeUrl(url);
  if (!normalized) return { ok: false, error: 'Invalid URL.' };

  let urlId: string | undefined;
  const { data: urlData } = await getSupabase()
    .from('urls')
    .select('id')
    .eq('url', normalized)
    .eq('approved', true)
    .maybeSingle();
  urlId = urlData?.id;

  if (!urlId) {
    const withSlash = normalized.endsWith('/') ? normalized : normalized + '/';
    const { data: altData } = await getSupabase()
      .from('urls')
      .select('id')
      .eq('url', withSlash)
      .eq('approved', true)
      .maybeSingle();
    urlId = altData?.id;
  }

  if (!urlId) {
    const { data: newUrl, error: createError } = await getSupabase()
      .from('urls')
      .insert({ url: normalized, original_url: normalized, approved: false, source: 'user_submission' })
      .select('id')
      .single();
    if (createError) return { ok: false, error: "Couldn't create URL record." };
    urlId = newUrl.id;
  }

  const { data, error } = await getSupabase().functions.invoke('share-url', {
    body: { action: 'share', recipient_id: recipientId, url_id: urlId },
  });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true, data: { share_id: data?.share_id, message: data?.message } };
}

async function getShareRecipients(search?: string): Promise<Response<Array<{ user_id: string; username: string; display_name: string | null; avatar_url: string | null; relationship: string }>>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };
  const { data, error } = await getSupabase().functions.invoke('share-url', {
    body: { action: 'recipients', search: search || undefined },
  });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true, data: (data?.recipients ?? []) as any[] };
}

// ── Notifications ─────────────────────────────────────────────────────────────
async function getNotifications(): Promise<Response<any[]>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };
  const { data, error } = await getSupabase()
    .from('notifications')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []) as any[] };
}

async function getUnreadNotificationCount(): Promise<Response<number>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: true, data: 0 };
  const { count, error } = await getSupabase()
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', session.user.id)
    .eq('read', false);
  if (error) return { ok: true, data: 0 };
  return { ok: true, data: count ?? 0 };
}

async function markNotificationsRead(): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };
  const { error } = await getSupabase()
    .from('notifications')
    .update({ read: true })
    .eq('user_id', session.user.id)
    .eq('read', false);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

async function deleteNotification(notificationId: string): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };
  const { error } = await getSupabase()
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', session.user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// ── Badges ────────────────────────────────────────────────────────────────────
async function getBadges(): Promise<Response<any[]>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };
  const { data, error } = await getSupabase()
    .rpc('get_user_badges', { p_user_id: session.user.id });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []) as any[] };
}

// ── URL History ───────────────────────────────────────────────────────────────
async function getUrlHistory(limit?: number): Promise<Response<{ url: string; title: string; visitedAt: number }[]>> {
  const stored = await chrome.storage.local.get(URL_HISTORY_KEY);
  const history = (stored[URL_HISTORY_KEY] ?? []) as { url: string; title: string; visitedAt: number }[];
  return { ok: true, data: history.slice(0, limit ?? 100) };
}

async function clearUrlHistory(): Promise<Response<null>> {
  await chrome.storage.local.remove(URL_HISTORY_KEY);
  return { ok: true, data: null };
}

console.log('[roam] background service worker started');