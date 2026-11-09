import { formatCount, describeWait } from '@/lib/format';

describe('formatCount', () => {
  it('leaves small numbers unchanged', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(999)).toBe('999');
  });

  it('abbreviates thousands', () => {
    expect(formatCount(1000)).toBe('1.0K');
    expect(formatCount(1500)).toBe('1.5K');
  });

  it('abbreviates millions', () => {
    expect(formatCount(1_600_000)).toBe('1.6 million');
    expect(formatCount(4_200_000)).toBe('4.2 million');
  });

  it('abbreviates billions', () => {
    expect(formatCount(1_000_000_000)).toBe('1.0 billion');
    expect(formatCount(2_500_000_000)).toBe('2.5 billion');
  });

  it('treats non-finite values as zero', () => {
    expect(formatCount(Number.NaN)).toBe('0');
  });
});

describe('describeWait', () => {
  const now = new Date('2026-11-09T12:00:00Z');

  it('falls back to "soon" without a usable timestamp', () => {
    expect(describeWait(null, now)).toBe('soon');
    expect(describeWait('not-a-date', now)).toBe('soon');
  });

  it('uses minutes below the hour, rounded to five', () => {
    expect(describeWait('2026-11-09T12:02:00Z', now)).toBe('within minutes');
    expect(describeWait('2026-11-09T12:25:00Z', now)).toBe('in about 25 minutes');
    expect(describeWait('2026-11-09T12:52:00Z', now)).toBe('in about 50 minutes');
  });

  it('uses hours from one hour up, singular included', () => {
    expect(describeWait('2026-11-09T13:10:00Z', now)).toBe('in about 1 hour');
    expect(describeWait('2026-11-09T15:05:00Z', now)).toBe('in about 3 hours');
    expect(describeWait('2026-11-10T00:00:00Z', now)).toBe('in about 12 hours');
  });
});
