// background.ts — Roam extension background service worker (task 5.6 / 5.7)
//
// Lifecycle: Chrome may terminate and restart this SW at any time.
// The Supabase client is created fresh on each activation; the auth session
// is rehydrated automatically from chrome.storage.local by the custom
// storage adapter in src/lib/supabase.ts.

import type { Request, Response, StateData } from '../lib/messages';
import { getSupabase } from '../lib/supabase';

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
    case 'ROAM':             return roam();
    case 'RATE':             return rate(req.url, req.vote);
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
  const code = new URL(responseUrl).searchParams.get('code');
  if (!code) return { ok: false, error: 'No auth code in redirect URL' };

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

async function roam(): Promise<Response<{ url: string }>> {
  // TODO (task 5.8): invoke Edge Function `roam` via supabase.functions.invoke()
  return { ok: false, error: 'Not implemented yet (task 5.8)' };
}

async function rate(url: string, vote: 1 | -1): Promise<Response<null>> {
  // TODO (task 5.9 / 5.10): invoke Edge Function `rate`
  void url; void vote;
  return { ok: false, error: 'Not implemented yet (task 5.9/5.10)' };
}

async function checkUrl(url: string): Promise<Response<{ known: boolean }>> {
  // TODO (task 5.11): query `urls` table — supabase.from('urls').select('id').eq('url', url)
  void url;
  return { ok: false, error: 'Not implemented yet (task 5.11)' };
}

async function submitUrl(url: string, categoryId: string): Promise<Response<null>> {
  // TODO (task 5.11): invoke Edge Function `submit-url`
  void url; void categoryId;
  return { ok: false, error: 'Not implemented yet (task 5.11)' };
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
