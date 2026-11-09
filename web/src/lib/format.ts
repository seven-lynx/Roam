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

/**
 * Describe how long until `iso` in the terms a reader cares about: "in about 3
 * hours", "in about 25 minutes", "within minutes" once it is close, and "soon"
 * when there is no timestamp to read. Used for the discovery cooldown, where the
 * exact expiry matters less than the size of the wait.
 */
export function describeWait(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'soon';
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return 'soon';
  const minutes = Math.round((target - now.getTime()) / 60_000);
  if (minutes <= 5) return 'within minutes';
  if (minutes < 60) return `in about ${Math.round(minutes / 5) * 5} minutes`;
  const hours = Math.max(1, Math.round(minutes / 60));
  return `in about ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}
