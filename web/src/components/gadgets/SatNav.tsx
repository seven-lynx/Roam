'use client';

import { useEffect, useRef, useState } from 'react';

/** Sat-nav unit: the readout tracks the cursor as a pair of simulated map coordinates. */
export function SatNav() {
  const [pos, setPos] = useState({ lat: 41.4021, lon: -81.6132 });
  const raf = useRef(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        const lat = 90 - (e.clientY / window.innerHeight) * 180;
        const lon = (e.clientX / window.innerWidth) * 360 - 180;
        setPos({ lat, lon });
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  const fmt = (n: number, p: string, m: string) => `${Math.abs(n).toFixed(3)}°${n >= 0 ? p : m}`;

  return (
    <svg className="gadget" viewBox="0 0 120 100" aria-hidden="true">
      <rect x="4" y="4" width="112" height="92" rx="9" fill="#2a2a22" stroke="#0e0e0b" strokeWidth="2" />
      <rect x="10" y="10" width="100" height="62" rx="4" fill="#102226" stroke="#59b3ae" strokeWidth="1" />
      <g stroke="rgba(89,179,174,.35)" strokeWidth=".7" fill="none">
        <path d="M10 52 Q40 40 60 54 T110 38" />
        <path d="M30 10 Q36 40 26 72" />
        <path d="M78 10 Q70 34 86 72" />
        <circle cx="58" cy="42" r="12" />
      </g>
      <path d="M58 33l4 11-4-2-4 2z" fill="#ff2e88" />
      <text x="14" y="20" fontSize="5.4" fontFamily="monospace" fill="#59b3ae">{fmt(pos.lat, 'N', 'S')}</text>
      <text x="14" y="67" fontSize="5.4" fontFamily="monospace" fill="#59b3ae">{fmt(pos.lon, 'E', 'W')}</text>
      <circle cx="22" cy="84" r="4" fill="#4d4b37" />
      <circle cx="38" cy="84" r="4" fill="#4d4b37" />
      <rect x="62" y="80" width="42" height="8" rx="2" fill="#4d4b37" />
      <text x="83" y="86" textAnchor="middle" fontSize="5" fontFamily="monospace" fill="#cfc9a8">SAT-NAV 2000</text>
    </svg>
  );
}
