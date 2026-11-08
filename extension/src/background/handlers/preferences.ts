// preferences.ts — user discovery preferences and page translation.

import { getSupabase } from '../../lib/supabase';
import type { Response, UserSettingsData } from '../../lib/messages';
import { DEFAULT_LANGUAGE } from '../../lib/constants';

/** Server-side discovery preferences — used to hydrate the popup's controls. */
export async function getUserSettings(): Promise<Response<UserSettingsData>> {
  const defaults: UserSettingsData = {
    skip_paywalled: false,
    discovery_mode: 'discovery',
    preferred_languages: [DEFAULT_LANGUAGE],
  };
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: true, data: defaults };
  const { data, error } = await getSupabase()
    .from('user_settings')
    .select('skip_paywalled, discovery_mode, preferred_languages')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (error) return { ok: true, data: defaults };
  const row = data as { skip_paywalled?: boolean; discovery_mode?: string; preferred_languages?: string[] } | null;
  if (!row) return { ok: true, data: defaults };
  return {
    ok: true,
    data: {
      skip_paywalled: row.skip_paywalled ?? false,
      discovery_mode: row.discovery_mode === 'deep_dive' ? 'deep_dive' : 'discovery',
      preferred_languages:
        row.preferred_languages && row.preferred_languages.length > 0
          ? row.preferred_languages
          : [DEFAULT_LANGUAGE],
    },
  };
}

export async function setPaywallPref(skip: boolean): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: "You're not signed in. Please sign in and try again." };
  await chrome.storage.local.set({ skip_paywalled: skip });
  const { error } = await getSupabase().from('user_settings').upsert({ user_id: session.user.id, skip_paywalled: skip }, { onConflict: 'user_id' });
  if (error) console.warn('[roam] setPaywallPref DB error:', error.message);
  return { ok: true, data: null };
}

export async function setLanguagePref(languages: string[]): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: "You're not signed in. Please sign in and try again." };
  // English is always included — matches the web language filter.
  const langs = Array.from(new Set([...languages.filter(Boolean), DEFAULT_LANGUAGE]));
  await chrome.storage.local.set({ preferred_languages: langs });
  const { error } = await getSupabase().from('user_settings').upsert({ user_id: session.user.id, preferred_languages: langs }, { onConflict: 'user_id' });
  if (error) console.warn('[roam] setLanguagePref DB error:', error.message);
  return { ok: true, data: null };
}

export async function setDiscoveryMode(mode: 'discovery' | 'deep_dive'): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: "You're not signed in. Please sign in and try again." };
  await chrome.storage.local.set({ discovery_mode: mode });
  const { error } = await getSupabase().from('user_settings').upsert({ user_id: session.user.id, discovery_mode: mode }, { onConflict: 'user_id' });
  if (error) console.warn('[roam] setDiscoveryMode DB error:', error.message);
  return { ok: true, data: null };
}

export async function setAutoTranslate(enabled: boolean): Promise<Response<null>> {
  // Persisted (not session) — matches Android's auto-translate setting.
  await chrome.storage.local.set({ auto_translate: enabled });
  return { ok: true, data: null };
}

/** Rewrites a served URL through Google Translate when the setting is on. */
export async function maybeTranslate(url: string): Promise<string> {
  const local = await chrome.storage.local.get(['auto_translate', 'translate_language']);
  if (!local.auto_translate) return url;
  const targetLang = (local.translate_language as string) || DEFAULT_LANGUAGE;
  return `https://translate.google.com/translate?sl=auto&tl=${targetLang}&u=${encodeURIComponent(url)}`;
}
