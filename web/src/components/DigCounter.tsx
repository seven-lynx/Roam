'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Animated segmented-display counter. Counts from 0 to `value` on mount,
 * honoring reduced-motion by jumping straight to the final value.
 */
export function DigCounter({
  value,
  label,
  format,
}: {
  value: number;
  label?: string;
  format?: (n: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fmt = format ?? ((n: number) => Math.round(n).toLocaleString());

    if (reduce) {
      setDisplay(fmt(value));
      return;
    }

    let raf = 0;
    const start = performance.now();
    const duration = 900;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(fmt(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplay(fmt(value));
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, format]);

  return (
    <div className="text-center">
      {label && <div className="kicker mb-1">{label}</div>}
      <span ref={ref} className="font-mono text-2xl phosphor tabular-nums">
        {display}
      </span>
    </div>
  );
}
