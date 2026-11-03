'use client';

import { useCallback, useState } from 'react';

/** On-screen control scheme for the action games. */
export type ControlMode = 'dpad' | 'stick';

function readMode(key: string): ControlMode {
  if (typeof window === 'undefined') return 'dpad';
  return window.localStorage.getItem(key) === 'stick' ? 'stick' : 'dpad';
}

/**
 * A persisted D-PAD ⇄ STICK toggle for a single game. `key` is a
 * `localStorage` slot (e.g. `roam-snake-control`); the default is `dpad`.
 */
export function useControlMode(key: string): { mode: ControlMode; toggle: () => void } {
  const [mode, setMode] = useState<ControlMode>(() => readMode(key));

  const toggle = useCallback(() => {
    setMode((m) => {
      const next = m === 'dpad' ? 'stick' : 'dpad';
      window.localStorage.setItem(key, next);
      return next;
    });
  }, [key]);

  return { mode, toggle };
}