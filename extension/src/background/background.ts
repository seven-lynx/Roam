// background.ts — Roam extension background service worker
//
// Event-driven only. No background loops.
// Chrome may terminate and restart this SW at any time.
// The Supabase client rehydrates its session from chrome.storage.local automatically.

import { Sentry } from '../lib/sentry';
import { validateEnvironment } from '../lib/env';
import type { Request, Response, StateData, RoamData, CheckUrlData, Collection, CategoryItem, ProfileData } from '../lib/messages';
import { getSupabase, clearAuthStorage } from '../lib/supabase';
import { FALLBACK_CATEGORIES } from '../lib/constants';

declare const __SUPABASE_URL__: string;

// Validate env vars at SW startup. Throws (crashing the SW with a clear message) if missing.
validateEnvironment();

const PREFETCH_KEY = 'prefetch';
const PREFETCH_TTL = 5 * 60 * 1000; // 5 minutes

// Deduplicates concurrent prefetch calls within a single SW activation.
// If the popup is opened and Roam is clicked before the prefetch completes,
// roam() awaits this promise instead of issuing a second parallel API call.
let prefetchInFlight: Promise<void> | null = null;

// ── URL normaliser ────────────────────────────────────────────────────────────
function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    u.protocol = 'https:';
    u.hostname = u.hostname.toLowerCase();
    if (u.hostname.startsWith('www.')) u.hostname = u.hostname.slice(4);
    const STRIP = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid','mc_cid','mc_eid','ref'];
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
    return domain;
  } catch { return null; }
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
// Pre-warm the prefetch cache on browser startup and extension install/update,
// so the first popup open after a browser restart is already near-instant.
chrome.runtime.onStartup.addListener(() => { prefetchNext(); });
chrome.runtime.onInstalled.addListener(() => { prefetchNext(); });
chrome.runtime.onConnect.addListener((_port) => { prefetchNext(); });

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
    case 'SIGN_IN_GITHUB':        return signInWithOAuth('github');
    case 'SIGN_IN_EMAIL':         return signInWithEmail(req.email, req.password);
    case 'SIGN_UP_EMAIL':         return signUpWithEmail(req.email, req.password);
    case 'EXCHANGE_CODE':         return exchangeCode(req.code);
    case 'SAVE_SESSION':          return saveSession(req.accessToken, req.refreshToken);
    case 'SIGN_OUT':              return signOut();
    case 'GET_CATEGORIES':        return getCategories();
    case 'GET_USER_CATEGORIES':   return getUserCategories();
    case 'SET_USER_CATEGORIES':   return setUserCategories(req.categoryIds);
    case 'ROAM':                  return roam();
    case 'ROAM_COLLECTION':       return roamCollection(req.collectionId);
    case 'ROAM_CATEGORY':         return roamCategory(req.categoryId);
    case 'RATE':                  return rate(req.url_id, req.vote);
    case 'CHECK_URL':             return checkUrl(req.url);
    case 'SUBMIT_URL':            return submitUrl(req.url, req.categoryId);
    case 'SAVE_LATER':            return saveLater(req.url);
    case 'SET_PAYWALL_PREF':      return setPaywallPref(req.skip);
    case 'SET_LANGUAGE_PREF':     return setLanguagePref(req.languages);
    case 'SET_DISCOVERY_MODE':    return setDiscoveryMode(req.mode);
    case 'SET_AUTO_TRANSLATE':    return setAutoTranslate(req.enabled);
    case 'GET_COLLECTIONS':       return getCollections();
    case 'CREATE_COLLECTION':     return createCollection(req.name);
    case 'ADD_URL_TO_COLLECTION': return addUrlToCollection(req.url, req.collectionId);
    case 'GET_PROFILE':           return getProfile();
    case 'SEND_FEEDBACK':         return sendFeedback(req.message, req.email, req.platform);
    case 'REPORT_URL':            return reportUrl(req.url_id);
    default:                      return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function getState(): Promise<Response<StateData>> {
  const { data: { session }, error } = await getSupabase().auth.getSession();
  if (error) return { ok: false, error: error.message };
  if (!session) return { ok: true, data: { signedIn: false } };

  // With autoRefreshToken disabled, refresh manually when the access token
  // has expired or is about to (within 60 s). This is the only place refresh
  // needs to happen — getState() is always the first call the popup makes.
  const expiresAt = (session as any).expires_at as number | undefined ?? 0;
  if (expiresAt <= Math.floor(Date.now() / 1000) + 60) {
    const { data: refreshed, error: rErr } = await getSupabase().auth.refreshSession();
    if (rErr) {
      // Refresh token invalid/expired — clear storage and prompt re-auth.
      await clearAuthStorage();
      return { ok: true, data: { signedIn: false } };
    }
    if (!refreshed.session) return { ok: true, data: { signedIn: false } };
    return { ok: true, data: { signedIn: true, email: refreshed.session.user.email, userId: refreshed.session.user.id } };
  }

  return { ok: true, data: { signedIn: true, email: session.user.email, userId: session.user.id } };
}

async function signInWithOAuth(provider: 'google' | 'github'): Promise<Response<StateData>> {
  const redirectTo = chrome.runtime.getURL('callback.html');
  try {
    const { data, error } = await getSupabase().auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } });
    if (error || !data.url) {
      Sentry.captureException(error || new Error('signInWithOAuth returned no URL'), { tags: { context: `signInWith_${provider}` } });
      return { ok: false, error: 'Could not open the sign-in page. Please try again.' };
    }
    await chrome.tabs.create({ url: data.url });
    return { ok: true, data: { signedIn: false } };
  } catch (err) {
    Sentry.captureException(err, { tags: { context: `signInWith_${provider}` } });
    return { ok: false, error: 'Could not open the sign-in page. Please try again.' };
  }
}

async function signInWithEmail(email: string, password: string): Promise<Response<StateData>> {
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { signedIn: true, email: data.user?.email, userId: data.user?.id } };
}

async function signUpWithEmail(email: string, password: string): Promise<Response<{ needsVerification: boolean }>> {
  const { data, error } = await getSupabase().auth.signUp({ email, password });
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
  if (delError) return { ok: false, error: "Couldn't save your preferences. Please try again." };
  if (categoryIds.length > 0) {
    const rows = categoryIds.map((id) => ({ user_id: session.user.id, category_id: id }));
    const { error: insError } = await getSupabase().from('user_categories').insert(rows);
    if (insError) return { ok: false, error: "Couldn't save your preferences. Please try again." };
  }
  return { ok: true, data: null };
}

// ── Roam ──────────────────────────────────────────────────────────────────────
async function callRoamApi(body: Record<string, unknown> = {}): Promise<Response<RoamData>> {
  const storage = await chrome.storage.local.get('lastRoamDomain');
  const excludeDomain = storage.lastRoamDomain ?? null;
  const { data, error } = await getSupabase().functions.invoke('roam', {
    body: { ...(excludeDomain ? { exclude_domain: excludeDomain } : {}), ...body },
  });
  if (error) {
    const status = (error as any).context?.status;
    if (status === 404) return { ok: true, data: { url: '' } as RoamData };
    try {
      const parsed = await (error as any).context?.json?.();
      if ((parsed as any)?.error) return { ok: false, error: (parsed as any).error };
    } catch { /* ignore */ }
    return { ok: false, error: error.message };
  }
  if (data?.error) return { ok: false, error: data.error };
  const newDomain = getDomain(data.url);
  if (newDomain) await chrome.storage.local.set({ lastRoamDomain: newDomain });
  const translatedUrl = await maybeTranslate(data.url);
  return { ok: true, data: { ...data, url: translatedUrl } as RoamData };
}

async function prefetchNext(): Promise<void> {
  if (prefetchInFlight) return; // already running — don't double-fetch
  prefetchInFlight = (async () => {
    try {
      const result = await callRoamApi();
      if (result.ok && result.data.url) {
        await chrome.storage.session.set({ [PREFETCH_KEY]: { data: result.data, cachedAt: Date.now() } });
      }
    } catch { /* never block the popup */ }
    finally { prefetchInFlight = null; }
  })();
}

async function roam(): Promise<Response<RoamData>> {
  const stored = await chrome.storage.session.get(PREFETCH_KEY);
  const cached = stored[PREFETCH_KEY] as { data: RoamData; cachedAt: number } | undefined;
  if (cached && Date.now() - cached.cachedAt < PREFETCH_TTL) {
    await chrome.storage.session.remove(PREFETCH_KEY);
    prefetchNext(); // fire-and-forget — restock for next click
    return { ok: true, data: cached.data };
  }
  // Cache miss — if a prefetch is already in flight, await it rather than
  // issuing a second parallel API call (happens when user clicks Roam fast).
  if (prefetchInFlight) {
    await prefetchInFlight;
    const stored2 = await chrome.storage.session.get(PREFETCH_KEY);
    const cached2 = stored2[PREFETCH_KEY] as { data: RoamData; cachedAt: number } | undefined;
    if (cached2 && Date.now() - cached2.cachedAt < PREFETCH_TTL) {
      await chrome.storage.session.remove(PREFETCH_KEY);
      prefetchNext();
      return { ok: true, data: cached2.data };
    }
  }
  return callRoamApi(); // true cache miss — live call
}

async function roamCollection(collectionId: string): Promise<Response<RoamData>> {
  const { data, error } = await getSupabase().functions.invoke('roam', { body: { collection_id: collectionId } });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  const newDomain = getDomain(data.url);
  if (newDomain) await chrome.storage.local.set({ lastRoamDomain: newDomain });
  const translatedUrl = await maybeTranslate(data.url);
  return { ok: true, data: { ...data, url: translatedUrl } as RoamData };
}

async function roamCategory(categoryId: string): Promise<Response<RoamData>> {
  const { data, error } = await getSupabase().functions.invoke('roam', { body: { category_id: categoryId } });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  const newDomain = getDomain(data.url);
  if (newDomain) await chrome.storage.local.set({ lastRoamDomain: newDomain });
  const translatedUrl = await maybeTranslate(data.url);
  return { ok: true, data: { ...data, url: translatedUrl } as RoamData };
}

// ── Rate / Check / Submit ─────────────────────────────────────────────────────
async function rate(url_id: string, vote: 1 | -1): Promise<Response<null>> {
  const { data, error } = await getSupabase().functions.invoke('rate', { body: { url_id, value: vote } });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true, data: null };
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

async function submitUrl(url: string, categoryId: string): Promise<Response<null>> {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!categoryId || !UUID_RE.test(categoryId)) return { ok: false, error: 'Invalid category selection.' };
  const { data, error } = await getSupabase().functions.invoke('submit-url', { body: { url, category_id: categoryId } });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true, data: null };
}

// ── Save for later ────────────────────────────────────────────────────────────
async function saveLater(url: string): Promise<Response<null>> {
  const storage = await chrome.storage.local.get('saved_urls');
  const saved = (storage.saved_urls || []) as string[];
  if (!saved.includes(url)) { saved.push(url); await chrome.storage.local.set({ saved_urls: saved }); }
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

async function setAutoTranslate(enabled: boolean): Promise<Response<null>> {
  await chrome.storage.local.set({ auto_translate: enabled });
  return { ok: true, data: null };
}

// ── Translate URL helper ──────────────────────────────────────────────────────
// Wraps a URL in Google Translate when auto-translate is enabled and the user
// has a non-English preferred language. Uses the first non-English language.
async function maybeTranslate(url: string): Promise<string> {
  const stored = await chrome.storage.local.get(['auto_translate', 'preferred_languages']);
  if (!stored.auto_translate) return url;
  const langs: string[] = stored.preferred_languages ?? ['en'];
  const targetLang = langs[0] ?? 'en';
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
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const { data, error } = await getSupabase().from('collections').insert({ name, slug, user_id: session.user.id, is_public: false }).select().single();
  if (error) return { ok: false, error: error.message };
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
  const { error: addError } = await getSupabase().from('collection_items').insert({ collection_id: collectionId, url_id: urlId });
  if (addError) {
    if (addError.message.includes('unique') || addError.message.includes('duplicate')) return { ok: true, data: null };
    return { ok: false, error: "Couldn't add to collection. Please try again." };
  }
  return { ok: true, data: null };
}

// ── Profile ───────────────────────────────────────────────────────────────────
async function getProfile(): Promise<Response<ProfileData>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };
  const { data, error } = await getSupabase().from('profiles').select('username').eq('id', session.user.id).single();
  if (error || !data) return { ok: false, error: 'Profile not found.' };
  return { ok: true, data: { username: data.username } };
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

console.log('[roam] background service worker started');
