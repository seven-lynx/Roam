'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Brass compass whose needle points at the cursor. Clicking it reveals a
 * short hidden message (an easter egg).
 */
export function Compass() {
  const needle = useRef<SVGGElement>(null);
  const root = useRef<HTMLButtonElement>(null);
  const [found, setFound] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const onMove = (e: PointerEvent) => {
      const r = root.current?.getBoundingClientRect();
      if (!r || !needle.current) return;
      const deg = (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI + 90;
      needle.current.style.transform = `rotate(${deg}deg)`;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  return (
    <button
      ref={root}
      type="button"
      className="gadget relative"
      aria-label="Compass. The needle follows your cursor."
      onClick={() => setFound((v) => !v)}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="46" fill="#a9873a" stroke="#5d4616" strokeWidth="2.5" />
        <circle cx="50" cy="50" r="38" fill="#0e1a1c" stroke="#5d4616" strokeWidth="1.5" />
        {Array.from({ length: 24 }).map((_, n) => (
          <line key={n} x1="50" y1="14" x2="50" y2={n % 6 === 0 ? 20 : 17} stroke="#c9a24b" strokeWidth={n % 6 === 0 ? 1.6 : 0.8} transform={`rotate(${n * 15} 50 50)`} />
        ))}
        <text x="50" y="30" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#ff2e88">N</text>
        <g ref={needle} style={{ transformOrigin: '50px 50px', transition: 'transform .15s ease-out' }}>
          <polygon points="50,18 55,50 50,46 45,50" fill="#ff2e88" />
          <polygon points="50,82 55,50 50,54 45,50" fill="#cdd8d4" />
        </g>
        <circle cx="50" cy="50" r="3.2" fill="#c9a24b" stroke="#5d4616" />
        <ellipse cx="38" cy="30" rx="14" ry="6" fill="rgba(255,255,255,.07)" transform="rotate(-30 38 30)" />
      </svg>
      {found && (
        <span className="absolute left-1/2 top-full z-20 mt-1 w-max -translate-x-1/2 rounded bg-abyss px-2 py-1 font-mono text-[10px] text-phosphor shadow-lg" role="status">
          {'// the web remembers'}
        </span>
      )}
    </button>
  );
}
