import { formatCount } from '@/lib/format';

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
