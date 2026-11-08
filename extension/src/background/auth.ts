// auth.ts — session state, email/password auth, and the Google sign-in tab flow.
//
// Split out of background.ts (rule E.3) so the message router stays a router. The
// sequence this implements is drawn in DESIGN.md 6.1.

import { Sentry } from '../lib/sentry';
import { getSupabase, clearAuthStorage } from '../lib/supabase';
import { AUTH_FLOW_KEY, liveAuthFlow } from '../lib/auth-flow';
import type { AuthFlowState } from '../lib/auth-flow';
import type { Response, StateData } from '../lib/messages';

// ── Session state ─────────────────────────────────────────────────────────────

/**
 * Current session for the popup. The token is refreshed here when it is within a
 * minute of expiry, because a service worker can be asleep for hours and the popup
 * should never render a signed-out state for a session that is merely stale.
 */
export async function getState(): Promise<Response<StateData>> {
  const { data: { session }, error } = await getSupabase().auth.getSession();
  if (error) return { ok: false, error: error.message };
  if (!session) return { ok: true, data: { signedIn: false } };

  const expiresAt = session.expires_at ?? 0;
  if (expiresAt <= Math.floor(Date.now() / 1000) + 60) {
    const { data: refreshed, error: rErr } = await getSupabase().auth.refreshSession();
    if (rErr) {
      await clearAuthStorage();
      return { ok: true, data: { signedIn: false } };
    }
    if (!refreshed.session) return { ok: true, data: { signedIn: false } };
    return { ok: true, data: { signedIn: true, email: refreshed.session.user.email, userId: refreshed.session.user.id, provider: refreshed.session.user.app_metadata?.provider ?? 'email' } };
  }

  return { ok: true, data: { signedIn: true, email: session.user.email, userId: session.user.id, provider: session.user.app_metadata?.provider ?? 'email' } };
}

// ── OAuth (Google) ────────────────────────────────────────────────────────────
//
// Tab-based flow, no identity window. The Supabase authorize URL opens in ONE new
// tab and Supabase redirects back to this extension's own callback.html, which
// hands the PKCE code to the SW. The web app's /auth/callback must NOT be used as
// redirectTo - that exchange runs against the website's cookie session, so the
// extension never receives a session and the user is just left looking at the site.

/** The sign-in tab already open for this browser profile, if any. */
async function getPendingAuthFlow(): Promise<AuthFlowState | null> {
  const stored = await chrome.storage.session.get(AUTH_FLOW_KEY);
  return liveAuthFlow(stored[AUTH_FLOW_KEY]);
}

// Deduplicates concurrent requests inside one SW activation: sendToBackground()
// retries once when the SW is slow to wake, and a double click sends two messages.
// Either would otherwise open two sign-in tabs.
let authLaunchInFlight: Promise<Response<StateData>> | null = null;

export function signInWithOAuth(provider: 'google'): Promise<Response<StateData>> {
  const existing = authLaunchInFlight;
  if (existing) return existing;
  const launch = launchOAuthTab(provider).finally(() => { authLaunchInFlight = null; });
  authLaunchInFlight = launch;
  return launch;
}

async function launchOAuthTab(provider: 'google'): Promise<Response<StateData>> {
  try {
    // A sign-in tab is still open (second click, popup reopened mid-flow, retry):
    // focus it instead of opening another one.
    const pending = await getPendingAuthFlow();
    if (pending) {
      try {
        await chrome.tabs.update(pending.tabId, { active: true });
        await chrome.windows.update(pending.windowId, { focused: true }).catch(() => {});
        return { ok: true, data: { signedIn: false } };
      } catch {
        await chrome.storage.session.remove(AUTH_FLOW_KEY); // that tab is gone
      }
    }

    // Extension-origin redirect so the code lands back inside the extension, where
    // callback.ts can send EXCHANGE_CODE to this SW. Requires
    // chrome-extension://<ID>/callback.html in Supabase: Authentication >
    // URL Configuration > Redirect URLs (see extension/TESTING.md section 4).
    const redirectTo = chrome.runtime.getURL('callback.html');
    const { data, error } = await getSupabase().auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data.url) {
      Sentry.captureException(error || new Error('signInWithOAuth returned no URL'), { tags: { context: `signInWith_${provider}` } });
      return { ok: false, error: 'Could not open the sign-in page. Please try again.' };
    }

    const tab = await chrome.tabs.create({ url: data.url, active: true });
    if (typeof tab.id === 'number') {
      const flow: AuthFlowState = { tabId: tab.id, windowId: tab.windowId, startedAt: Date.now() };
      await chrome.storage.session.set({ [AUTH_FLOW_KEY]: flow });
    }

    // callback.html takes over from here; the popup closes and reads GET_STATE on
    // its next open.
    return { ok: true, data: { signedIn: false } };
  } catch (err) {
    Sentry.captureException(err, { tags: { context: `signInWith_${provider}` } });
    return { ok: false, error: 'Could not open the sign-in page. Please try again.' };
  }
}

// ── Email / password ──────────────────────────────────────────────────────────

export async function signInWithEmail(email: string, password: string): Promise<Response<StateData>> {
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { signedIn: true, email: data.user?.email, userId: data.user?.id, provider: data.user?.app_metadata?.provider ?? 'email' } };
}

export async function signUpWithEmail(email: string, password: string): Promise<Response<{ needsVerification: boolean }>> {
  const { data, error } = await getSupabase().auth.signUp({
    email,
    password,
    options: { emailRedirectTo: 'https://roamtheweb.app/auth/callback' },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { needsVerification: !data.session } };
}

// ── Session handoff from callback.ts ──────────────────────────────────────────

export async function exchangeCode(code: string): Promise<Response<StateData>> {
  const { error } = await getSupabase().auth.exchangeCodeForSession(code);
  if (error) { Sentry.captureException(error, { tags: { context: 'exchangeCode' } }); return { ok: false, error: error.message }; }
  return getState();
}

export async function saveSession(accessToken: string, refreshToken: string): Promise<Response<StateData>> {
  try {
    const { error } = await getSupabase().auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) return { ok: false, error: error.message };
    return getState();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function signOut(): Promise<Response<StateData>> {
  const { error } = await getSupabase().auth.signOut();
  if (error) return { ok: false, error: error.message };
  await clearAuthStorage();
  return { ok: true, data: { signedIn: false } };
}
