'use client';

import { createContext, useContext } from 'react';
import type { WebappTheme } from '@/components/WorkstationContext';

/**
 * Which whole-app shell is mounted: the ROAM-OS cyberdeck desktop, or the
 * original standalone "Roam Classic" web-app shell. This context lives ABOVE
 * both shells (provided by EmbedGate) so the OS StatusBar button and the
 * Classic header can both switch it, and it persists to localStorage under
 * `roam-webapp-theme` (the same key the old classic skin used).
 */
export interface ShellMode {
  mode: WebappTheme;
  setMode: (m: WebappTheme) => void;
}

export const ShellModeContext = createContext<ShellMode>({
  mode: 'roam-os',
  setMode: () => {},
});

export function useShellMode() {
  return useContext(ShellModeContext);
}
