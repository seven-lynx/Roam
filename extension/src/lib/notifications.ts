// notifications.ts — derive the actionable target of a notification.
//
// Mirrors the mapping the web notification bell uses
// (web/src/components/NotificationBell.tsx) so a row tapped in the popup lands
// on the same page the web app would open.

import type { NotificationItem } from './messages';

const WEB_ORIGIN = 'https://roamtheweb.app';

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Absolute (or origin-anchored) URL a notification should open, or null. */
export function notificationLink(n: NotificationItem): string | null {
  const data = n.data ?? {};
  const direct = asString(data.url) ?? asString(data.link_url) ?? asString(data.link);
  if (direct) return direct.startsWith('http') ? direct : WEB_ORIGIN + direct;

  const profileUrl = asString(data.v_profile_url);
  if (profileUrl) return profileUrl;

  const username = asString(data.username) ?? asString(data.follower_username);
  if (username) return `${WEB_ORIGIN}/u/${username}`;

  switch (n.type) {
    case 'challenge_complete':
      return `${WEB_ORIGIN}/challenges`;
    case 'badge_unlocked':
      return `${WEB_ORIGIN}/badges`;
    case 'level_up':
      return `${WEB_ORIGIN}/profile`;
    default:
      return null;
  }
}

/** Headline + secondary line for a notification row. */
export function notificationText(n: NotificationItem): { title: string; body: string } {
  const title = asString(n.title) ?? n.type;
  const body = asString(n.body) ?? '';
  return { title, body };
}

/** Notification types worth surfacing as a celebration. */
const CELEBRATION_TYPES = new Set(['badge_unlocked', 'level_up', 'challenge_complete']);

export interface NotificationPayload {
  title: string;
  message: string;
}

/** Payload for chrome.notifications.create — chrome needs a non-empty message. */
export function notificationPayload(n: NotificationItem): NotificationPayload {
  const { title, body } = notificationText(n);
  return {
    title: title.slice(0, 120),
    message: (body || title).slice(0, 240),
  };
}

/** Newest created_at in the list, or null when nothing parses. */
export function latestCreatedAt(items: NotificationItem[]): string | null {
  let newest: number | null = null;
  let newestIso: string | null = null;
  for (const item of items) {
    const ts = Date.parse(item.created_at);
    if (!Number.isFinite(ts)) continue;
    if (newest === null || ts > newest) {
      newest = ts;
      newestIso = item.created_at;
    }
  }
  return newestIso;
}

/**
 * Unread items newer than the stored watermark, newest first, capped so a long
 * absence does not fire a burst of desktop notifications.
 */
export function pickNewNotifications(
  items: NotificationItem[],
  sinceIso: string | null,
  cap = 3,
): NotificationItem[] {
  const parseable = items.filter((n) => Number.isFinite(Date.parse(n.created_at)));
  if (!sinceIso) return parseable.slice(0, cap);
  const since = Date.parse(sinceIso);
  if (!Number.isFinite(since)) return parseable.slice(0, cap);
  return parseable
    .filter((n) => Date.parse(n.created_at) > since)
    .slice(0, cap);
}

/**
 * The most recent unlock (badge, level, challenge) that landed while the popup
 * was closed. The popup shuts immediately after a rating, so this is the only
 * place a celebration can be shown.
 */
export function recentCelebration(
  items: NotificationItem[],
  nowMs: number,
  windowMs = 15 * 60 * 1000,
): NotificationItem | null {
  for (const item of items) {
    if (item.read || !CELEBRATION_TYPES.has(item.type)) continue;
    const ts = Date.parse(item.created_at);
    if (!Number.isFinite(ts)) continue;
    const age = nowMs - ts;
    if (age >= 0 && age <= windowMs) return item;
  }
  return null;
}
