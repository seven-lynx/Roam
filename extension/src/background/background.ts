// background.ts — Roam extension background service worker (task 5.6 / 5.7)
//
// Lifecycle: Chrome may terminate and restart this SW at any time.
// The Supabase client is created fresh on each activation; the auth session
// is rehydrated automatically from chrome.storage.local by the custom
// storage adapter in src/lib/supabase.ts.

import { Sentry } from '../lib/sentry'; // must be first — initialises Sentry if SENTRY_DSN is set
import type { Request, Response, StateData, RoamData, CheckUrlData, QueueState, Collection, CategoryItem, ProfileData } from '../lib/messages';
import { getSupabase, clearAuthStorage } from '../lib/supabase';

declare const __SUPABASE_URL__: string;
import {
  popHotUrl,
  popAnyUrl,
  clearQueue,
} from '../lib/queue';
import {
  initializeQueueManagement,
  cleanupOnSignOut,
  updateCategoryFilter,
  getQueueStats,
  fetchFreshUrls as queueFetchFreshUrls,
} from '../lib/queueManager';

// ── URL normaliser (mirrors the Edge Function's normalizeUrl) ────────────────
function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    u.protocol = 'https:';
    u.hostname = u.hostname.toLowerCase();
    if (u.hostname.startsWith('www.')) u.hostname = u.hostname.slice(4);
    const STRIP = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content',
                   'fbclid','gclid','mc_cid','mc_eid','ref'];
    STRIP.forEach((p) => u.searchParams.delete(p));
    u.hash = '';
    if (u.pathname !== '/' && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
    return u.toString();
  } catch {
    return null;
  }
}

// ── Domain extraction helper ──────────────────────────────────────────────────
function getDomain(url: string): string | null {
  try {
    const u = new URL(url);
    let domain = u.hostname.toLowerCase();
    if (domain.startsWith('www.')) domain = domain.slice(4);
    return domain;
  } catch {
    return null;
  }
}

// ── Global error capture ───────────────────────────────────────────────────
// Service worker context: use self.addEventListener (no window).
// These catch any thrown error or unhandled promise rejection that slips
// past a try/catch — including queueManager background loops.
self.addEventListener('unhandledrejection', (event) => {
  Sentry.captureException(
    (event as PromiseRejectionEvent).reason ?? new Error('Unhandled promise rejection'),
    { tags: { context: 'sw-unhandledrejection' } }
  );
});
self.addEventListener('error', (event) => {
  const e = event as ErrorEvent;
  Sentry.captureException(
    e.error ?? new Error(e.message || 'Unknown SW error'),
    { tags: { context: 'sw-error' } }
  );
});

// ── Message router ─────────────────────────────────────────────────────────
// Keep the SW alive while the popup has an open port connection.
chrome.runtime.onConnect.addListener((_port) => {
  // No-op: the open port itself prevents Chrome from terminating the SW.
});

chrome.runtime.onMessage.addListener(
  (message: Request, _sender, sendResponse: (r: Response) => void) => {
    dispatch(message)
      .then(sendResponse)
      .catch((err: Error) => {
        Sentry.captureException(err, {
          extra: { messageType: (message as any).type },
          tags: { context: 'background-dispatch' },
        });
        sendResponse({ ok: false, error: err.message });
      });
    return true; // keep the message channel open for the async response
  }
);

async function dispatch(req: Request): Promise<Response> {
  const result = await _dispatch(req);

  // Capture unexpected {ok: false} to Sentry so beta errors surface automatically.
  // Skip expected user-input failures (wrong password, sign-up validation, etc.).
  if (!result.ok) {
    const expectedUserErrors = new Set<string>([
      'SIGN_IN_EMAIL',
      'SIGN_UP_EMAIL',
    ]);
    if (!expectedUserErrors.has(req.type)) {
      Sentry.captureMessage(`[bg] ${req.type} failed: ${result.error}`, {
        level: 'error',
        tags: { messageType: req.type, context: 'dispatch' },
        extra: { error: result.error },
      });
    }
  }

  return result;
}

async function _dispatch(req: Request): Promise<Response> {
  switch (req.type) {
    case 'GET_STATE':           return getState();
    case 'SIGN_IN_GOOGLE':      return signInWithGoogle();
    case 'SIGN_IN_GITHUB':      return signInWithGitHub();
    case 'SIGN_IN_EMAIL':       return signInWithEmail((req as any).email, (req as any).password);
    case 'SIGN_UP_EMAIL':       return signUpWithEmail((req as any).email, (req as any).password);
    case 'GET_CATEGORIES':      return getCategories();
    case 'GET_USER_CATEGORIES': return getUserCategories();
    case 'SET_USER_CATEGORIES': return setUserCategories((req as any).categoryIds);
    case 'EXCHANGE_CODE':       return exchangeCode((req as any).code);
    case 'SAVE_SESSION':        return saveSession((req as any).accessToken, (req as any).refreshToken);
    case 'SIGN_OUT':            return signOut();
    case 'ROAM':                return roam();
    case 'ROAM_COLLECTION':     return roamCollection(req.collectionId);
    case 'ROAM_CATEGORY':       return roamCategory(req.categoryId);
    case 'RATE':                return rate(req.url_id, req.vote);
    case 'CHECK_URL':           return checkUrl(req.url);
    case 'SUBMIT_URL':          return submitUrl(req.url, req.categoryId);
    case 'SAVE_LATER':          return saveLater(req.url);
    case 'SET_PAYWALL_PREF':    return setPaywallPref(req.skip);
    case 'SET_LANGUAGE_PREF':   return setLanguagePref(req.languages);
    case 'GET_COLLECTIONS':     return getCollections();
    case 'CREATE_COLLECTION':   return createCollection(req.name);
    case 'ADD_URL_TO_COLLECTION': return addUrlToCollection(req.url, req.collectionId);
    case 'GET_QUEUE_STATE':     return getQueueState();
    case 'REFRESH_CATEGORIES':  return refreshCategories(req.categoryIds);
    case 'GET_PROFILE':         return getProfile();
    case 'SEND_FEEDBACK':       return sendFeedback((req as any).message, (req as any).email, (req as any).platform);
    default:                    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}

// ── Auth ────────────────────────────────────────────────────────────────────

/**
 * Fetch user's selected categories and initialize queue
 */
async function initializeQueueIfNeeded(): Promise<void> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return;

  // Check if queue already initialized (has stored state)
  const stored = await chrome.storage.local.get('url_queue');
  if (stored.url_queue) return; // Already initialized

  try {
    // Fetch user's selected categories
    const { data, error } = await getSupabase()
      .from('user_categories')
      .select('category_id')
      .eq('user_id', session.user.id);

    if (error) {
      console.error('[roam-bg] Failed to fetch user categories:', error.message);
      return;
    }

    const categoryIds = (data || []).map((row: any) => row.category_id);
    console.log('[roam-bg] Initializing queue with categories:', categoryIds);

    // Initialize queue with user's categories
    await initializeQueueManagement(categoryIds);
  } catch (err) {
    console.error('[roam-bg] Queue initialization error:', err);
  }
}

async function getState(): Promise<Response<StateData>> {
  const { data: { session }, error } = await getSupabase().auth.getSession();
  if (error) {
    console.error('[roam-bg] Failed to get session:', error.message);
    return { ok: false, error: error.message };
  }
  if (!session) {
    console.log('[roam-bg] No session found');
    return { ok: true, data: { signedIn: false } };
  }

  // Fire-and-forget — queue init makes multiple network calls and must NOT
  // block the GET_STATE response (would cause SW response timeout).
  initializeQueueIfNeeded().catch((err) =>
    console.error('[roam-bg] Queue init error:', err)
  );

  console.log('[roam-bg] Session found:', { email: session.user.email, userId: session.user.id });
  return {
    ok: true,
    data: { signedIn: true, email: session.user.email, userId: session.user.id },
  };
}

async function signInWithGoogle(): Promise<Response<StateData>> {
  const supabase = getSupabase();
  const redirectTo = chrome.runtime.getURL('callback.html');

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data.url) {
      Sentry.captureException(error || new Error('signInWithOAuth returned no URL'), {
        tags: { context: 'signInWithGoogle' },
      });
      return { ok: false, error: 'Could not open the sign-in page. Please try again.' };
    }
    await chrome.tabs.create({ url: data.url });
    return { ok: true, data: { signedIn: false } };
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'signInWithGoogle' } });
    return { ok: false, error: 'Could not open the sign-in page. Please try again.' };
  }
}

async function exchangeCode(code: string): Promise<Response<StateData>> {
  console.log('[roam-bg] Exchanging code for session');
  const supabase = getSupabase();
  const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
  if (sessionError) {
    console.error('[roam-bg] Session exchange failed:', sessionError.message);
    Sentry.captureException(sessionError, { tags: { context: 'exchangeCode' } });
    return { ok: false, error: sessionError.message };
  }
  console.log('[roam-bg] Code exchanged successfully, initializing queue');

  // Fire-and-forget — must not block the auth response.
  initializeQueueIfNeeded().catch((err) =>
    console.error('[roam-bg] Queue init error:', err)
  );

  const state = await getState();
  console.log('[roam-bg] Final state:', state);
  return state;
}

async function saveSession(accessToken: string, refreshToken: string): Promise<Response<StateData>> {
  console.log('[roam-bg] Saving session from OAuth callback');
  const supabase = getSupabase();
  try {
    const { error: setError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (setError) {
      console.error('[roam-bg] Failed to set session:', setError.message);
      return { ok: false, error: setError.message };
    }
    console.log('[roam-bg] Session set successfully, initializing queue');

    // Fire-and-forget — must not block the auth response.
    initializeQueueIfNeeded().catch((err) =>
      console.error('[roam-bg] Queue init error:', err)
    );

    const state = await getState();
    console.log('[roam-bg] Final state:', state);
    return state;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[roam-bg] Session save error:', message);
    return { ok: false, error: message };
  }
}

async function signOut(): Promise<Response<StateData>> {
  // Clean up queue before signing out
  await cleanupOnSignOut();

  const { error } = await getSupabase().auth.signOut();
  if (error) return { ok: false, error: error.message };
  // Explicitly clear all auth storage to prevent auto-restore
  await clearAuthStorage();
  return { ok: true, data: { signedIn: false } };
}

async function signInWithGitHub(): Promise<Response<StateData>> {
  const supabase = getSupabase();
  const redirectTo = chrome.runtime.getURL('callback.html');

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data.url) {
      Sentry.captureException(error || new Error('signInWithOAuth returned no URL'), {
        tags: { context: 'signInWithGitHub' },
      });
      return { ok: false, error: 'Could not open the sign-in page. Please try again.' };
    }
    await chrome.tabs.create({ url: data.url });
    return { ok: true, data: { signedIn: false } };
  } catch (err) {
    Sentry.captureException(err, { tags: { context: 'signInWithGitHub' } });
    return { ok: false, error: 'Could not open the sign-in page. Please try again.' };
  }
}

async function signInWithEmail(email: string, password: string): Promise<Response<StateData>> {
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };

  initializeQueueIfNeeded().catch((err) => console.error('[roam-bg] Queue init error:', err));
  return {
    ok: true,
    data: { signedIn: true, email: data.user?.email, userId: data.user?.id },
  };
}

async function signUpWithEmail(email: string, password: string): Promise<Response<{ needsVerification: boolean }>> {
  const { data, error } = await getSupabase().auth.signUp({ email, password });
  if (error) return { ok: false, error: error.message };

  if (data.session) {
    // Session created immediately (e.g. email confirmation disabled)
    initializeQueueIfNeeded().catch((err) => console.error('[roam-bg] Queue init error:', err));
    return { ok: true, data: { needsVerification: false } };
  }
  // Verification email sent — user must confirm before signing in
  return { ok: true, data: { needsVerification: true } };
}

// In-memory cache for categories list (stable, 20-min TTL is just extra safety)
const CATEGORIES_FALLBACK: CategoryItem[] = [
  { id: 'c1000000-0000-0000-0000-000000000001', name: 'Science & Nature', icon: '🔬' },
  { id: 'c1000000-0000-0000-0000-000000000002', name: 'Technology',       icon: '💻' },
  { id: 'c1000000-0000-0000-0000-000000000003', name: 'Arts & Culture',   icon: '🎨' },
  { id: 'c1000000-0000-0000-0000-000000000004', name: 'History & Ideas',  icon: '📜' },
  { id: 'c1000000-0000-0000-0000-000000000005', name: 'Games & Hobbies',  icon: '🎮' },
  { id: 'c1000000-0000-0000-0000-000000000006', name: 'Weird & Wonderful',icon: '🌀' },
  { id: 'c1000000-0000-0000-0000-000000000007', name: 'People & Places',  icon: '🌍' },
  { id: 'c1000000-0000-0000-0000-000000000008', name: 'Mind & Body',      icon: '🧠' },
];
let categoriesCache: { items: CategoryItem[]; fetchedAt: number } | null = null;
const CATEGORIES_TTL = 20 * 60 * 1000;

async function getCategories(): Promise<Response<CategoryItem[]>> {
  const now = Date.now();
  if (categoriesCache && now - categoriesCache.fetchedAt < CATEGORIES_TTL) {
    return { ok: true, data: categoriesCache.items };
  }
  try {
    const { data, error } = await getSupabase()
      .from('categories')
      .select('id, name, icon, sort_order')
      .order('sort_order');
    if (!error && data && data.length > 0) {
      categoriesCache = { items: data as CategoryItem[], fetchedAt: now };
      return { ok: true, data: data as CategoryItem[] };
    }
  } catch { /* fall through to fallback */ }
  return { ok: true, data: CATEGORIES_FALLBACK };
}

async function getUserCategories(): Promise<Response<{ categoryIds: string[] }>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'You\'re not signed in. Please sign in and try again.' };

  const { data, error } = await getSupabase()
    .from('user_categories')
    .select('category_id')
    .eq('user_id', session.user.id);

  if (error) return { ok: false, error: 'Couldn\'t load your categories. Please try again.' };
  return { ok: true, data: { categoryIds: (data || []).map((r: any) => r.category_id) } };
}

async function setUserCategories(categoryIds: string[]): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'You\'re not signed in. Please sign in and try again.' };

  // Replace all existing categories for this user
  const { error: delError } = await getSupabase()
    .from('user_categories')
    .delete()
    .eq('user_id', session.user.id);
  if (delError) return { ok: false, error: 'Couldn\'t save your preferences. Please try again.' };

  if (categoryIds.length > 0) {
    const rows = categoryIds.map((id) => ({ user_id: session.user.id, category_id: id }));
    const { error: insError } = await getSupabase()
      .from('user_categories')
      .insert(rows);
    if (insError) return { ok: false, error: 'Couldn\'t save your preferences. Please try again.' };
  }

  // Refresh queue with new categories
  await updateCategoryFilter(categoryIds);
  return { ok: true, data: null };
}

// ── Feature stubs (implemented in tasks 5.8–5.12) ───────────────────────────

async function roam(collectionId?: string): Promise<Response<RoamData>> {
  // Try hot queue first (instant), then warming queue (DB-verified, skip re-fetch)
  const queued = await popAnyUrl();

  if (queued) {
    const newDomain = getDomain(queued.url);
    if (newDomain) {
      await chrome.storage.local.set({ lastRoamDomain: newDomain });
    }
    return { ok: true, data: queued as RoamData };
  }

  // Queue is empty, fall back to direct API call
  // Get the last roamed domain to exclude it
  const storage = await chrome.storage.local.get('lastRoamDomain');
  const excludeDomain = storage.lastRoamDomain ?? null;

  const { data, error } = await getSupabase().functions.invoke('roam', {
    body: {
      ...(collectionId ? { collection_id: collectionId } : {}),
      ...(excludeDomain ? { exclude_domain: excludeDomain } : {}),
    },
  });

  if (error) {
    // FunctionsHttpError carries the raw Response on .context
    const status: number | undefined = (error as any).context?.status;
    if (status === 404) {
      // Pool exhausted for this user's settings — signal "no results"
      return { ok: true, data: { url: '' } as RoamData };
    }
    // Try to surface the actual error body before falling back to generic message
    try {
      const body = await (error as any).context?.json?.();
      if (body?.error) return { ok: false, error: body.error };
    } catch { /* ignore parse errors */ }
    return { ok: false, error: error.message };
  }
  if (data?.error) return { ok: false, error: data.error };

  // Save the domain of the URL we just got for next time
  const newDomain = getDomain(data.url);
  if (newDomain) {
    await chrome.storage.local.set({ lastRoamDomain: newDomain });
  }

  return { ok: true, data: data as RoamData };
}

async function rate(url_id: string, vote: 1 | -1): Promise<Response<null>> {
  const { data, error } = await getSupabase().functions.invoke('rate', {
    body: { url_id, value: vote },
  });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true, data: null };
}

async function checkUrl(url: string): Promise<Response<CheckUrlData>> {
  const normalized = normalizeUrl(url);
  if (!normalized) return { ok: true, data: { known: false } };

  const { data, error } = await getSupabase()
    .from('urls')
    .select('id,category_id')
    .eq('url', normalized)
    .eq('approved', true)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true, data: { known: false } };
  return { ok: true, data: { known: true, url_id: data.id as string, category_id: data.category_id ?? undefined } };
}

async function submitUrl(url: string, categoryId: string): Promise<Response<null>> {
  const { data, error } = await getSupabase().functions.invoke('submit-url', {
    body: { url, category_id: categoryId },
  });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true, data: null };
}

async function getQueueState(): Promise<Response<QueueState>> {
  try {
    const stats = await getQueueStats();
    return { ok: true, data: stats };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: message };
  }
}

async function refreshCategories(categoryIds: string[]): Promise<Response<null>> {
  try {
    await updateCategoryFilter(categoryIds);
    return { ok: true, data: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: message };
  }
}

async function roamCollection(collectionId: string): Promise<Response<RoamData>> {
  const { data, error } = await getSupabase().functions.invoke('roam', {
    body: { collection_id: collectionId },
  });

  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };

  // Save the domain of the URL we just got for next time
  const newDomain = getDomain(data.url);
  if (newDomain) {
    await chrome.storage.local.set({ lastRoamDomain: newDomain });
  }

  return { ok: true, data: data as RoamData };
}

async function roamCategory(categoryId: string): Promise<Response<RoamData>> {
  // Determine which categories match this categoryId and roam within them
  const CATEGORY_ID_MAP: Record<string, string[]> = {
    // Map category IDs to array of subcategories (or the ID itself)
    // For now, just roam normally with no filter
    // In the future, filter the roam() RPC call by category
  };

  const { data, error } = await getSupabase().functions.invoke('roam', {
    body: { category_id: categoryId },
  });

  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };

  const newDomain = getDomain(data.url);
  if (newDomain) {
    await chrome.storage.local.set({ lastRoamDomain: newDomain });
  }

  return { ok: true, data: data as RoamData };
}

async function saveLater(url: string): Promise<Response<null>> {
  // Store URL in a local "saved_urls" array for later retrieval
  const storage = await chrome.storage.local.get('saved_urls');
  const saved = (storage.saved_urls || []) as string[];
  
  if (!saved.includes(url)) {
    saved.push(url);
    await chrome.storage.local.set({ saved_urls: saved });
  }

  return { ok: true, data: null };
}

async function getCollections(): Promise<Response<Collection[]>> {
  const { data, error } = await getSupabase()
    .from('collections')
    .select('id,name,slug,is_public,item_count:collection_items(count)')
    .eq('owner_id', (await getSupabase().auth.getSession()).data.session?.user.id)
    .order('name');

  if (error) return { ok: false, error: error.message };

  // Transform response to include item_count
  const collections = (data || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    is_public: c.is_public,
    item_count: Array.isArray(c.item_count) && c.item_count[0]?.count
      ? c.item_count[0].count
      : 0,
  }));

  return { ok: true, data: collections };
}

async function createCollection(name: string): Promise<Response<Collection>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'You\'re not signed in. Please sign in and try again.' };

  // Create slug from name
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const { data, error } = await getSupabase()
    .from('collections')
    .insert({
      name,
      slug,
      owner_id: session.user.id,
      is_public: false,
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };

  return { ok: true, data: {
    id: data.id,
    name: data.name,
    slug: data.slug,
    is_public: data.is_public,
    item_count: 0,
  }};
}

async function addUrlToCollection(url: string, collectionId: string): Promise<Response<null>> {
  // First normalize the URL
  const normalized = normalizeUrl(url);
  if (!normalized) return { ok: false, error: 'That doesn\'t look like a valid URL.' };

  // Check if URL exists in database
  const { data: urlData, error: urlError } = await getSupabase()
    .from('urls')
    .select('id')
    .eq('url', normalized)
    .eq('approved', true)
    .maybeSingle();

  if (urlError) return { ok: false, error: 'Couldn\'t add to collection. Please try again.' };

  let urlId = urlData?.id;

  if (!urlId) {
    // URL doesn't exist yet, create it as unapproved
    const { data: newUrl, error: createError } = await getSupabase()
      .from('urls')
      .insert({
        url: normalized,
        original_url: normalized,
        approved: false,
        source: 'user_submission',
      })
      .select('id')
      .single();

    if (createError) return { ok: false, error: 'Couldn\'t add to collection. Please try again.' };
    urlId = newUrl.id;
  }

  // Add to collection
  const { error: addError } = await getSupabase()
    .from('collection_items')
    .insert({
      collection_id: collectionId,
      url_id: urlId,
    });

  if (addError) {
    // Might fail if already in collection (unique constraint)
    if (addError.message.includes('unique') || addError.message.includes('duplicate')) {
      return { ok: true, data: null }; // Already there, that's fine
    }
    return { ok: false, error: 'Couldn\'t add to collection. Please try again.' };
  }

  return { ok: true, data: null };
}

async function setPaywallPref(skip: boolean): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'You\'re not signed in. Please sign in and try again.' };

  await chrome.storage.local.set({ skip_paywalled: skip });

  const { error } = await getSupabase()
    .from('user_settings')
    .upsert({ user_id: session.user.id, skip_paywalled: skip }, { onConflict: 'user_id' });
  if (error) console.warn('[roam] setPaywallPref DB error:', error.message);

  // Flush queue so cached URLs are not served with the old paywall setting
  await clearQueue();

  return { ok: true, data: null };
}

async function setLanguagePref(languages: string[]): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'You\'re not signed in. Please sign in and try again.' };

  // Must include at least English to avoid an empty pool
  const langs = languages.length > 0 ? languages : ['en'];
  await chrome.storage.local.set({ preferred_languages: langs });

  const { error } = await getSupabase()
    .from('user_settings')
    .upsert({ user_id: session.user.id, preferred_languages: langs }, { onConflict: 'user_id' });
  if (error) console.warn('[roam] setLanguagePref DB error:', error.message);

  // Flush queue so cached URLs are not served with the old language setting
  await clearQueue();

  return { ok: true, data: null };
}

async function getProfile(): Promise<Response<ProfileData>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await getSupabase()
    .from('profiles')
    .select('username')
    .eq('id', session.user.id)
    .single();

  if (error || !data) return { ok: false, error: 'Profile not found.' };
  return { ok: true, data: { username: data.username } };
}

async function sendFeedback(message: string, email: string | undefined, platform: string): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  const authHeader = session ? `Bearer ${session.access_token}` : undefined;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers['Authorization'] = authHeader;

  const res = await fetch(`${__SUPABASE_URL__}/functions/v1/feedback`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message, email: email || undefined, platform }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.error ?? 'Couldn\'t send your feedback. Please try again.' };
  }
  return { ok: true, data: null };
}

console.log('[roam] background service worker started');
