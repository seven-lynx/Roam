'use client';

import { useEffect, useRef, useState } from 'react';
import { useWorkstation } from '@/components/WorkstationContext';
import { deskArt } from '@/lib/art';

/**
 * Brass compass whose needle points at the cursor. Clicking it reveals a
 * short hidden message (an easter egg).
 */
export function Compass() {
  const { artVariant } = useWorkstation();
  const needle = useRef<HTMLSpanElement>(null);
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
      <img src={deskArt('compass', artVariant)} alt="" className="art-img" draggable={false} />
      <span ref={needle} className="compass-needle" aria-hidden="true" style={{ transition: 'transform .15s ease-out' }} />
      {found && (
        <span className="absolute left-1/2 top-full z-20 mt-1 w-max -translate-x-1/2 rounded bg-abyss px-2 py-1 font-mono text-[10px] text-phosphor shadow-lg" role="status">
          {'// the web remembers'}
        </span>
      )}
    </button>
  );
}
