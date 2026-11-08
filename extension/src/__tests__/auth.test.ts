import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';

// The service worker's auth module talks to Supabase and Sentry; both are faked so the
// tests exercise the tab/flow decisions only, with no network and no build-time defines.
const { auth, fakes } = vi.hoisted(() => ({
  auth: {
    signInWithOAuth: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    exchangeCodeForSession: vi.fn(),
    setSession: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(),
    refreshSession: vi.fn(),
  },
  fakes: { clearAuthStorage: vi.fn() },
}));

vi.mock('../lib/supabase', () => ({
  getSupabase: () => ({ auth }),
  clearAuthStorage: fakes.clearAuthStorage,
}));
vi.mock('../lib/sentry', () => ({
  Sentry: { captureException: vi.fn(), captureMessage: vi.fn() },
}));

import {
  getState,
  signInWithOAuth,
  signInWithEmail,
  exchangeCode,
  saveSession,
  signOut,
} from '../background/auth';
import { AUTH_FLOW_KEY, AUTH_FLOW_TTL } from '../lib/auth-flow';
import { BUILD_VERSION } from '../lib/version';

const CALLBACK_URL = 'chrome-extension://test-extension-id/callback.html';
const AUTHORIZE_URL = 'https://test.supabase.co/auth/v1/authorize?provider=google';
const OPENED_ELSEWHERE = { ok: false, error: 'Could not open the sign-in page. Please try again.' };

/** Replaces a chrome API method with a fresh mock for one test. */
function stub(target: object, key: string): Mock {
  const spy = vi.fn(async () => ({}));
  (target as Record<string, unknown>)[key] = spy;
  return spy;
}

let createTab: Mock;
let focusTab: Mock;
let focusWindow: Mock;

function session(user: { email?: string; id?: string; provider?: string }, expiresIn = 3600) {
  return {
    data: {
      session: {
        expires_at: Math.floor(Date.now() / 1000) + expiresIn,
        user: { email: user.email, id: user.id, app_metadata: { provider: user.provider } },
      },
    },
    error: null,
  };
}

async function seedMarker(overrides: Partial<{ tabId: number; windowId: number; startedAt: number }> = {}) {
  await chrome.storage.session.set({
    [AUTH_FLOW_KEY]: { tabId: 11, windowId: 22, startedAt: Date.now(), ...overrides },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  createTab = stub(chrome.tabs, 'create');
  focusTab = stub(chrome.tabs, 'update');
  focusWindow = stub(chrome.windows, 'update');
  createTab.mockResolvedValue({ id: 42, windowId: 3 });
});

describe('signInWithOAuth — one tab, never two', () => {
  beforeEach(() => {
    auth.signInWithOAuth.mockResolvedValue({ data: { url: AUTHORIZE_URL }, error: null });
  });

  it('opens the authorize URL against the extension callback', async () => {
    await signInWithOAuth('google');

    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: CALLBACK_URL, skipBrowserRedirect: true },
    });
    expect(createTab).toHaveBeenCalledWith({ url: AUTHORIZE_URL, active: true });
  });

  it('opens a single tab when two requests race', async () => {
    const [first, second] = await Promise.all([signInWithOAuth('google'), signInWithOAuth('google')]);

    expect(createTab).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ ok: true, data: { signedIn: false } });
    expect(second).toEqual(first);
  });

  it('records the opened tab so a reopen can find it', async () => {
    await signInWithOAuth('google');

    const stored = await chrome.storage.session.get(AUTH_FLOW_KEY);
    expect(stored[AUTH_FLOW_KEY]).toMatchObject({ tabId: 42, windowId: 3 });
  });

  it('focuses the tab that is already open', async () => {
    await seedMarker({ tabId: 11, windowId: 22 });

    const res = await signInWithOAuth('google');

    expect(focusTab).toHaveBeenCalledWith(11, { active: true });
    expect(focusWindow).toHaveBeenCalledWith(22, { focused: true });
    expect(createTab).not.toHaveBeenCalled();
    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
    expect(res).toEqual({ ok: true, data: { signedIn: false } });
  });

  it('opens a new tab when the recorded one has been closed', async () => {
    await seedMarker({ tabId: 11, windowId: 22 });
    focusTab.mockRejectedValue(new Error('No tab with id: 11'));

    await signInWithOAuth('google');

    expect(createTab).toHaveBeenCalledTimes(1);
    const stored = await chrome.storage.session.get(AUTH_FLOW_KEY);
    expect(stored[AUTH_FLOW_KEY]).toMatchObject({ tabId: 42 });
  });

  it('ignores a marker past its TTL', async () => {
    await seedMarker({ startedAt: Date.now() - AUTH_FLOW_TTL - 1000 });

    await signInWithOAuth('google');

    expect(focusTab).not.toHaveBeenCalled();
    expect(createTab).toHaveBeenCalledTimes(1);
  });

  it('surfaces a provider error without opening a tab', async () => {
    auth.signInWithOAuth.mockResolvedValue({ data: {}, error: { message: 'Provider not enabled' } });

    expect(await signInWithOAuth('google')).toEqual(OPENED_ELSEWHERE);
    expect(createTab).not.toHaveBeenCalled();
  });

  it('surfaces a missing authorize URL without opening a tab', async () => {
    auth.signInWithOAuth.mockResolvedValue({ data: {}, error: null });

    expect(await signInWithOAuth('google')).toEqual(OPENED_ELSEWHERE);
    expect(createTab).not.toHaveBeenCalled();
  });
});

describe('getState', () => {
  it('reports a signed-out session', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    expect(await getState()).toEqual({ ok: true, data: { signedIn: false, version: BUILD_VERSION } });
  });

  it('reports the build version so the popup can detect a stale worker', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    const res = await getState();

    expect(res.ok && res.data.version).toBe(BUILD_VERSION);
  });

  it('reports the signed-in user and provider', async () => {
    auth.getSession.mockResolvedValue(session({ email: 'ada@example.com', id: 'u1', provider: 'google' }));

    expect(await getState()).toEqual({
      ok: true,
      data: { signedIn: true, email: 'ada@example.com', userId: 'u1', provider: 'google', version: BUILD_VERSION },
    });
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('refreshes a token that is about to expire', async () => {
    auth.getSession.mockResolvedValue(session({ email: 'stale@example.com', id: 'u1' }, 30));
    auth.refreshSession.mockResolvedValue(session({ email: 'fresh@example.com', id: 'u1', provider: 'google' }));

    const res = await getState();

    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(res).toEqual({
      ok: true,
      data: { signedIn: true, email: 'fresh@example.com', userId: 'u1', provider: 'google', version: BUILD_VERSION },
    });
  });

  it('signs the user out when the refresh fails', async () => {
    auth.getSession.mockResolvedValue(session({ email: 'ada@example.com', id: 'u1' }, 30));
    auth.refreshSession.mockResolvedValue({ data: {}, error: { message: 'Invalid Refresh Token' } });

    expect(await getState()).toEqual({ ok: true, data: { signedIn: false, version: BUILD_VERSION } });
    expect(fakes.clearAuthStorage).toHaveBeenCalledTimes(1);
  });
});

describe('email auth', () => {
  it('passes a rejected password straight through', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } });

    expect(await signInWithEmail('ada@example.com', 'nope')).toEqual({
      ok: false,
      error: 'Invalid login credentials',
    });
  });

  it('reports the signed-in user on success', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: { email: 'ada@example.com', id: 'u1', app_metadata: { provider: 'email' } } },
      error: null,
    });

    expect(await signInWithEmail('ada@example.com', 'correct')).toEqual({
      ok: true,
      data: { signedIn: true, email: 'ada@example.com', userId: 'u1', provider: 'email' },
    });
  });
});

describe('session handoff from callback.ts', () => {
  it('exchanges a PKCE code for a session', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    auth.getSession.mockResolvedValue(session({ email: 'ada@example.com', id: 'u1' }));

    const res = await exchangeCode('pkce-code');

    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('pkce-code');
    expect(res.ok).toBe(true);
  });

  it('reports a failed code exchange', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: { message: 'Invalid flow state' } });

    expect(await exchangeCode('stale-code')).toEqual({ ok: false, error: 'Invalid flow state' });
  });

  it('reports a failed setSession', async () => {
    auth.setSession.mockRejectedValue(new Error('Network request failed'));

    expect(await saveSession('access', 'refresh')).toEqual({ ok: false, error: 'Network request failed' });
  });

  it('wipes the stored session on sign-out', async () => {
    auth.signOut.mockResolvedValue({ error: null });

    expect(await signOut()).toEqual({ ok: true, data: { signedIn: false } });
    expect(fakes.clearAuthStorage).toHaveBeenCalledTimes(1);
  });
});
