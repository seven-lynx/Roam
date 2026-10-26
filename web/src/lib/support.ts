/**
 * Operating costs and support totals for the /support-roam page.
 *
 * The "received this month" amount is maintained by hand: bump
 * RECEIVED_THIS_MONTH_USD whenever a tip comes in. If we ever wire up a real
 * donation feed, replace these values with that data source (see
 * lib/home-stats.ts for the cached-RPC pattern).
 */

export const SUPABASE_PRO_MONTHLY_USD = 25;
export const DOMAIN_COST_USD = 14;
export const DOMAIN_BILLING_PERIOD_YEARS = 2;

/** Rounded up from ~$25.58 to cover processing fees + a small buffer. */
export const MONTHLY_GOAL_USD = 27;

/** Manually updated when a tip comes in. */
export const RECEIVED_THIS_MONTH_USD = 0;

export interface SupportTotals {
  goal: number;
  received: number;
}

export function getSupportTotals(): SupportTotals {
  return { goal: MONTHLY_GOAL_USD, received: RECEIVED_THIS_MONTH_USD };
}

export function supportProgressPercent(received: number, goal: number): number {
  if (!Number.isFinite(goal) || goal <= 0) return 0;
  return Math.max(0, Math.min(100, (received / goal) * 100));
}
