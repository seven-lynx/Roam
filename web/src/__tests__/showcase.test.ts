import { hashSeed, selectMonthlySites, currentMonthKey } from '@/lib/showcase';

describe('selectMonthlySites', () => {
  const items = Array.from({ length: 30 }, (_, i) => i);

  it('returns a deterministic subset for the same month key', () => {
    const a = selectMonthlySites(items, 10, '2026-10');
    const b = selectMonthlySites(items, 10, '2026-10');
    expect(a).toEqual(b);
    expect(a).toHaveLength(10);
  });

  it('does not mutate the input array', () => {
    const snapshot = items.slice();
    selectMonthlySites(items, 10, '2026-10');
    expect(items).toEqual(snapshot);
  });

  it('returns the whole array when count exceeds the input length', () => {
    const small = [1, 2, 3];
    const result = selectMonthlySites(small, 10, '2026-10');
    expect(result).toHaveLength(3);
    expect(result.sort()).toEqual([1, 2, 3]);
  });

  it('returns only elements from the input', () => {
    const result = selectMonthlySites(items, 10, '2026-10');
    const inputSet = new Set(items);
    for (const value of result) {
      expect(inputSet.has(value)).toBe(true);
    }
  });

  it('rotates the selection across months', () => {
    const october = selectMonthlySites(items, 10, '2026-10');
    const november = selectMonthlySites(items, 10, '2026-11');
    expect(october).not.toEqual(november);
  });
});

describe('hashSeed', () => {
  it('produces different seeds for different inputs', () => {
    expect(hashSeed('2026-10')).not.toBe(hashSeed('2026-11'));
  });

  it('is stable for the same input', () => {
    expect(hashSeed('roam')).toBe(hashSeed('roam'));
  });
});

describe('currentMonthKey', () => {
  it('formats year-month with zero padding', () => {
    expect(currentMonthKey(new Date('2026-01-05T00:00:00Z'))).toBe('2026-01');
    expect(currentMonthKey(new Date('2026-10-24T00:00:00Z'))).toBe('2026-10');
  });
});
