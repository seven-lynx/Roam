import { describe, it, expect } from 'vitest';
import { describeExhaustion, describeWait, parseRoamExhaustion } from '../lib/exhaustion';

describe('parseRoamExhaustion', () => {
  it('reads the reason, scope and wait out of a 404 body', () => {
    const body = { reason: 'cooldown', scope: 'category:11111111-1111-1111-1111-111111111111', available_later: '2026-11-09T15:00:00Z' };
    expect(parseRoamExhaustion(body)).toEqual({
      reason: 'cooldown',
      scope: 'category:11111111-1111-1111-1111-111111111111',
      available_later: '2026-11-09T15:00:00Z',
    });
  });

  it('keeps the reason when the optional fields are missing', () => {
    expect(parseRoamExhaustion({ reason: 'pool_empty' })).toEqual({
      reason: 'pool_empty',
      scope: null,
      available_later: null,
    });
  });

  it('returns null for the pre-#120 error body, so the generic copy stands', () => {
    expect(parseRoamExhaustion({ error: 'No more URLs available' })).toBeNull();
  });

  it('returns null for a reason this build does not know', () => {
    expect(parseRoamExhaustion({ reason: 'paywall' })).toBeNull();
  });

  it('returns null for anything that is not an object', () => {
    expect(parseRoamExhaustion(null)).toBeNull();
    expect(parseRoamExhaustion(undefined)).toBeNull();
    expect(parseRoamExhaustion('cooldown')).toBeNull();
  });
});

describe('describeWait', () => {
  const now = new Date('2026-11-09T12:00:00Z');

  it('rounds long waits to hours', () => {
    expect(describeWait('2026-11-09T14:20:00Z', now)).toBe('in about 2 hours');
  });

  it('singularises a one-hour wait', () => {
    expect(describeWait('2026-11-09T13:00:00Z', now)).toBe('in about 1 hour');
  });

  it('rounds sub-hour waits to five-minute steps', () => {
    expect(describeWait('2026-11-09T12:25:00Z', now)).toBe('in about 25 minutes');
  });

  it('says within minutes once the wait is nearly over', () => {
    expect(describeWait('2026-11-09T12:03:00Z', now)).toBe('within minutes');
  });

  it('falls back to soon without a usable timestamp', () => {
    expect(describeWait(null, now)).toBe('soon');
    expect(describeWait('not-a-date', now)).toBe('soon');
  });
});

describe('describeExhaustion', () => {
  const now = new Date('2026-11-09T12:00:00Z');

  it('sends the user to their categories only when the pool is empty', () => {
    const copy = describeExhaustion({ reason: 'pool_empty', scope: 'global', available_later: null }, now);
    expect(copy.showCategories).toBe(true);
    expect(copy.title).toContain('explored everything');
  });

  it('explains a cooldown as a wait and hides the category advice', () => {
    const copy = describeExhaustion({ reason: 'cooldown', scope: 'global', available_later: '2026-11-09T14:20:00Z' }, now);
    expect(copy.showCategories).toBe(false);
    expect(copy.sub).toContain('in about 2 hours');
  });

  it('blames the filters when they are the cause', () => {
    const copy = describeExhaustion({ reason: 'filters', scope: 'category:abc', available_later: null }, now);
    expect(copy.showCategories).toBe(false);
    expect(copy.title).toContain('filters');
  });

  it('falls back to the shipped copy without a reason', () => {
    const copy = describeExhaustion(null, now);
    expect(copy.showCategories).toBe(true);
    expect(copy.sub).toBe('Add more categories to see new pages.');
  });
});
