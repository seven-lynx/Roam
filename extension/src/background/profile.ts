// profile.ts — own-profile read and edits.
//
// The username can only be claimed once (the web app behaves the same way):
// after that the field is display-only. Display name and bio are free to edit.

import { getSupabase } from '../lib/supabase';
import type { MyProfileData, Response } from '../lib/messages';
import {
  isValidUsername,
  normaliseUsername,
  validateBio,
  validateDisplayName,
} from '../lib/validate';

const PROFILE_FIELDS =
  'username, display_name, bio, avatar_url, is_public, level, xp_total, streak_days, roamed_count, submitted_count';

type ProfileRow = {
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_public: boolean | null;
  level: number | null;
  xp_total: number | null;
  streak_days: number | null;
  roamed_count: number | null;
  submitted_count: number | null;
};

async function currentUserId(): Promise<string | null> {
  const session = (await getSupabase().auth.getSession()).data.session;
  return session?.user.id ?? null;
}

export async function getMyProfile(): Promise<Response<MyProfileData>> {
  const me = await currentUserId();
  if (!me) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await getSupabase()
    .from('profiles')
    .select(PROFILE_FIELDS)
    .eq('id', me)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Profile not found.' };

  const row = data as ProfileRow;
  return {
    ok: true,
    data: {
      username: row.username,
      display_name: row.display_name,
      bio: row.bio,
      avatar_url: row.avatar_url,
      is_public: row.is_public ?? false,
      level: row.level ?? 1,
      xp_total: row.xp_total ?? 0,
      streak_days: row.streak_days ?? 0,
      roamed: row.roamed_count ?? 0,
      submitted: row.submitted_count ?? 0,
    },
  };
}

export async function setProfileFields(displayName: string, bio: string): Promise<Response<null>> {
  const nameError = validateDisplayName(displayName);
  if (nameError) return { ok: false, error: nameError };
  const bioError = validateBio(bio);
  if (bioError) return { ok: false, error: bioError };

  const me = await currentUserId();
  if (!me) return { ok: false, error: 'Not signed in.' };

  const { error } = await getSupabase()
    .from('profiles')
    .update({
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
    })
    .eq('id', me);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function claimUsername(rawUsername: string): Promise<Response<{ username: string }>> {
  const username = normaliseUsername(rawUsername);
  if (!isValidUsername(username)) {
    return {
      ok: false,
      error: 'Usernames are 3–20 characters using lowercase letters, numbers or underscores.',
    };
  }

  const me = await currentUserId();
  if (!me) return { ok: false, error: 'Not signed in.' };

  const { data: existing, error: readError } = await getSupabase()
    .from('profiles')
    .select('username')
    .eq('id', me)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if ((existing as { username?: string | null } | null)?.username) {
    return { ok: false, error: 'Your account already has a username.' };
  }

  const { error } = await getSupabase().from('profiles').update({ username }).eq('id', me);
  if (error) {
    const taken = error.code === '23505' || /duplicate|unique/i.test(error.message);
    return { ok: false, error: taken ? 'That username is taken.' : error.message };
  }
  return { ok: true, data: { username } };
}
