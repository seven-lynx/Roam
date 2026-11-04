'use client';

import { createContext, useContext, type RefObject } from 'react';

import type { ArtVariant } from '@/lib/art';
import { ANCHOR_CAMERA } from '@/lib/deck-framing';
import { PROGRAMS, type ProgramId } from '@/lib/os-programs';
import { DEFAULT_SOUND_FX, type SoundEffect } from '@/lib/sfx';

export type WindowId = 'launcher' | 'scan' | 'feedback' | 'terminal' | 'settings' | 'browser' | 'webapp' | 'cyberdeck' | 'deck' | 'info' | 'coffee' | 'roll' | ProgramId;

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
  launcher: { title: 'PROGRAMS', w: 720, h: 360 },
  scan: { title: 'ROAM', w: 760, h: 560, maximized: true },
  feedback: { title: 'COMMS', w: 560, h: 420 },
  terminal: { title: 'TERMINAL', w: 720, h: 300 },
  settings: { title: 'SETTINGS', w: 640, h: 560 },
  browser: { title: 'ROAM', w: 920, h: 620 },
  webapp: { title: 'APP', w: 760, h: 560 },
  cyberdeck: { title: 'CYBERDECK CONTROLS', w: 640, h: 560 },
  deck: { title: 'MOUNT DECK', w: 560, h: 320 },
  info: { title: 'ROAM INFO', w: 720, h: 560 },
  coffee: { title: 'REFUEL', w: 560, h: 320 },
  roll: { title: 'GALLERY', w: 560, h: 640 },
  snake: { title: PROGRAMS.snake.title, w: 560, h: 640 },
  minesweeper: { title: PROGRAMS.minesweeper.title, w: 520, h: 600 },
  tetris: { title: PROGRAMS.tetris.title, w: 420, h: 640 },
  asteroids: { title: PROGRAMS.asteroids.title, w: 560, h: 680 },
  frogger: { title: PROGRAMS.frogger.title, w: 520, h: 660 },
  underweb: { title: PROGRAMS.underweb.title, w: 560, h: 680 },
  substrate: { title: PROGRAMS.substrate.title, w: 620, h: 720 },
};

export const BRIGHTNESS_MIN = 0.35;
export const BRIGHTNESS_MAX = 1.3;

/** Top status-bar height (px) — windows clamp below it. */
export const TOP_BAR_H = 40;
/** Bottom dock height (px) — windows clamp above it. */
export const DOCK_H = 44;
/** Maximum simultaneous windows; the oldest (lowest z) auto-closes past this. */
export const MAX_OPEN_WINDOWS = 5;

/** OS color themes (set via `data-theme` on `.screen`). Each theme recolors the
 *  entire screen — background, panels, borders, accent and phosphor — not just
 *  the text glow. */
export type Theme = 'green' | 'amber' | 'magenta' | 'blue' | 'ice';

export const THEME_PRESETS: { id: Theme; label: string; phosphor: string; accent: string }[] = [
  { id: 'green', label: 'Green', phosphor: '#59b3ae', accent: '#c9a24b' },
  { id: 'amber', label: 'Amber', phosphor: '#e08a4a', accent: '#e0b45f' },
  { id: 'magenta', label: 'Magenta', phosphor: '#ff2e88', accent: '#00e5c3' },
  { id: 'blue', label: 'Blue', phosphor: '#5b8bb0', accent: '#e0b45f' },
  { id: 'ice', label: 'Ice', phosphor: '#bfe3de', accent: '#4f8a8f' },
];

/** Granular CRT display-effect layers, each independently toggleable. The master
 *  `fx` switch still hides the whole overlay set; these gate individual layers. */
export interface DisplayFx {
  scanlines: boolean;
  grille: boolean;
  grain: boolean;
  static: boolean;
  fringe: boolean;
  vignette: boolean;
  flicker: boolean;
  curvature: boolean;
  barrel: boolean;
}

export const DISPLAY_FX_DEFAULTS: DisplayFx = {
  scanlines: true,
  grille: true,
  grain: true,
  static: true,
  fringe: true,
  vignette: true,
  flicker: true,
  curvature: true,
  barrel: true,
};

/** Screen layout: auto-detect the device, or force the handheld (mobile) /
 *  desktop (workstation) shell. */
export type UiMode = 'auto' | 'desktop' | 'handheld';

/** Deck camera framing. Zoom is absolute; pan is an accumulated screen-px offset. */
export interface CameraFraming {
  zoom: number;
  panX: number;
  panY: number;
}

export interface AlertConfirmOptions {
  /** Danger styling (red led + danger button). */
  danger?: boolean;
  /** Label for the confirm button (defaults to "OK"). */
  confirmLabel?: string;
  /** Runs when the operator confirms. */
  onConfirm: () => void;
}

export interface AlertMessage {
  title: string;
  message: string;
  /** When present, renders a two-button confirm layout instead of a single OK. */
  confirm?: AlertConfirmOptions;
}

/**
 * A roam URL loaded into the in-OS browser, together with whatever metadata the
 * opening surface already knew (title, category/subcategory, Wilson score,
 * votes). Missing fields are resolved lazily by `BrowserWindow` via
 * `fetchUrlMeta` and written back with `updateBrowse`.
 */
export interface BrowseTarget {
  url: string;
  title?: string | null;
  domain?: string;
  category?: string | null;
  subcategory?: string | null;
  wilsonScore?: number;
  upvotes?: number;
  downvotes?: number;
  urlId?: string | null;
  /** The signed-in user's current rating for this URL (1 up / -1 down). */
  rated?: 1 | -1 | null;
}

/** An internal roamtheweb.app page opened as an app-style window. */
export interface AppView {
  url: string;
  title: string;
}

/** The four docked desktop widgets that can be toggled in Settings. */
export type WidgetId = 'showcase' | 'rankings' | 'telemetry' | 'deckdiag';

/** Neutral "full deck in frame" zoom the OS treats as normal size. */
export const DEFAULT_ZOOM = 1;
export const CAMERA_ZOOM_MIN = 0.2;
export const CAMERA_ZOOM_MAX = 6;
/** Shipped camera framing = the calibrated deck anchor (screen lines up here). */
export const DEFAULT_CAMERA: CameraFraming = { ...ANCHOR_CAMERA };

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
  /** CRT barrel-warp / curvature amount (0..1), adjustable in Settings. */
  warp: number;
  setWarp: (v: number) => void;
  /** Granular CRT display-effect layers (each independently toggleable). */
  displayFx: DisplayFx;
  setDisplayFx: (patch: Partial<DisplayFx>) => void;
  /** Per-sound-effect toggles (clicks/loading on by default; rest off). */
  soundFx: Record<SoundEffect, boolean>;
  setSoundFx: (name: SoundEffect, on: boolean) => void;
  /** Auto-hide the dock (slide off-screen until hovered). */
  taskbarAutoHide: boolean;
  setTaskbarAutoHide: (on: boolean) => void;
  /** OS screen color theme (recolors the whole screen). */
  theme: Theme;
  setTheme: (t: Theme) => void;
  /** Screen layout mode (auto / desktop / handheld). */
  uiMode: UiMode;
  setUiMode: (mode: UiMode) => void;
  /** Effective handheld (mobile) layout — resolved from uiMode + the device. */
  handheld: boolean;
  /** True once the Spline cyberdeck scene has loaded and bridged. */
  deckReady: boolean;
  setDeckReady: (ready: boolean) => void;
  /** Active photorealistic desk-art variant (A/B asset packs). */
  artVariant: ArtVariant;
  setArtVariant: (v: ArtVariant) => void;
  /** Inspect (orbit) mode — entered only from the Roam-OS UI (dock/launcher/terminal). */
  inspect: boolean;
  setInspect: (on: boolean) => void;
  toggleInspect: () => void;
  /** Deck camera framing (zoom absolute, pan accumulated). */
  camera: CameraFraming;
  setCamera: (f: CameraFraming) => void;
  resetCamera: () => void;
  /** Saved one-click "fit" framing (null until saved). */
  fit: CameraFraming | null;
  saveFit: () => void;
  fitDeck: () => void;
  /** Mute exposed as a plain setter for the terminal (`mute on|off`). */
  setMuted: (m: boolean) => void;
  /** Diegetic OS dialog. */
  alert: AlertMessage | null;
  showAlert: (title: string, message: string) => void;
  showConfirm: (title: string, message: string, confirm: AlertConfirmOptions) => void;
  dismissAlert: () => void;
  /** Restore every OS preference (and the camera) to factory defaults. */
  resetOsSettings: () => void;
  /** Open-window state keyed by window id. */
  windows: Windows;
  isOpen: (id: WindowId) => boolean;
  openWindow: (id: WindowId, title?: string) => void;
  closeWindow: (id: WindowId) => void;
  /** Start-menu launcher dropdown (MENU key / Programs button). */
  launcherOpen: boolean;
  setLauncherOpen: (open: boolean) => void;
  toggleLauncher: () => void;
  /** Android-style all-apps drawer (searchable tile grid, handheld). */
  appDrawerOpen: boolean;
  setAppDrawerOpen: (open: boolean) => void;
  toggleAppDrawer: () => void;
  /** Swipe-down quick-settings sheet (handheld). */
  quickSettingsOpen: boolean;
  setQuickSettingsOpen: (open: boolean) => void;
  toggleQuickSettings: () => void;
  minimizeWindow: (id: WindowId) => void;
  toggleMaximize: (id: WindowId) => void;
  focusWindow: (id: WindowId) => void;
  moveWindow: (id: WindowId, rect: WindowRect) => void;
  /** Minimize/restore every open window (the \"show desktop\" toggle). */
  minimizeAll: () => void;
  restoreAll: () => void;
  /** Deck view: show the 3D cyberdeck (the OS sits on its screen quad). */
  deckMode: boolean;
  setDeckMode: (on: boolean) => void;
  /** Whether the Spline deck scene should be fetched and mounted. */
  deckRequested: boolean;
  setDeckRequested: (on: boolean) => void;
  /** Open the "MOUNT DECK" launcher window and begin loading the scene. */
  openDeckLauncher: () => void;
  /** Deck scene load progress (0..1), reported by SplineScene. */
  deckProgress: number;
  setDeckProgress: (n: number) => void;
  /** The roam URL currently loaded in the in-OS browser window. */
  browse: BrowseTarget | null;
  /** Open a roam URL inside the OS browser window. */
  openUrl: (target: BrowseTarget) => void;
  /** Update the browse target in place (enrichment + rating feedback). */
  updateBrowse: (target: BrowseTarget) => void;
  /** Close the browser window and clear the current browse target. */
  closeBrowse: () => void;
  /** Internal roamtheweb.app page currently open in the app-style window. */
  appView: AppView | null;
  /** Open an internal route as an app-style window (with OS chrome). */
  openAppView: (url: string, title: string) => void;
  /** Close the app-style window and clear the current app view. */
  closeAppView: () => void;
  /** Per-widget visibility toggles for the desktop widgets. */
  widgets: Record<WidgetId, boolean>;
  /** Toggle a desktop widget on/off (persisted). */
  toggleWidget: (id: WidgetId) => void;
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
  brightness: BRIGHTNESS_MAX,
  setBrightness: noop,
  warp: 0.1,
  setWarp: noop,
  displayFx: { ...DISPLAY_FX_DEFAULTS },
  setDisplayFx: noop,
  soundFx: { ...DEFAULT_SOUND_FX },
  setSoundFx: noop,
  taskbarAutoHide: false,
  setTaskbarAutoHide: noop,
  theme: 'green',
  setTheme: noop,
  uiMode: 'auto',
  setUiMode: noop,
  handheld: false,
  deckReady: false,
  setDeckReady: noop,
  artVariant: 'a',
  setArtVariant: noop,
  inspect: false,
  setInspect: noop,
  toggleInspect: noop,
  camera: DEFAULT_CAMERA,
  setCamera: noop,
  resetCamera: noop,
  fit: null,
  saveFit: noop,
  fitDeck: noop,
  setMuted: noop,
  alert: null,
  showAlert: noop,
  showConfirm: noop,
  dismissAlert: noop,
  resetOsSettings: noop,
  windows: {},
  isOpen: () => false,
  openWindow: noop,
  closeWindow: noop,
  launcherOpen: false,
  setLauncherOpen: noop,
  toggleLauncher: noop,
  appDrawerOpen: false,
  setAppDrawerOpen: noop,
  toggleAppDrawer: noop,
  quickSettingsOpen: false,
  setQuickSettingsOpen: noop,
  toggleQuickSettings: noop,
  minimizeWindow: noop,
  toggleMaximize: noop,
  focusWindow: noop,
  moveWindow: noop,
  minimizeAll: noop,
  restoreAll: noop,
  deckMode: false,
  setDeckMode: noop,
  deckRequested: false,
  setDeckRequested: noop,
  openDeckLauncher: noop,
  deckProgress: 0,
  setDeckProgress: noop,
  browse: null,
  openUrl: noop,
  updateBrowse: noop,
  closeBrowse: noop,
  appView: null,
  openAppView: noop,
  closeAppView: noop,
  widgets: { showcase: true, rankings: true, telemetry: true, deckdiag: true },
  toggleWidget: noop,
};

export const WorkstationContext = createContext<WorkstationState>(DEFAULT_WORKSTATION);

export function useWorkstation() {
  return useContext(WorkstationContext);
}