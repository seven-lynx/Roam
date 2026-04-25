// background.ts — Roam extension background service worker (task 5.6 / 5.7)
//
// Lifecycle: Chrome may terminate and restart this SW at any time.
// The Supabase client is created fresh on each activation; the auth session
// is rehydrated automatically from chrome.storage.local by the custom
// storage adapter in src/lib/supabase.ts.

import type { Request, Response, StateData, RoamData, CheckUrlData } from '../lib/messages';
import { getSupabase } from '../lib/supabase';

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
    case 'SIGN_IN_GOOGLE':  return signInWithGoogle();
    case 'SIGN_OUT':         return signOut();
    case 'ROAM':             return roam(req.collectionId);
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
  if (error) return { ok: false, error: error.message };
  if (!session) return { ok: true, data: { signedIn: false } };
  return {
    ok: true,
    data: { signedIn: true, email: session.user.email, userId: session.user.id },
  };
}

async function signInWithGoogle(): Promise<Response<StateData>> {
  const supabase = getSupabase();

  // SETUP NOTE: Add the redirect URL below to your Supabase project at:
  //   Authentication → URL Configuration → Redirect URLs
  // The URL looks like: https://<EXTENSION_ID>.chromiumapp.org/
  // Find your extension ID at chrome://extensions after loading unpacked.
  const redirectTo = chrome.identity.getRedirectURL();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) {
    return { ok: false, error: error?.message ?? 'Could not start OAuth flow' };
  }

  // Hand off to Chrome's identity API — opens the Google sign-in window.
  let responseUrl: string;
  try {
    responseUrl = await new Promise<string>((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: data.url, interactive: true },
        (url) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!url) {
            reject(new Error('No redirect URL received from OAuth flow'));
          } else {
            resolve(url);
          }
        }
      );
    });
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  // Exchange the PKCE code for a Supabase session.
  const url = new URL(responseUrl);
  const code = url.searchParams.get('code') || url.hash.split('code=')[1]?.split('&')[0];
  if (!code) {
    console.error('[roam] OAuth redirect URL:', responseUrl);
    return { ok: false, error: `No auth code in redirect URL. Make sure the extension ID redirect is added to Supabase.` };
  }

  const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
  if (sessionError) return { ok: false, error: sessionError.message };

  return getState();
}

async function signOut(): Promise<Response<StateData>> {
  const { error } = await getSupabase().auth.signOut();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { signedIn: false } };
}

// ── Feature stubs (implemented in tasks 5.8–5.12) ───────────────────────────

async function roam(collectionId?: string): Promise<Response<RoamData>> {
  const { data, error } = await getSupabase().functions.invoke('roam', {
    body: collectionId ? { collection_id: collectionId } : {},
  });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
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
