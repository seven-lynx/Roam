// notifications.ts — in-app notification reads and state changes.

import { getSupabase } from '../../lib/supabase';
import type { NotificationItem, Response } from '../../lib/messages';

export async function getNotifications(): Promise<Response<NotificationItem[]>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };
  const { data, error } = await getSupabase()
    .from('notifications')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []) as NotificationItem[] };
}

export async function getUnreadNotificationCount(): Promise<Response<number>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: true, data: 0 };
  const { count, error } = await getSupabase()
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', session.user.id)
    .eq('read', false);
  if (error) return { ok: true, data: 0 };
  return { ok: true, data: count ?? 0 };
}

export async function markNotificationsRead(): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };
  const { error } = await getSupabase()
    .from('notifications')
    .update({ read: true })
    .eq('user_id', session.user.id)
    .eq('read', false);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function deleteNotification(notificationId: string): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };
  const { error } = await getSupabase()
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', session.user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function markNotificationRead(notificationId: string): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };
  const { error } = await getSupabase()
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', session.user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function clearNotifications(): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };
  const { error } = await getSupabase()
    .from('notifications')
    .delete()
    .eq('user_id', session.user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}
