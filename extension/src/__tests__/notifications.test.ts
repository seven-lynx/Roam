import { describe, it, expect } from 'vitest';
import { notificationLink, notificationText } from '../lib/notifications';
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
