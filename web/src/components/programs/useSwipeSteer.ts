'use client';

import { useEffect, useRef, type PointerEvent } from 'react';
import { resolveSteer, type Steer } from '@/lib/steer';

/**
 * Pointer swipe handlers for four-way steering surfaces. Attach the returned
 * props to an element; `onSteer` fires once per completed swipe with the
 * resolved direction (never on a tap or a below-threshold drag). The callback
 * is read through a ref so it always closes over the latest game state.
 */
export function useSwipeSteer(onSteer: (s: Steer) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const onSteerRef = useRef(onSteer);
  useEffect(() => {
    onSteerRef.current = onSteer;
  });

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    start.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const d = resolveSteer(e.clientX - s.x, e.clientY - s.y);
    if (d) onSteerRef.current(d);
  };
  const onPointerCancel = () => {
    start.current = null;
  };

  return { onPointerDown, onPointerUp, onPointerCancel };
}