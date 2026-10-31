'use client';

import { createContext, useContext, type RefObject } from 'react';

import type { ArtVariant } from '@/lib/art';

export type WindowId = 'launcher' | 'scan' | 'feedback' | 'terminal';

export interface WindowRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WindowView {
  title: string;
  minimized: boolean;
  maximized: boolean;
  rect: WindowRect;
  z: number;
}

export type Windows = Partial<Record<WindowId, WindowView>>;

/** Default title + size for each window. `maximized` windows open full-screen. */
export const WINDOW_DEFAULTS: Record<
  WindowId,
  { title: string; w: number; h: number; maximized?: boolean }
> = {
  launcher: { title: 'PROGRAMS', w: 620, h: 480 },
  scan: { title: 'ROAM', w: 760, h: 560, maximized: true },
  feedback: { title: 'COMMS', w: 460, h: 560 },
  terminal: { title: 'TERMINAL', w: 640, h: 420 },
};

export const BRIGHTNESS_MIN = 0.35;
export const BRIGHTNESS_MAX = 1.3;

export interface WorkstationState {
  /** The scrolling element inside the screen. Pages scroll here, not the window. */
  scrollRef: RefObject<HTMLDivElement | null>;
  /** The `.screen` element (windows are positioned/clamped against it). */
  screenRef: RefObject<HTMLDivElement | null>;
  /** CRT effects (scanlines, grain, vignette, flashlight). */
  fx: boolean;
  setFx: (on: boolean) => void;
  /** Master sound toggle (on after first gesture). */
  sound: boolean;
  setSound: (on: boolean) => void;
  /** Master volume 0..1, driven by the rotary VOL knob. */
  volume: number;
  setVolume: (v: number) => void;
  muted: boolean;
  toggleMute: () => void;
  /** CRT intensity multiplier, driven by the rotary BRT knob. */
  brightness: number;
  setBrightness: (v: number) => void;
  /** Active photorealistic desk-art variant (A/B asset packs). */
  artVariant: ArtVariant;
  setArtVariant: (v: ArtVariant) => void;
  /** Open-window state keyed by window id. */
  windows: Windows;
  isOpen: (id: WindowId) => boolean;
  openWindow: (id: WindowId) => void;
  closeWindow: (id: WindowId) => void;
  minimizeWindow: (id: WindowId) => void;
  toggleMaximize: (id: WindowId) => void;
  focusWindow: (id: WindowId) => void;
  moveWindow: (id: WindowId, rect: WindowRect) => void;
}

const noop = () => {};

const DEFAULT_WORKSTATION: WorkstationState = {
  scrollRef: { current: null },
  screenRef: { current: null },
  fx: true,
  setFx: noop,
  sound: true,
  setSound: noop,
  volume: 0.7,
  setVolume: noop,
  muted: false,
  toggleMute: noop,
  brightness: 1,
  setBrightness: noop,
  artVariant: 'a',
  setArtVariant: noop,
  windows: {},
  isOpen: () => false,
  openWindow: noop,
  closeWindow: noop,
  minimizeWindow: noop,
  toggleMaximize: noop,
  focusWindow: noop,
  moveWindow: noop,
};

export const WorkstationContext = createContext<WorkstationState>(DEFAULT_WORKSTATION);

export function useWorkstation() {
  return useContext(WorkstationContext);
}