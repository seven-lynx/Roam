'use client';

import { createContext, useContext, type RefObject } from 'react';

export interface WorkstationState {
  /** The scrolling element inside the screen. Pages scroll here, not the window. */
  scrollRef: RefObject<HTMLDivElement | null>;
  /** CRT effects (scanlines, grain, vignette, flashlight). */
  fx: boolean;
  setFx: (on: boolean) => void;
  launcherOpen: boolean;
  setLauncherOpen: (open: boolean) => void;
  feedbackOpen: boolean;
  setFeedbackOpen: (open: boolean) => void;
  /** The scan/compile sequence started by the ROAM key. */
  scanOpen: boolean;
  setScanOpen: (open: boolean) => void;
}

const noop = () => {};

export const WorkstationContext = createContext<WorkstationState>({
  scrollRef: { current: null },
  fx: true,
  setFx: noop,
  launcherOpen: false,
  setLauncherOpen: noop,
  feedbackOpen: false,
  setFeedbackOpen: noop,
  scanOpen: false,
  setScanOpen: noop,
});

export function useWorkstation() {
  return useContext(WorkstationContext);
}
