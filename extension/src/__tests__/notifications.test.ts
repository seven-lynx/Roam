import { describe, it, expect } from 'vitest';
import { notificationLink, notificationText, notificationPayload, latestCreatedAt, pickNewNotifications, recentCelebration } from '../lib/notifications';
import type { NotificationItem } from '../lib/messages';

function notif(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 'n1',
    type: 'url_approved',
    title: 'Approved',
    body: null,
    data: {},
    read: false,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('notificationLink', () => {
  it('passes an absolute data.url straight through', () => {
    expect(notificationLink(notif({ data: { url: 'https://example.com/a' } }))).toBe('https://example.com/a');
  });

  it('anchors a relative data.url to the web origin', () => {
    expect(notificationLink(notif({ data: { url: '/collections/mine' } }))).toBe(
      'https://roamtheweb.app/collections/mine',
    );
  });

  it('links a follower notification to the follower profile', () => {
    expect(notificationLink(notif({ type: 'new_follower', data: { username: 'ada' } }))).toBe(
      'https://roamtheweb.app/u/ada',
    );
  });

  it('prefers follower_username when username is absent', () => {
    expect(notificationLink(notif({ type: 'new_follower', data: { follower_username: 'grace' } }))).toBe(
      'https://roamtheweb.app/u/grace',
    );
  });

  it('uses v_profile_url for badge unlocks', () => {
    expect(
      notificationLink(notif({ type: 'badge_unlocked', data: { v_profile_url: 'https://roamtheweb.app/u/ada' } })),
    ).toBe('https://roamtheweb.app/u/ada');
  });

  it('falls back to the type route when no target is present', () => {
    expect(notificationLink(notif({ type: 'challenge_complete', data: {} }))).toBe(
      'https://roamtheweb.app/challenges',
    );
    expect(notificationLink(notif({ type: 'badge_unlocked', data: null }))).toBe('https://roamtheweb.app/badges');
    expect(notificationLink(notif({ type: 'level_up', data: {} }))).toBe('https://roamtheweb.app/profile');
  });

  it('returns null for an unmapped type with no data', () => {
    expect(notificationLink(notif({ type: 'something_new', data: {} }))).toBeNull();
  });

  it('ignores non-string data values', () => {
    expect(notificationLink(notif({ type: 'something_new', data: { url: 42, username: null } }))).toBeNull();
  });
});

describe('notificationText', () => {
  it('uses title and body when present', () => {
    expect(notificationText(notif({ title: 'URL approved', body: 'It is live.' }))).toEqual({
      title: 'URL approved',
      body: 'It is live.',
    });
  });

  it('falls back to the type when the title is missing', () => {
    expect(notificationText(notif({ title: null, body: null }))).toEqual({
      title: 'url_approved',
      body: '',
    });
  });

  it('treats an empty title as missing', () => {
    expect(notificationText(notif({ title: '' })).title).toBe('url_approved');
  });
});

describe('notificationPayload', () => {
  it('uses the body as the message', () => {
    expect(notificationPayload(notif({ title: 'Badge unlocked', body: 'Explorer badge' }))).toEqual({
      title: 'Badge unlocked',
      message: 'Explorer badge',
    });
  });

  it('falls back to the title when there is no body', () => {
    expect(notificationPayload(notif({ title: 'Badge unlocked', body: null }))).toEqual({
      title: 'Badge unlocked',
      message: 'Badge unlocked',
    });
  });

  it('caps long text for the OS notification surface', () => {
    const payload = notificationPayload(notif({ title: 'x'.repeat(200), body: 'y'.repeat(400) }));
    expect(payload.title).toHaveLength(120);
    expect(payload.message).toHaveLength(240);
  });
});

describe('latestCreatedAt', () => {
  it('returns the newest parseable timestamp', () => {
    expect(
      latestCreatedAt([
        notif({ created_at: '2026-01-01T10:00:00.000Z' }),
        notif({ created_at: '2026-01-01T12:00:00.000Z' }),
        notif({ created_at: 'not-a-date' }),
      ]),
    ).toBe('2026-01-01T12:00:00.000Z');
  });

  it('returns null when nothing parses', () => {
    expect(latestCreatedAt([])).toBeNull();
    expect(latestCreatedAt([notif({ created_at: 'nope' })])).toBeNull();
  });
});

describe('pickNewNotifications', () => {
  const items = [
    notif({ id: 'c', created_at: '2026-01-01T12:00:00.000Z' }),
    notif({ id: 'b', created_at: '2026-01-01T11:00:00.000Z' }),
    notif({ id: 'a', created_at: '2026-01-01T10:00:00.000Z' }),
  ];

  it('returns everything (capped) when there is no watermark', () => {
    expect(pickNewNotifications(items, null).map((n) => n.id)).toEqual(['c', 'b', 'a']);
    expect(pickNewNotifications(items, null, 2).map((n) => n.id)).toEqual(['c', 'b']);
  });

  it('returns only items newer than the watermark', () => {
    expect(pickNewNotifications(items, '2026-01-01T10:30:00.000Z').map((n) => n.id)).toEqual(['c', 'b']);
  });

  it('returns nothing when the watermark is the newest item', () => {
    expect(pickNewNotifications(items, '2026-01-01T12:00:00.000Z')).toEqual([]);
  });

  it('treats an unparseable watermark as absent', () => {
    expect(pickNewNotifications(items, 'nope', 1).map((n) => n.id)).toEqual(['c']);
  });
});

describe('recentCelebration', () => {
  const now = Date.parse('2026-01-01T12:00:00.000Z');
  const recent = '2026-01-01T11:59:00.000Z';

  it('returns a recent unread unlock', () => {
    const item = notif({ type: 'badge_unlocked', created_at: '2026-01-01T11:55:00.000Z' });
    expect(recentCelebration([item], now)?.id).toBe('n1');
  });

  it('ignores unlocks older than the window', () => {
    const item = notif({ type: 'badge_unlocked', created_at: '2026-01-01T11:00:00.000Z' });
    expect(recentCelebration([item], now)).toBeNull();
  });

  it('ignores read notifications and non-celebration types', () => {
    expect(recentCelebration([notif({ type: 'badge_unlocked', read: true, created_at: recent })], now)).toBeNull();
    expect(recentCelebration([notif({ type: 'url_approved', created_at: recent })], now)).toBeNull();
  });

  it('honours a custom window', () => {
    const item = notif({ type: 'level_up', created_at: '2026-01-01T11:59:30.000Z' });
    expect(recentCelebration([item], now, 60_000)).not.toBeNull();
    expect(recentCelebration([item], now, 10_000)).toBeNull();
  });
});
