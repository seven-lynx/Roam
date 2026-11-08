// notify.ts — desktop notifications for account events (follows, shares, badge
// unlocks, level-ups, challenge completions).
//
// MV3 extensions cannot subscribe to Web Push, so unread notifications are
// polled on a chrome.alarms schedule (event-driven, never a background loop —
// rule E.2) and surfaced through chrome.notifications. Nothing is scheduled
// until the user turns the toggle on, and the watermark seeded at that moment
// stops the existing backlog from replaying.

import { getSupabase } from '../lib/supabase';
import type { NotificationItem, Response } from '../lib/messages';
import {
  latestCreatedAt,
  notificationLink,
  notificationPayload,
  pickNewNotifications,
} from '../lib/notifications';

export const NOTIFY_ALARM = 'roam-notify-poll';
export const NOTIFY_POLL_MINUTES = 5;

const ENABLED_KEY = 'desktop_notifications';
const SEEN_AT_KEY = 'desktop_notifications_seen_at';
const LINKS_KEY = 'desktop_notification_links';
const UNREAD_LIMIT = 10;
const LINK_MEMORY = 20;

/** Creates (or refreshes) the poll alarm. Call on start-up, never in a loop. */
export function registerNotificationAlarm(): void {
  if (!chrome.alarms?.create) return;
  chrome.alarms.create(NOTIFY_ALARM, { periodInMinutes: NOTIFY_POLL_MINUTES });
}

function rememberLink(links: Record<string, string>, notificationId: string, url: string): Record<string, string> {
  const next: Record<string, string> = { ...links, [notificationId]: url };
  const entries = Object.entries(next);
  return entries.length <= LINK_MEMORY ? next : Object.fromEntries(entries.slice(-LINK_MEMORY));
}

/** Fetches unread notifications and raises a desktop notification for each new one. */
export async function pollNotifications(): Promise<void> {
  const prefs = await chrome.storage.local.get([ENABLED_KEY, SEEN_AT_KEY]);
  if (prefs[ENABLED_KEY] !== true) return;

  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return;

  const { data, error } = await getSupabase()
    .from('notifications')
    .select('id, type, title, body, data, read, created_at')
    .eq('user_id', session.user.id)
    .eq('read', false)
    .order('created_at', { ascending: false })
    .limit(UNREAD_LIMIT);
  if (error || !data) return;

  const items = data as NotificationItem[];
  if (items.length === 0) return;

  const fresh = pickNewNotifications(items, (prefs[SEEN_AT_KEY] as string | undefined) ?? null);
  if (fresh.length > 0 && chrome.notifications?.create) {
    const stored = await chrome.storage.local.get(LINKS_KEY);
    let links = (stored[LINKS_KEY] as Record<string, string> | undefined) ?? {};

    for (const item of fresh) {
      const payload = notificationPayload(item);
      const desktopId = `roam-${item.id}`;
      chrome.notifications.create(desktopId, {
        type: 'basic',
        iconUrl: 'icon-128.png',
        title: payload.title,
        message: payload.message,
        contextMessage: 'Roam',
      });
      const link = notificationLink(item);
      if (link) links = rememberLink(links, desktopId, link);
    }

    await chrome.storage.local.set({ [LINKS_KEY]: links });
  }

  const newest = latestCreatedAt(items);
  if (newest) await chrome.storage.local.set({ [SEEN_AT_KEY]: newest });
}

/** Opens the target of a tapped desktop notification, then dismisses it. */
export async function handleNotificationClick(desktopId: string): Promise<void> {
  const stored = await chrome.storage.local.get(LINKS_KEY);
  const links = (stored[LINKS_KEY] as Record<string, string> | undefined) ?? {};
  const url = links[desktopId];
  if (url) chrome.tabs.create({ url });
  chrome.notifications?.clear(desktopId);
}

/** Toggle handler — owns the alarm and the watermark. */
export async function setDesktopNotifications(enabled: boolean): Promise<Response<null>> {
  if (!enabled) {
    await chrome.storage.local.set({ [ENABLED_KEY]: false });
    if (chrome.alarms?.clear) chrome.alarms.clear(NOTIFY_ALARM);
    return { ok: true, data: null };
  }

  // Seed the watermark first: enabling must not replay the existing backlog.
  await chrome.storage.local.set({
    [ENABLED_KEY]: true,
    [SEEN_AT_KEY]: new Date().toISOString(),
  });
  registerNotificationAlarm();
  return { ok: true, data: null };
}
