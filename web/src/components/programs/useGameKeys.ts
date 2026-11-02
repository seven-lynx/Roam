'use client';

import { useEffect, useRef } from 'react';
import { useWorkstation, type WindowId } from '@/components/WorkstationContext';

/**
 * Global keyboard capture scoped to the topmost open window.
 *
 * A game attaches this once; key events only reach it while its own window is
 * on top, so a background program never fights the foreground window (or the
 * page) for arrows/space. Callbacks are read through refs, so they can close
 * over the latest state without re-subscribing on every render.
 */
export function useGameKeys(
  id: WindowId,
  onKeyDown: (e: KeyboardEvent) => void,
  onKeyUp?: (e: KeyboardEvent) => void,
): void {
  const { windows } = useWorkstation();

  const downRef = useRef(onKeyDown);
  const upRef = useRef(onKeyUp);
  const windowsRef = useRef(windows);

  // Keep the latest callbacks/state reachable without re-subscribing the
  // global listeners on every render.
  useEffect(() => {
    downRef.current = onKeyDown;
    upRef.current = onKeyUp;
    windowsRef.current = windows;
  });

  useEffect(() => {
    const isTop = () => {
      const ws = windowsRef.current;
      const z = ws[id]?.z ?? -1;
      const topZ = Object.values(ws).reduce((m, w) => Math.max(m, w?.z ?? -1), -1);
      return z >= 0 && z === topZ;
    };

    const onDown = (e: KeyboardEvent) => {
      if (!isTop()) return;
      downRef.current(e);
    };
    const onUp = (e: KeyboardEvent) => {
      if (!isTop()) return;
      upRef.current?.(e);
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [id]);
}
