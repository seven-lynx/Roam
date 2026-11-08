// social.ts — follow graph and activity feed handlers.
//
// Follow/unfollow go through the follow Edge Function (it awards social XP and
// evaluates badges). Follower and following lists are read straight from
// PostgREST, mirroring the Android repository: the profiles RLS policy only
// returns public profiles, so private accounts stay out of the lists.

import { getSupabase } from '../lib/supabase';
import type { Response, ActivityItem, FollowUser } from '../lib/messages';
import { isUuid } from '../lib/validate';
import { orderByIds } from '../lib/social';

declare const __SUPABASE_URL__: string;

const PROFILE_FIELDS = 'id, username, display_name, avatar_url';
const FOLLOW_LIST_LIMIT = 100;
const ACTIVITY_LIMIT = 30;

async function currentUserId(): Promise<string | null> {
  const session = (await getSupabase().auth.getSession()).data.session;
  return session?.user.id ?? null;
}

export async function followUser(userId: string): Promise<Response<null>> {
  if (!isUuid(userId)) return { ok: false, error: 'Invalid user.' };
  const me = await currentUserId();
  if (!me) return { ok: false, error: 'Not signed in.' };
  if (me === userId) return { ok: false, error: "You can't follow yourself." };

  const { data, error } = await getSupabase().functions.invoke('follow', {
    body: { action: 'follow', following_id: userId },
  });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true, data: null };
}

export async function unfollowUser(userId: string): Promise<Response<null>> {
  if (!isUuid(userId)) return { ok: false, error: 'Invalid user.' };
  const me = await currentUserId();
  if (!me) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await getSupabase().functions.invoke('follow', {
    body: { action: 'unfollow', following_id: userId },
  });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true, data: null };
}

async function followersOf(userId: string): Promise<Response<FollowUser[]>> {
  const { data, error } = await getSupabase()
    .from('follows')
    .select('follower_id')
    .eq('following_id', userId)
    .order('created_at', { ascending: false })
    .limit(FOLLOW_LIST_LIMIT);
  if (error) return { ok: false, error: error.message };
  const ids = ((data ?? []) as { follower_id: string }[]).map((r) => r.follower_id).filter(Boolean);
  if (ids.length === 0) return { ok: true, data: [] };

  const { data: profiles, error: profileError } = await getSupabase()
    .from('profiles')
    .select(PROFILE_FIELDS)
    .in('id', ids);
  if (profileError) return { ok: false, error: profileError.message };
  return { ok: true, data: orderByIds((profiles ?? []) as FollowUser[], ids) };
}

async function followingOf(userId: string): Promise<Response<FollowUser[]>> {
  const { data, error } = await getSupabase()
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)
    .order('created_at', { ascending: false })
    .limit(FOLLOW_LIST_LIMIT);
  if (error) return { ok: false, error: error.message };
  const ids = ((data ?? []) as { following_id: string }[]).map((r) => r.following_id).filter(Boolean);
  if (ids.length === 0) return { ok: true, data: [] };

  const { data: profiles, error: profileError } = await getSupabase()
    .from('profiles')
    .select(PROFILE_FIELDS)
    .in('id', ids);
  if (profileError) return { ok: false, error: profileError.message };
  return { ok: true, data: orderByIds((profiles ?? []) as FollowUser[], ids) };
}

export async function getFollowers(): Promise<Response<FollowUser[]>> {
  const me = await currentUserId();
  if (!me) return { ok: false, error: 'Not signed in.' };
  return followersOf(me);
}

export async function getFollowing(): Promise<Response<FollowUser[]>> {
  const me = await currentUserId();
  if (!me) return { ok: false, error: 'Not signed in.' };
  return followingOf(me);
}

export async function getActivityFeed(limit: number = ACTIVITY_LIMIT): Promise<Response<ActivityItem[]>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };

  const capped = Math.min(Math.max(limit, 1), 100);
  try {
    const res = await fetch(`${__SUPABASE_URL__}/functions/v1/activity-feed?limit=${capped}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "Couldn't load your feed. Please try again." };
    }
    const payload = (await res.json()) as { activities?: ActivityItem[] };
    return { ok: true, data: payload.activities ?? [] };
  } catch {
    return { ok: false, error: "Couldn't load your feed. Please try again." };
  }
}
