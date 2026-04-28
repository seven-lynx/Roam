// background.ts — Roam extension background service worker (task 5.6 / 5.7)
//
// Lifecycle: Chrome may terminate and restart this SW at any time.
// The Supabase client is created fresh on each activation; the auth session
// is rehydrated automatically from chrome.storage.local by the custom
// storage adapter in src/lib/supabase.ts.

import type { Request, Response, StateData, RoamData, CheckUrlData } from '../lib/messages';
import { getSupabase, clearAuthStorage } from '../lib/supabase';

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

// ── Message router ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener(
  (message: Request, _sender, sendResponse: (r: Response) => void) => {
    dispatch(message)
      .then(sendResponse)
      .catch((err: Error) => sendResponse({ ok: false, error: err.message }));
    return true; // keep the message channel open for the async response
  }
);

async function dispatch(req: Request): Promise<Response> {
  switch (req.type) {
    case 'GET_STATE':        return getState();
    case 'SIGN_IN_GOOGLE':   return signInWithGoogle();
    case 'EXCHANGE_CODE':    return exchangeCode((req as any).code);
    case 'SAVE_SESSION':     return saveSession((req as any).accessToken, (req as any).refreshToken);
    case 'SIGN_OUT':         return signOut();
    case 'ROAM':             return roam();
    case 'RATE':             return rate(req.url_id, req.vote);
    case 'CHECK_URL':        return checkUrl(req.url);
    case 'SUBMIT_URL':       return submitUrl(req.url, req.categoryId);
    case 'SAVE_LATER':       return saveLater(req.url);
    case 'SET_PAYWALL_PREF': return setPaywallPref(req.skip);
    default:                 return { ok: false, error: 'Unknown message type' };
  }
}

// ── Auth ────────────────────────────────────────────────────────────────────

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
  console.log('[roam-bg] Session found:', { email: session.user.email, userId: session.user.id });
  return {
    ok: true,
    data: { signedIn: true, email: session.user.email, userId: session.user.id },
  };
}

async function signInWithGoogle(): Promise<Response<StateData>> {
  const supabase = getSupabase();
  const redirectTo = `chrome-extension://${chrome.runtime.id}/callback.html`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) {
    return { ok: false, error: error?.message ?? 'Could not start OAuth flow' };
  }

  // Open the OAuth URL in a new tab. The callback page will handle the redirect.
  try {
    await chrome.tabs.create({ url: data.url });
    return { ok: true, data: { signedIn: false } }; // Popup will auto-update on success
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function exchangeCode(code: string): Promise<Response<StateData>> {
  console.log('[roam-bg] Exchanging code for session');
  const supabase = getSupabase();
  const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
  if (sessionError) {
    console.error('[roam-bg] Session exchange failed:', sessionError.message);
    return { ok: false, error: sessionError.message };
  }
  console.log('[roam-bg] Code exchanged successfully, retrieving state');
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
    console.log('[roam-bg] Session set successfully, retrieving state');
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
  const { error } = await getSupabase().auth.signOut();
  if (error) return { ok: false, error: error.message };
  // Explicitly clear all auth storage to prevent auto-restore
  await clearAuthStorage();
  return { ok: true, data: { signedIn: false } };
}

// ── Feature stubs (implemented in tasks 5.8–5.12) ───────────────────────────

async function roam(collectionId?: string): Promise<Response<RoamData>> {
  // Get the last roamed domain to exclude it
  const storage = await chrome.storage.local.get('lastRoamDomain');
  const excludeDomain = storage.lastRoamDomain ?? null;

  const { data, error } = await getSupabase().functions.invoke('roam', {
    body: {
      ...(collectionId ? { collection_id: collectionId } : {}),
      ...(excludeDomain ? { exclude_domain: excludeDomain } : {}),
    },
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
    .select('id')
    .eq('url', normalized)
    .eq('approved', true)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true, data: { known: false } };
  return { ok: true, data: { known: true, url_id: data.id as string } };
}

async function submitUrl(url: string, categoryId: string): Promise<Response<null>> {
  // categoryId is a pillar (category), but submit-url expects subcategory_id (optional)
  // For now, pass as subcategory_id (schema supports null, but UI only exposes pillar)
  const { data, error } = await getSupabase().functions.invoke('submit-url', {
    body: { url, subcategory_id: categoryId },
  });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true, data: null };
}

async function saveLater(url: string): Promise<Response<null>> {
  // TODO (task 5.12): supabase.from('saved_urls').insert()
  void url;
  return { ok: false, error: 'Not implemented yet (task 5.12)' };
}

async function setPaywallPref(skip: boolean): Promise<Response<null>> {
  // TODO (task 5.12b): supabase.from('user_settings').upsert({ skip_paywalled: skip })
  void skip;
  return { ok: false, error: 'Not implemented yet (task 5.12b)' };
}

console.log('[roam] background service worker started');
