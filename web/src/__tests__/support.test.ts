import {
  getSupportTotals,
  MONTHLY_GOAL_USD,
  RECEIVED_THIS_MONTH_USD,
  supportProgressPercent,
} from '@/lib/support';

describe('getSupportTotals', () => {
  it('returns the monthly goal and the manually-updated received amount', () => {
    expect(getSupportTotals()).toEqual({
      goal: MONTHLY_GOAL_USD,
      received: RECEIVED_THIS_MONTH_USD,
    });
    expect(MONTHLY_GOAL_USD).toBe(27);
    expect(RECEIVED_THIS_MONTH_USD).toBe(0);
  });
});

describe('supportProgressPercent', () => {
  it('computes a percentage of the monthly goal', () => {
    expect(supportProgressPercent(0, 27)).toBe(0);
    expect(supportProgressPercent(13.5, 27)).toBeCloseTo(50);
    expect(supportProgressPercent(27, 27)).toBe(100);
  });

  it('clamps the result to 0..100', () => {
    expect(supportProgressPercent(-5, 27)).toBe(0);
    expect(supportProgressPercent(100, 27)).toBe(100);
  });

  it('handles a zero or non-finite goal', () => {
    expect(supportProgressPercent(10, 0)).toBe(0);
    expect(supportProgressPercent(10, Number.NaN)).toBe(0);
  });
});
