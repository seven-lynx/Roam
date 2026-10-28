'use client';

import { useEffect, useRef } from 'react';

/**
 * Ambient "flashlight" glow that follows the pointer across the screen.
 * Coordinates are relative to the screen, so it stays aligned wherever the
 * device sits in the window. Disabled for users who prefer reduced motion.
 */
export function FlashlightCursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = ref.current;
    const screen = el?.parentElement;
    if (!el || !screen) return;

    const onMove = (e: PointerEvent) => {
      const rect = screen.getBoundingClientRect();
      el.style.setProperty('--fx', `${e.clientX - rect.left}px`);
      el.style.setProperty('--fy', `${e.clientY - rect.top}px`);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="crt-layer pointer-events-none absolute inset-0 z-[44] mix-blend-screen"
      style={{
        background:
          'radial-gradient(380px 380px at var(--fx, 50%) var(--fy, 40%), var(--phosphor-glow), transparent 70%)',
      }}
    />
  );
}
