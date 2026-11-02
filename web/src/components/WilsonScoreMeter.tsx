'use client';

/**
 * Wilson score meter — parity with Android's `WilsonScoreMeter`. A horizontal
 * signal bar with the neutral point at 0.5: fills red to the left of centre
 * (weak) and phosphor-green to the right (strong), plus the raw 3-decimal score
 * and, when known, the up/down vote counts.
 */
export function WilsonScoreMeter({
  score,
  upvotes,
  downvotes,
}: {
  score: number;
  upvotes?: number;
  downvotes?: number;
}) {
  const clamped = Math.min(1, Math.max(0, score));
  const negative = clamped < 0.5;

  return (
    <span className="wilson" role="img" aria-label={`Wilson score ${clamped.toFixed(3)}`}>
      <span className="wilson-track" aria-hidden="true">
        <span
          className="wilson-fill"
          style={{ width: `${clamped * 100}%`, background: negative ? 'var(--danger)' : 'var(--ok)' }}
        />
        <span className="wilson-mid" />
      </span>
      <span className="wilson-score" style={{ color: negative ? 'var(--danger)' : 'var(--ok)' }}>
        {clamped.toFixed(3)}
      </span>
      {(upvotes !== undefined || downvotes !== undefined) && (
        <span className="wilson-votes">
          <span className="text-ok">▲ {upvotes ?? 0}</span>
          <span className="text-danger">▼ {downvotes ?? 0}</span>
        </span>
      )}
    </span>
  );
}