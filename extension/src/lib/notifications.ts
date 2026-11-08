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
