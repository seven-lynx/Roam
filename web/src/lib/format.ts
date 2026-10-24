/**
 * Format large integer counts for display in marketing/stats copy.
 * Produces human-friendly strings such as "1.6 million", "72K", or "1.2 billion".
 */
export function formatCount(n: number): string {
  const value = Number.isFinite(n) ? n : 0;
  if (value >= 1_000_000_000) {
    const b = (value / 1_000_000_000).toFixed(1);
    return `${b} billion`;
  }
  if (value >= 1_000_000) {
    const m = (value / 1_000_000).toFixed(1);
    return `${m} million`;
  }
  if (value >= 1000) {
    const k = (value / 1000).toFixed(1);
    return `${k}K`;
  }
  return `${value}`;
}
