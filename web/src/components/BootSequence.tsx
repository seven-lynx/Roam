'use client';

import { useEffect, useState } from 'react';

/**
 * One-time CRT power-on intro. Skippable and disabled for reduced-motion
 * users; shows only on the first page of a session.
 */
export function BootSequence() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('roam-booted')) return;
      sessionStorage.setItem('roam-booted', '1');
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      setVisible(true);
      const fade = setTimeout(() => setFading(true), 1100);
      const hide = setTimeout(() => setVisible(false), 1500);
      return () => {
        clearTimeout(fade);
        clearTimeout(hide);
      };
    } catch {
      /* sessionStorage unavailable — skip intro */
    }
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => setVisible(false)}
      aria-label="Skip intro"
      className={`absolute inset-0 z-[80] flex cursor-pointer flex-col items-center justify-center gap-3 bg-abyss font-mono text-muted-bright transition-opacity duration-500 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <span className="boot-line font-pixel text-2xl tracking-[0.35em]">ROAM</span>
      <span className="boot-line text-xs tracking-[0.2em] text-fog" style={{ animationDelay: '150ms' }}>
        ESTABLISHING LINK…
      </span>
      <span className="boot-line text-[10px] text-fog" style={{ animationDelay: '300ms' }}>
        scan protocol v2.6
      </span>
    </button>
  );
}
