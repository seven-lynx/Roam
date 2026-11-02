'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Scales a fixed-size child (a game board/canvas with a known natural width and
 * height) to fill its container — up when the window is maximised, down on small
 * screens — while keeping it centred. `transform: scale()` keeps hit-testing
 * accurate, so the game's own pointer handling still works.
 */
export function ScaleToFit({
  width,
  height,
  maxScale = 3,
  children,
}: {
  width: number;
  height: number;
  maxScale?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      const pad = 8;
      const availW = Math.max(0, r.width - pad);
      const availH = Math.max(0, r.height - pad);
      const s = Math.min(availW / width, availH / height);
      setScale(Math.max(0.35, Math.min(maxScale, s)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height, maxScale]);

  return (
    <div
      ref={ref}
      style={{
        flex: '1 1 auto',
        minHeight: 0,
        minWidth: 0,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center', flex: '0 0 auto' }}>
        {children}
      </div>
    </div>
  );
}
