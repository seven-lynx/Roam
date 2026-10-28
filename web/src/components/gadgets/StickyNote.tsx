'use client';

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { rotationFor } from '@/lib/desk-layout';

const COLORS = {
  yellow: 'linear-gradient(180deg, #f0e08a, #e2cf6a)',
  pink: 'linear-gradient(180deg, #f7b7cf, #ec97b6)',
  cream: 'linear-gradient(180deg, #efe9cf, #ddd5b3)',
  mint: 'linear-gradient(180deg, #b9e0cf, #9ccbb6)',
} as const;

/**
 * Handwritten sticky note. Drag it anywhere with the pointer, or focus it and
 * use the arrow keys (Shift for bigger steps). It stays where you drop it;
 * position is local UI state and resets on reload by design.
 */
export function StickyNote({
  id,
  text,
  color = 'yellow',
  maxTilt = 5,
}: {
  id: string;
  text: string;
  color?: keyof typeof COLORS;
  maxTilt?: number;
}) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const start = useRef({ px: 0, py: 0, x: 0, y: 0 });

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y };
    setDragging(true);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setPos({ x: start.current.x + e.clientX - start.current.px, y: start.current.y + e.clientY - start.current.py });
  };
  const onUp = () => setDragging(false);

  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 24 : 8;
    const d: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    const delta = d[e.key];
    if (!delta) return;
    e.preventDefault();
    setPos((p) => ({ x: p.x + delta[0], y: p.y + delta[1] }));
  };

  return (
    <div
      role="note"
      tabIndex={0}
      aria-label={`Sticky note: ${text}. Drag, or use arrow keys, to move.`}
      className="tape relative w-full touch-none select-none px-2.5 pb-3 pt-4 font-hand text-[clamp(0.8rem,1.15vw,1.05rem)] leading-tight text-[#2b2a1d] shadow-[0_6px_10px_rgba(0,0,0,0.5)]"
      style={{
        background: COLORS[color],
        transform: `translate(${pos.x}px, ${pos.y}px) rotate(${rotationFor(id, maxTilt)}deg)`,
        cursor: dragging ? 'grabbing' : 'grab',
        zIndex: dragging ? 30 : 1,
      }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onKeyDown={onKey}
    >
      {text}
    </div>
  );
}
