// social.ts — formatting helpers for the follow graph and activity feed.
//
// Kept free of chrome/network calls so the popup rendering rules can be unit
// tested (see src/__tests__/social.test.ts).

import type { ActivityItem } from './messages';

const WEB_ORIGIN = 'https://roamtheweb.app';
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Re-orders profile rows to match the follow ordering returned by the query. */
export function orderByIds<T extends { id: string }>(rows: T[], ids: string[]): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered: T[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (row) ordered.push(row);
  }
  return ordered;
}

/** "just now", "5m", "3h", "2d", then a locale date. */
export function relativeTime(iso: string, nowMs: number = Date.now()): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '';
  const age = nowMs - ts;
  if (age < MINUTE) return 'just now';
  if (age < HOUR) return `${Math.floor(age / MINUTE)}m`;
  if (age < DAY) return `${Math.floor(age / HOUR)}h`;
  if (age < 7 * DAY) return `${Math.floor(age / DAY)}d`;
  return new Date(ts).toLocaleDateString();
}

/** Action phrase for an activity row ("rated The Boring Company"). */
export function activityText(item: ActivityItem): string {
  const subject = item.subject_title || 'a page';
  switch (item.activity_type) {
    case 'badge_unlocked':
      return item.badge_name ? `earned the ${item.badge_name} badge` : 'earned a badge';
    case 'url_rated':
      return `rated ${subject}`;
    case 'url_submitted':
      return `submitted ${subject}`;
    case 'url_saved':
      return `saved ${subject}`;
    case 'collection_created':
      return `created the collection ${item.subject_title || 'a collection'}`;
    case 'collection_updated':
      return `updated the collection ${item.subject_title || 'a collection'}`;
    case 'url_added_to_collection':
      return `added ${subject} to ${item.collection_slug || 'a collection'}`;
    default:
      return 'was active';
  }
}

/** Absolute URL an activity row should open, or null when it has no target. */
export function activityLink(item: ActivityItem): string | null {
  if (item.subject_url) {
    return item.subject_url.startsWith('http') ? item.subject_url : WEB_ORIGIN + item.subject_url;
  }
  if (item.collection_slug) return `${WEB_ORIGIN}/c/${item.collection_slug}`;
  if (item.username) return `${WEB_ORIGIN}/u/${item.username}`;
  return null;
}
