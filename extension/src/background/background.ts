// background.ts — Roam extension background service worker
//
// Event-driven only. No background loops.
// Chrome may terminate and restart this SW at any time.
// The Supabase client rehydrates its session from chrome.storage.local automatically.

import { Sentry } from '../lib/sentry';
import { validateEnvironment } from '../lib/env';
import type { Request, Response, StateData, RoamData, CheckUrlData, CategoryItem, ProfileData, SubcategoryItem, SavedUrlItem, ChallengeData, BadgeData, ProfileStatsData, LocalSavedUrl } from '../lib/messages';
import { getSupabase, clearAuthStorage } from '../lib/supabase';
import { FALLBACK_CATEGORIES } from '../lib/constants';
import { addLocalSaved, normaliseLocalSaved, removeLocalSaved } from '../lib/local-saved';
import { EDGE_UNREACHABLE_MESSAGE, isRetryableEdgeFailure } from '../lib/edge-error';
import { parseRoamExhaustion } from '../lib/exhaustion';
import { dispatchReport, unknownMessageTypeResponse } from '../lib/dispatch-report';
import { getDomain, normalizeUrl } from '../lib/url';
import { getCollections, createCollection, addUrlToCollection, deleteCollection, renameCollection, updateCollectionPublic } from './handlers/collections';
import { getUserSettings, setPaywallPref, setLanguagePref, setDiscoveryMode, setAutoTranslate, maybeTranslate } from './handlers/preferences';
import { getNotifications, getUnreadNotificationCount, markNotificationsRead, deleteNotification, markNotificationRead, clearNotifications } from './handlers/notifications';
import { NOTIFY_ALARM, handleNotificationClick, pollNotifications, registerNotificationAlarm, setDesktopNotifications } from './notify';
import { followUser, unfollowUser, getFollowers, getFollowing, getActivityFeed } from './social';
import { getMyProfile, setProfileFields, claimUsername } from './profile';
import { changePassword } from './account';
import { getState, signInWithOAuth, signInWithEmail, signUpWithEmail, exchangeCode, saveSession, signOut } from './auth';

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
const URL_HISTORY_KEY = 'extension_url_history';
const MAX_HISTORY_ENTRIES = 100;
const LOCAL_SAVED_KEY = 'saved_urls';
const SAVED_URLS_LIMIT = 200; // server-side list cap (web/Android show the full set)

// Deduplicates concurrent prefetch calls within a single SW activation.
let prefetchInFlight: Promise<void> | null = null;
let lastPrefetchTime = 0;
const MIN_PREFETCH_INTERVAL = 30 * 1000; // 30 seconds between prefetches

// Focus mode context — tracked so fillPrefetch() can fill with filtered URLs
// when the user has a category or subcategory filter active.
let focusContext: { categoryId?: string; subcategoryId?: string } | null = null;

// ── Retry helper ──────────────────────────────────────────────────────────────
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3, baseDelay = 500): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts) break;
      // Only retry on network/timeout errors, not 4xx. The SDK's own wording
      // ("Failed to send a request to the Edge Function") contains none of these
      // words, so its retryable classes are matched by name instead.
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      if (isRetryableEdgeFailure(err) || msg.includes('timeout') || msg.includes('fetch') || msg.includes('network') || msg.includes('abort')) {
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
    promises.push(callRoamApi(body, 1));
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
chrome.runtime.onStartup.addListener(() => { prefetchNext(); registerNotificationAlarm(); });
chrome.runtime.onInstalled.addListener(() => { prefetchNext(); registerNotificationAlarm(); });
chrome.runtime.onConnect.addListener((_port) => {
  prefetchNext();
  flushPendingRatings(); // flush ratings whenever popup opens
});

// Desktop notifications are alarm-driven (rule E.2: no background loops).
// The alarm is created on install/start-up and when the toggle is turned on —
// never at module scope, because re-creating it resets the next fire time and
// would starve the poll.
if (chrome.alarms?.onAlarm) {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === NOTIFY_ALARM) void pollNotifications();
  });
}
if (chrome.notifications?.onClicked) {
  chrome.notifications.onClicked.addListener((desktopId) => {
    void handleNotificationClick(desktopId);
  });
}

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
    const decision = dispatchReport(req.type, result);
    if (decision.report) {
      Sentry.captureMessage(`[bg] ${req.type} failed: ${result.error}`, { level: decision.level, tags: { messageType: req.type } });
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
    case 'GET_USER_INTERESTS':    return getUserInterests();
    case 'GET_USER_SETTINGS':     return getUserSettings();
    case 'SET_USER_INTERESTS':    return setUserInterests(req.pillarIds, req.topicIds);
    case 'GET_ALL_SUBCATEGORIES': return getAllSubcategories();
    case 'ROAM':                  return roam(req.categoryId, req.subcategoryId);
    case 'ROAM_COLLECTION':       return roamCollection(req.collectionId);
    case 'ROAM_CATEGORY':         return roamCategory(req.categoryId);
    case 'RATE':                  return rate(req.url_id, req.vote);
    case 'CHECK_URL':             return checkUrl(req.url);
    case 'SUBMIT_URL':            return submitUrl(req.url, req.categoryId, req.subcategoryId);
    case 'SAVE_LATER':            return saveLater(req.url, req.title);
    case 'GET_SAVED_URLS':        return getSavedUrls();
    case 'REMOVE_SAVED_URL':      return removeSavedUrl(req.savedUrlId);
    case 'SET_PAYWALL_PREF':      return setPaywallPref(req.skip);
    case 'SET_LANGUAGE_PREF':     return setLanguagePref(req.languages);
    case 'SET_DISCOVERY_MODE':    return setDiscoveryMode(req.mode);
    case 'SET_AUTO_TRANSLATE':    return setAutoTranslate(req.enabled);
    case 'GET_COLLECTIONS':       return getCollections();
    case 'CREATE_COLLECTION':     return createCollection(req.name);
    case 'ADD_URL_TO_COLLECTION': return addUrlToCollection(req.url, req.collectionId);
    case 'DELETE_COLLECTION':     return deleteCollection(req.collectionId);
    case 'RENAME_COLLECTION':     return renameCollection(req.collectionId, req.name);
    case 'UPDATE_COLLECTION_PUBLIC': return updateCollectionPublic(req.collectionId, req.isPublic);
    case 'GET_PROFILE':           return getProfile();
    case 'GET_MY_PROFILE':        return getMyProfile();
    case 'SET_PROFILE_FIELDS':    return setProfileFields(req.displayName, req.bio);
    case 'CLAIM_USERNAME':        return claimUsername(req.username);
    case 'CHANGE_PASSWORD':       return changePassword(req.currentPassword, req.newPassword);
    case 'GET_PROFILE_STATS':     return getProfileStats();
    case 'SEND_FEEDBACK':         return sendFeedback(req.message, req.email, req.platform);
    case 'REPORT_URL':            return reportUrl(req.url_id);
    case 'GET_SUBCATEGORIES_FOR_CATEGORY': return getSubcategories(req.categoryId);
    case 'SET_PROFILE_PUBLIC':    return setProfilePublic(req.isPublic);
    case 'SET_DESKTOP_NOTIFICATIONS': return setDesktopNotifications(req.enabled);
    case 'GET_PROFILE_PUBLIC':    return getProfilePublic();
    case 'SHARE_URL_WITH_USER':   return shareUrlWithUser(req.url, req.recipientId);
    case 'GET_SHARE_RECIPIENTS':  return getShareRecipients(req.search);
    case 'FOLLOW_USER':           return followUser(req.userId);
    case 'UNFOLLOW_USER':         return unfollowUser(req.userId);
    case 'GET_FOLLOWERS':         return getFollowers();
    case 'GET_FOLLOWING':         return getFollowing();
    case 'GET_ACTIVITY_FEED':     return getActivityFeed(req.limit);
    case 'GET_NOTIFICATIONS':     return getNotifications();
    case 'GET_UNREAD_COUNT':      return getUnreadNotificationCount();
    case 'MARK_NOTIFICATIONS_READ': return markNotificationsRead();
    case 'MARK_NOTIFICATION_READ': return markNotificationRead(req.notificationId);
    case 'CLEAR_NOTIFICATIONS':   return clearNotifications();
    case 'DELETE_NOTIFICATION':   return deleteNotification(req.notificationId);
    case 'GET_BADGES':            return getBadges();
    case 'GET_CHALLENGES':        return getChallenges();
    case 'GET_URL_HISTORY':       return getUrlHistory(req.limit);
    case 'CLEAR_URL_HISTORY':     return clearUrlHistory();
    default:                      return unknownMessageTypeResponse();
  }
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

async function getUserInterests(): Promise<Response<{ mode: 'pillars' | 'topics'; pillarIds: string[]; topicIds: string[] }>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: "You're not signed in. Please sign in and try again." };
  const { data, error } = await getSupabase()
    .from('user_categories')
    .select('category_id, subcategory_id')
    .eq('user_id', session.user.id);
  if (error) return { ok: false, error: "Couldn't load your interests. Please try again." };
  type InterestRow = { category_id: string; subcategory_id: string | null };
  const rows = (data ?? []) as InterestRow[];
  const topicRows = rows.filter((r) => r.subcategory_id !== null);
  const pillarRows = rows.filter((r) => r.subcategory_id === null);
  if (topicRows.length > 0) {
    return { ok: true, data: { mode: 'topics', pillarIds: [], topicIds: topicRows.map((r) => r.subcategory_id as string) } };
  }
  return { ok: true, data: { mode: 'pillars', pillarIds: pillarRows.map((r) => r.category_id), topicIds: [] } };
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
    const parentMap = Object.fromEntries((scData as Array<{ id: string; category_id: string }>).map((r) => [r.id, r.category_id]));
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

// What a 404 produces: no id, no url, no page. `url === ''` is the "nothing to
// serve" signal the call sites branch on; `exhaustion` is added by the caller below.
const EMPTY_ROAM: RoamData = { id: '', url: '', title: null, description: null, og_image_url: null };

async function callRoamApi(body: Record<string, unknown> = {}, maxAttempts = 3): Promise<Response<RoamData>> {
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
      // No response at all (DNS, TLS, a reset connection, a CORS rejection): throw it
      // so withRetry() can make another attempt instead of returning it as final.
      if (isRetryableEdgeFailure(error)) throw error;
      type FnError = {
        context?: {
          status?: number;
          json?: () => Promise<{ error?: string; reason?: string; scope?: string; available_later?: string | null }>;
        };
      };
      const fnErr = error as FnError;
      const status = fnErr.context?.status;
      let parsed: { error?: string; reason?: string; scope?: string; available_later?: string | null } | null = null;
      try { parsed = (await fnErr.context?.json?.()) ?? null; } catch { /* body consumed or not JSON - treat as absent */ }
      // 404 is an answer, not a failure: the RPC found nothing to serve and the body
      // says why (issue #120). The empty url keeps the "nothing to serve" contract the
      // call sites branch on, and the parsed reason lets them explain it instead of
      // dumping the user on a generic dead end. A 404 with no reason - an older
      // deployment - still parses to a generic payload.
      if (status === 404) {
        return { ok: true, data: { ...EMPTY_ROAM, exhaustion: parseRoamExhaustion(parsed) } };
      }
      if (parsed?.error) return { ok: false, error: parsed.error };
      return { ok: false, error: error.message };
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
    if (isRetryableEdgeFailure(err)) {
      // `context` carries the raw fetch error — the only place the real cause (DNS,
      // TLS, CORS, reset connection) is visible, and in the Firefox build the console
      // is the only signal we get: Sentry is stubbed out there.
      const cause = (err as { context?: unknown }).context;
      console.warn('[roam] edge unreachable:', cause instanceof Error ? cause.message : (err instanceof Error ? err.message : String(err)));
      // A user-initiated roam is worth reporting; the prefetch passes maxAttempts = 1
      // and must never flood Sentry during an outage.
      if (maxAttempts > 1) Sentry.captureException(err, { tags: { context: 'roam-unreachable' } });
      return { ok: false, error: EDGE_UNREACHABLE_MESSAGE };
    }
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
      return { ok: true, data: { ...cached, url: translatedUrl } };
    }

    if (prefetchInFlight) {
      await prefetchInFlight;
      const cached2 = await popFromPrefetch();
      if (cached2) {
        prefetchNext();
        void recordUrlVisit(cached2.url, cached2.title || cached2.url); // fire-and-forget — don't block the response
        const translatedUrl2 = await maybeTranslate(cached2.url);
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
    const translatedUrl = await maybeTranslate(live.data.url);
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

async function submitUrl(url: string, categoryId: string, subcategoryId?: string): Promise<Response<{ duplicate?: boolean; message?: string }>> {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!categoryId || !UUID_RE.test(categoryId)) return { ok: false, error: 'Invalid category selection.' };
  if (subcategoryId && !UUID_RE.test(subcategoryId)) return { ok: false, error: 'Invalid topic selection.' };
  const { data, error } = await getSupabase().functions.invoke('submit-url', { body: { url, category_id: categoryId, subcategory_id: subcategoryId } });
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
/** Local ids are prefixed so the popup can route removal without a server hit. */
const LOCAL_SAVED_ID_PREFIX = 'local:';

function localSavedItem(entry: LocalSavedUrl): SavedUrlItem {
  return {
    id: `${LOCAL_SAVED_ID_PREFIX}${entry.url}`,
    url: entry.url,
    title: entry.title || entry.url,
    saved_at: entry.savedAt ? new Date(entry.savedAt).toISOString() : '',
  };
}

async function readLocalSaved(): Promise<LocalSavedUrl[]> {
  const storage = await chrome.storage.local.get(LOCAL_SAVED_KEY);
  return normaliseLocalSaved(storage[LOCAL_SAVED_KEY]);
}

async function saveLater(url: string, title?: string): Promise<Response<null>> {
  const entry: LocalSavedUrl = { url, title: title ?? '', savedAt: Date.now() };
  const session = (await getSupabase().auth.getSession()).data.session;
  if (session) {
    const { error } = await getSupabase()
      .from('saved_urls')
      .upsert(
        { user_id: session.user.id, url, title: entry.title },
        { onConflict: 'user_id,url' }
      );
    if (!error) return { ok: true, data: null };
  }
  // Signed out, or the server write failed: keep the page locally so it is not lost.
  const local = addLocalSaved(await readLocalSaved(), entry);
  await chrome.storage.local.set({ [LOCAL_SAVED_KEY]: local });
  return { ok: true, data: null };
}

/** Pushes pages saved while signed out into the server table, then clears them. */
async function flushLocalSaved(userId: string): Promise<void> {
  const local = await readLocalSaved();
  if (local.length === 0) return;
  const rows = local.map((e) => ({ user_id: userId, url: e.url, title: e.title }));
  const { error } = await getSupabase()
    .from('saved_urls')
    .upsert(rows, { onConflict: 'user_id,url' });
  if (!error) await chrome.storage.local.remove(LOCAL_SAVED_KEY);
}

async function getSavedUrls(): Promise<Response<SavedUrlItem[]>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) {
    const local = await readLocalSaved();
    return { ok: true, data: local.map(localSavedItem) };
  }
  await flushLocalSaved(session.user.id);
  const { data, error } = await getSupabase()
    .from('saved_urls')
    .select('id, url, title, saved_at')
    .eq('user_id', session.user.id)
    .order('saved_at', { ascending: false })
    .limit(SAVED_URLS_LIMIT);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []) as SavedUrlItem[] };
}

async function removeSavedUrl(savedUrlId: string): Promise<Response<null>> {
  if (savedUrlId.startsWith(LOCAL_SAVED_ID_PREFIX)) {
    const url = savedUrlId.slice(LOCAL_SAVED_ID_PREFIX.length);
    const local = removeLocalSaved(await readLocalSaved(), url);
    await chrome.storage.local.set({ [LOCAL_SAVED_KEY]: local });
    return { ok: true, data: null };
  }
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

async function getProfileStats(): Promise<Response<ProfileStatsData>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };
  const empty: ProfileStatsData = { roamed: 0, submitted: 0, level: 1, xp_total: 0, streak_days: 0, max_streak: 0 };
  const { data: stats, error } = await getSupabase()
    .from('profiles')
    .select('roamed_count, submitted_count, xp_total, level, streak_days, max_streak')
    .eq('id', session.user.id)
    .single();
  if (error || !stats) return { ok: true, data: empty };
  const row = stats as {
    roamed_count?: number | null;
    submitted_count?: number | null;
    xp_total?: number | null;
    level?: number | null;
    streak_days?: number | null;
    max_streak?: number | null;
  };
  return {
    ok: true,
    data: {
      roamed: row.roamed_count ?? 0,
      submitted: row.submitted_count ?? 0,
      level: row.level ?? 1,
      xp_total: row.xp_total ?? 0,
      streak_days: row.streak_days ?? 0,
      max_streak: row.max_streak ?? 0,
    },
  };
}

// ── Feedback & moderation ─────────────────────────────────────────────────────
async function sendFeedback(message: string, email: string | undefined, platform: string): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session) headers['Authorization'] = `Bearer ${session.access_token}`;
  const res = await fetch(`${__SUPABASE_URL__}/functions/v1/feedback`, { method: 'POST', headers, body: JSON.stringify({ message, email: email || undefined, platform }) });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: err.error ?? "Couldn't send your feedback. Please try again." };
  }
  return { ok: true, data: null };
}

async function reportUrl(url_id: string): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'You must be signed in to report a link.' };
  const res = await fetch(`${__SUPABASE_URL__}/functions/v1/report-url`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }, body: JSON.stringify({ url_id }) });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: err.error ?? "Couldn't report the link. Please try again." };
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

type ShareRecipient = { user_id: string; username: string; display_name: string | null; avatar_url: string | null; relationship: string };

async function getShareRecipients(search?: string): Promise<Response<ShareRecipient[]>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };
  const { data, error } = await getSupabase().functions.invoke('share-url', {
    body: { action: 'recipients', search: search || undefined },
  });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true, data: (data?.recipients ?? []) as ShareRecipient[] };
}

// ── Badges ────────────────────────────────────────────────────────────────────
async function getBadges(): Promise<Response<BadgeData[]>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };
  const { data, error } = await getSupabase()
    .rpc('get_user_badges', { p_user_id: session.user.id });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []) as BadgeData[] };
}

// ── Challenges ────────────────────────────────────────────────────────────────
async function getChallenges(): Promise<Response<ChallengeData[]>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };
  const { data, error } = await getSupabase().functions.invoke('challenges');
  if (error) return { ok: false, error: error.message };
  const payload = (data ?? {}) as { challenges?: ChallengeData[] };
  return { ok: true, data: payload.challenges ?? [] };
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