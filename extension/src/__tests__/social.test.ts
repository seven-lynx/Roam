import { describe, it, expect } from 'vitest';
import { orderByIds, relativeTime, activityText, activityLink } from '../lib/social';
import type { ActivityItem } from '../lib/messages';

function activity(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id: 'a1',
    username: 'ada',
    display_name: 'Ada',
    activity_type: 'url_rated',
    subject_title: 'The Boring Company',
    subject_url: null,
    badge_name: null,
    collection_slug: null,
    created_at: '2026-01-01T12:00:00.000Z',
    ...overrides,
  };
}

describe('orderByIds', () => {
  it('follows the id order and drops missing rows', () => {
    const rows = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }, { id: 'c', v: 3 }];
    expect(orderByIds(rows, ['c', 'a', 'missing', 'b']).map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });

  it('returns an empty list for no ids', () => {
    expect(orderByIds([{ id: 'a' }], [])).toEqual([]);
  });
});

describe('relativeTime', () => {
  const now = Date.parse('2026-01-01T12:00:00.000Z');

  it('formats minutes, hours and days', () => {
    expect(relativeTime('2026-01-01T11:59:30.000Z', now)).toBe('just now');
    expect(relativeTime('2026-01-01T11:55:00.000Z', now)).toBe('5m');
    expect(relativeTime('2026-01-01T09:00:00.000Z', now)).toBe('3h');
    expect(relativeTime('2025-12-30T12:00:00.000Z', now)).toBe('2d');
  });

  it('falls back to a date for older entries', () => {
    const result = relativeTime('2025-01-01T12:00:00.000Z', now);
    expect(result).not.toBe('');
    expect(result).not.toMatch(/^\d+(m|h|d)$/);
  });

  it('returns an empty string for an unparseable timestamp', () => {
    expect(relativeTime('nope', now)).toBe('');
  });
});

describe('activityText', () => {
  it('describes each activity type', () => {
    expect(activityText(activity({ activity_type: 'url_rated' }))).toBe('rated The Boring Company');
    expect(activityText(activity({ activity_type: 'url_submitted' }))).toBe('submitted The Boring Company');
    expect(activityText(activity({ activity_type: 'url_saved' }))).toBe('saved The Boring Company');
    expect(activityText(activity({ activity_type: 'badge_unlocked', badge_name: 'Explorer' }))).toBe('earned the Explorer badge');
    expect(activityText(activity({ activity_type: 'collection_created', subject_title: 'Space' }))).toBe('created the collection Space');
    expect(
      activityText(activity({ activity_type: 'url_added_to_collection', collection_slug: 'space' })),
    ).toBe('added The Boring Company to space');
  });

  it('degrades gracefully for unknown types and missing subjects', () => {
    expect(activityText(activity({ activity_type: 'something_new' }))).toBe('was active');
    expect(activityText(activity({ subject_title: null }))).toBe('rated a page');
    expect(activityText(activity({ activity_type: 'badge_unlocked', badge_name: null }))).toBe('earned a badge');
  });
});

describe('activityLink', () => {
  it('prefers the subject url', () => {
    expect(activityLink(activity({ subject_url: 'https://example.com/a' }))).toBe('https://example.com/a');
    expect(activityLink(activity({ subject_url: '/collections/space' }))).toBe(
      'https://roamtheweb.app/collections/space',
    );
  });

  it('falls back to the public collection then the profile', () => {
    expect(activityLink(activity({ collection_slug: 'space' }))).toBe('https://roamtheweb.app/c/space');
    expect(activityLink(activity({}))).toBe('https://roamtheweb.app/u/ada');
  });
});
