'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import {
  WorkstationContext,
  WINDOW_DEFAULTS,
  BRIGHTNESS_MIN,
  BRIGHTNESS_MAX,
  TOP_BAR_H,
  DOCK_H,
  MAX_OPEN_WINDOWS,
  DEFAULT_CAMERA,
  CAMERA_ZOOM_MIN,
  CAMERA_ZOOM_MAX,
  THEME_PRESETS,
  DISPLAY_FX_DEFAULTS,
  type DisplayFx,
  type Windows,
  type WindowId,
  type WindowRect,
  type CameraFraming,
  type Theme,
  type UiMode,
  type AlertMessage,
  type AlertConfirmOptions,
  type BrowseTarget,
} from '@/components/WorkstationContext';
import { useIsMobile } from '@/lib/hooks';
import { StatusBar } from '@/components/StatusBar';
import { Launcher } from '@/components/Launcher';
import { AppDrawer } from '@/components/AppDrawer';
import { QuickSettings } from '@/components/QuickSettings';
import FeedbackWidget from '@/components/FeedbackWidget';
import { ScanSequence } from '@/components/ScanSequence';
import { Terminal } from '@/components/Terminal';
import { Dock } from '@/components/Dock';
import { GestureLayer } from '@/components/GestureLayer';
import { AlertDialog } from '@/components/AlertDialog';
import { setSfxVolume, setSfxMuted, setSfxEnabled, setSfxEffect, unlockAudio, startAmbient, SOUND_EFFECTS, DEFAULT_SOUND_FX, type SoundEffect } from '@/lib/sfx';
import { Cyberdeck3D } from '@/components/Cyberdeck3D';
import { Desktop } from '@/components/Desktop';
import { SettingsApp } from '@/components/SettingsApp';
import { CyberdeckControls } from '@/components/CyberdeckControls';
import { BrowserWindow } from '@/components/BrowserWindow';
import { DeckLauncher } from '@/components/DeckLauncher';
import { RoamInfo } from '@/components/RoamInfo';
import { CoffeeApp } from '@/components/CoffeeApp';
import { CameraRollProgram } from '@/components/programs/CameraRollProgram';
import { SnakeProgram } from '@/components/programs/SnakeProgram';
import { MinesweeperProgram } from '@/components/programs/MinesweeperProgram';
import { TetrisProgram } from '@/components/programs/TetrisProgram';
import { AsteroidsProgram } from '@/components/programs/AsteroidsProgram';
import { FroggerProgram } from '@/components/programs/FroggerProgram';
import { UnderwebProgram } from '@/components/programs/UnderwebProgram';
import { SubstrateProgram } from '@/components/programs/SubstrateProgram';
import { DECK_VERSION } from '@/lib/deck-framing';
import { resetWallpaper } from '@/lib/wallpaper';
import type { ArtVariant } from '@/lib/art';

const FX_KEY = 'roam-fx';
const DISPLAY_FX_KEY = 'roam-display-fx';
const SOUND_FX_KEY = 'roam-sound-fx';
const SOUND_KEY = 'roam-sound';
const VOL_KEY = 'roam-vol';
const MUTED_KEY = 'roam-muted';
const BRIGHT_KEY = 'roam-bright';
const ART_KEY = 'roam-art';
const WARP_KEY = 'roam-warp';
const AUTOHIDE_KEY = 'roam-autohide';
const THEME_KEY = 'roam-theme';
const UI_MODE_KEY = 'roam-ui-mode';
const CAMERA_ZOOM_KEY = 'roam-deck-zoom';
const CAMERA_PAN_KEY = 'roam-deck-pan';
const CAMERA_FIT_KEY = 'roam-deck-fit';
const WINDOW_LAYOUT_KEY = 'roam-window-layout';
const DECK_VERSION_KEY = 'roam-deck-version';

// ── CRT barrel distortion ───────────────────────────────────────────────
// Real geometric barrel warp via feDisplacementMap, ported from the Android
// `CrtOverlay` AGSL shader:
//     warped = center + d * (1 + amount * r2)
// where d is the offset from the screen centre and r2 = dot(d, d). That *radial*
// formula bows both axes outward (a true fisheye) rather than the old separable
// cubic ramp, which was effectively an anamorphic zoom — too subtle to notice.
// The map bakes the shape (amount = 1) into a single 256×256 PNG — R channel =
// horizontal displacement, G channel = vertical — with #808080 at the centre and
// full deflection at the corners. `feDisplacementMap` samples source at
// `coord + scale*(channel - 0.5)`, so each channel stores `d * r2` (max 0.25 at
// the corners) scaled to the full 0..255 range. The filter runs in
// objectBoundingBox units, so `scale` is a fraction of the screen size and
// follows the warp slider to match Android's amount (0 … 0.70).
const BARREL_MAP_SIZE = 256;
// Android's `CrtOverlay` tops out at (fisheye - 1) / 9 * 0.70 → 0.70 at max dial.
const BARREL_AMOUNT_MAX = 0.7;
// Channel swing ÷ normalised displacement (508 / 255 ≈ 1.992): the corner
// displacement (d·r2 = 0.25) maps to the full 0..255 channel range, so
// scale = amount / gain reproduces the shader's displacement exactly.
const BARREL_MAP_GAIN = 508 / 255;
let barrelMapCache: string | null = null;

function getBarrelMap(): string {
  if (barrelMapCache) return barrelMapCache;
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = BARREL_MAP_SIZE;
  canvas.height = BARREL_MAP_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(BARREL_MAP_SIZE, BARREL_MAP_SIZE);
  // Radial displacement: R = dx·r2, G = dy·r2, normalised to the full channel
  // range (neutral #808080 at the centre, ±127 at the corners).
  const K = 127 / 0.25; // 508
  for (let y = 0; y < BARREL_MAP_SIZE; y++) {
    for (let x = 0; x < BARREL_MAP_SIZE; x++) {
      const tx = x / (BARREL_MAP_SIZE - 1);
      const ty = y / (BARREL_MAP_SIZE - 1);
      const dx = tx - 0.5;
      const dy = ty - 0.5;
      const r2 = dx * dx + dy * dy;
      const sx = dx * r2; // radial x displacement (normalised)
      const sy = dy * r2; // radial y displacement (normalised)
      const i = (y * BARREL_MAP_SIZE + x) * 4;
      img.data[i] = Math.max(0, Math.min(255, Math.round(128 + sx * K))); // R → horizontal
      img.data[i + 1] = Math.max(0, Math.min(255, Math.round(128 + sy * K))); // G → vertical
      img.data[i + 2] = 128; // B unused by the displacement map
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  barrelMapCache = canvas.toDataURL('image/png');
  return barrelMapCache;
}

const clampZoom = (n: number) => Math.min(CAMERA_ZOOM_MAX, Math.max(CAMERA_ZOOM_MIN, n));

function parseCamera(rawZoom: string | null, rawPan: string | null): CameraFraming {
  const cam: CameraFraming = { ...DEFAULT_CAMERA };
  if (rawZoom !== null) {
    const z = Number(rawZoom);
    if (Number.isFinite(z)) cam.zoom = clampZoom(z);
  }
  if (rawPan !== null) {
    try {
      const parsed = JSON.parse(rawPan) as { x?: unknown; y?: unknown };
      if (typeof parsed.x === 'number' && Number.isFinite(parsed.x)) cam.panX = parsed.x;
      if (typeof parsed.y === 'number' && Number.isFinite(parsed.y)) cam.panY = parsed.y;
    } catch {
      /* corrupt pan: keep default */
    }
  }
  return cam;
}

/**
 * The device. Everything the site shows renders on `.screen`; the window itself
 * never scrolls. Owns the global workstation state: sound, volume, CRT
 * brightness, effects, and the window manager (open/minimize/maximize/drag).
 */
export function WorkstationShell({
  children,
  overlays,
}: {
  children: ReactNode;
  overlays?: ReactNode;
}) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const scrollRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);

  const [fx, setFxState] = useState(true);
  const [sound, setSoundState] = useState(true);
  const [volume, setVolumeState] = useState(0.7);
  const [muted, setMutedState] = useState(false);
  const [brightness, setBrightnessState] = useState(1);
  const [warp, setWarpState] = useState(0.7);
  const [displayFx, setDisplayFxState] = useState<DisplayFx>({ ...DISPLAY_FX_DEFAULTS });
  const [soundFx, setSoundFxState] = useState<Record<SoundEffect, boolean>>({ ...DEFAULT_SOUND_FX });
  const [barrelMap, setBarrelMap] = useState('');
  const [taskbarAutoHide, setTaskbarAutoHideState] = useState(false);
  const [theme, setThemeState] = useState<Theme>('green');
  const [uiMode, setUiModeState] = useState<UiMode>('auto');
  const [launcherOpen, setLauncherOpenState] = useState(false);
  const [appDrawerOpen, setAppDrawerOpenState] = useState(false);
  const [quickSettingsOpen, setQuickSettingsOpenState] = useState(false);
  const [artVariant, setArtVariantState] = useState<ArtVariant>('a');
  const [inspect, setInspectState] = useState(false);
  const [camera, setCameraState] = useState<CameraFraming>(DEFAULT_CAMERA);
  const [fit, setFitState] = useState<CameraFraming | null>(null);
  const [alert, setAlertState] = useState<AlertMessage | null>(null);
  const [windows, setWindows] = useState<Windows>({});
  const [deckMode, setDeckModeState] = useState(false);
  const [deckRequested, setDeckRequestedState] = useState(false);
  const [deckProgress, setDeckProgressState] = useState(0);
  const [deckReady, setDeckReadyState] = useState(false);
  const [browse, setBrowseState] = useState<BrowseTarget | null>(null);
  const zRef = useRef(0);
  // Effective handheld (mobile) layout — forced via the Settings toggle, or
  // auto-detected from the viewport.
  const handheld = uiMode === 'handheld' || (uiMode === 'auto' && isMobile);

  // The CRT barrel warp (curved-glass effect) is meaningless on a palm-top:
  // disable it whenever the handheld layout is active.
  useEffect(() => {
    if (handheld) setWarpState(0);
  }, [handheld]);

  // Saved window geometry (rect + maximized), restored when a window opens.
  const layoutRef = useRef<Partial<Record<WindowId, { rect: WindowRect; maximized: boolean }>>>({});

  // Bake the barrel displacement map client-side (canvas is unavailable during SSR).
  useEffect(() => {
    setBarrelMap(getBarrelMap());
  }, []);

  // Restore persisted preferences once on mount.
  useEffect(() => {
    try {
      // A new scene export invalidates any camera/fit/deck state saved for
      // a previous export (its anchor + framing don't apply). Clear those keys on
      // version change so the deck starts from a clean, auto-fitted default.
      if (localStorage.getItem(DECK_VERSION_KEY) !== DECK_VERSION) {
        [CAMERA_ZOOM_KEY, CAMERA_PAN_KEY, CAMERA_FIT_KEY].forEach((k) =>
          localStorage.removeItem(k),
        );
        localStorage.setItem(DECK_VERSION_KEY, DECK_VERSION);
      }

      if (localStorage.getItem(FX_KEY) === 'off') setFxState(false);
      if (localStorage.getItem(SOUND_KEY) === 'off') setSoundState(false);
      if (localStorage.getItem(MUTED_KEY) === '1') setMutedState(true);
      const rawDisplayFx = localStorage.getItem(DISPLAY_FX_KEY);
      if (rawDisplayFx) {
        try {
          const parsed = JSON.parse(rawDisplayFx) as Partial<DisplayFx>;
          setDisplayFxState((prev) => ({ ...prev, ...parsed }));
        } catch {
          /* corrupt display FX: keep defaults */
        }
      }
      const rawSoundFx = localStorage.getItem(SOUND_FX_KEY);
      if (rawSoundFx) {
        try {
          const parsed = JSON.parse(rawSoundFx) as Partial<Record<SoundEffect, boolean>>;
          setSoundFxState((prev) => ({ ...prev, ...parsed }));
        } catch {
          /* corrupt sound FX: keep defaults */
        }
      }
      // `Number(null)` is 0, so only parse a key that actually exists — otherwise a
      // fresh visitor would get volume 0 and brightness clamped to its minimum.
      const rawVol = localStorage.getItem(VOL_KEY);
      if (rawVol !== null) {
        const v = Number(rawVol);
        if (Number.isFinite(v)) setVolumeState(Math.min(1, Math.max(0, v)));
      }
      const rawBright = localStorage.getItem(BRIGHT_KEY);
      if (rawBright !== null) {
        const b = Number(rawBright);
        if (Number.isFinite(b)) setBrightnessState(Math.min(BRIGHTNESS_MAX, Math.max(BRIGHTNESS_MIN, b)));
      }
      const rawWarp = localStorage.getItem(WARP_KEY);
      if (rawWarp !== null) {
        const w = Number(rawWarp);
        if (Number.isFinite(w)) setWarpState(Math.min(1, Math.max(0, w)));
      }
      const a = localStorage.getItem(ART_KEY);
      if (a === 'b') setArtVariantState('b');
      const rawTheme = localStorage.getItem(THEME_KEY) ?? localStorage.getItem('roam-phosphor');
      if (rawTheme && THEME_PRESETS.some((p) => p.id === rawTheme)) setThemeState(rawTheme as Theme);
      if (localStorage.getItem(AUTOHIDE_KEY) === '1') setTaskbarAutoHideState(true);
      const rawUiMode = localStorage.getItem(UI_MODE_KEY);
      if (rawUiMode === 'desktop' || rawUiMode === 'handheld') setUiModeState(rawUiMode);

      // Restore saved window geometry (rect + maximized) — applied when windows open.
      try {
        const rawLayout = localStorage.getItem(WINDOW_LAYOUT_KEY);
        if (rawLayout) {
          const parsed = JSON.parse(rawLayout) as Partial<Record<WindowId, { rect: WindowRect; maximized: boolean }>>;
          if (parsed && typeof parsed === 'object') layoutRef.current = parsed;
        }
      } catch {
        /* corrupt layout: keep defaults */
      }

      // Restore the calibrated deck camera framing + saved fit (moved here from
      // Cyberdeck3D so the OS — and the terminal — can read and drive it).
      setCameraState(parseCamera(localStorage.getItem(CAMERA_ZOOM_KEY), localStorage.getItem(CAMERA_PAN_KEY)));
      const rawFit = localStorage.getItem(CAMERA_FIT_KEY);
      if (rawFit !== null) {
        try {
          const parsed = JSON.parse(rawFit) as { zoom?: unknown; panX?: unknown; panY?: unknown };
          if (
            typeof parsed.zoom === 'number' && Number.isFinite(parsed.zoom) &&
            typeof parsed.panX === 'number' && Number.isFinite(parsed.panX) &&
            typeof parsed.panY === 'number' && Number.isFinite(parsed.panY)
          ) {
            setFitState({ zoom: clampZoom(parsed.zoom), panX: parsed.panX, panY: parsed.panY });
          }
        } catch {
          /* corrupt fit: keep none */
        }
      }
    } catch {
      /* storage unavailable: keep defaults */
    }
  }, []);

  const persistLayout = useCallback((id: WindowId, rect: WindowRect, maximized: boolean) => {
    layoutRef.current = { ...layoutRef.current, [id]: { rect, maximized } };
    try { localStorage.setItem(WINDOW_LAYOUT_KEY, JSON.stringify(layoutRef.current)); } catch { /* ignore */ }
  }, []);

  const setFx = useCallback((on: boolean) => {
    setFxState(on);
    try { localStorage.setItem(FX_KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
  }, []);

  const setSound = useCallback((on: boolean) => {
    setSoundState(on);
    try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
  }, []);

  const setVolume = useCallback((v: number) => {
    const c = Math.min(1, Math.max(0, v));
    setVolumeState(c);
    try { localStorage.setItem(VOL_KEY, String(c)); } catch { /* ignore */ }
  }, []);

  const toggleMute = useCallback(() => {
    setMutedState((m) => {
      const n = !m;
      try { localStorage.setItem(MUTED_KEY, n ? '1' : ''); } catch { /* ignore */ }
      return n;
    });
  }, []);

  const setMuted = useCallback((m: boolean) => {
    setMutedState(m);
    try { localStorage.setItem(MUTED_KEY, m ? '1' : ''); } catch { /* ignore */ }
  }, []);

  const setBrightness = useCallback((v: number) => {
    const c = Math.min(BRIGHTNESS_MAX, Math.max(BRIGHTNESS_MIN, v));
    setBrightnessState(c);
    try { localStorage.setItem(BRIGHT_KEY, String(c)); } catch { /* ignore */ }
  }, []);

  const setWarp = useCallback((v: number) => {
    const c = Math.min(1, Math.max(0, v));
    setWarpState(c);
    try { localStorage.setItem(WARP_KEY, String(c)); } catch { /* ignore */ }
  }, []);

  const setDisplayFx = useCallback((patch: Partial<DisplayFx>) => {
    setDisplayFxState((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(DISPLAY_FX_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const setSoundFx = useCallback((name: SoundEffect, on: boolean) => {
    setSoundFxState((prev) => {
      const next = { ...prev, [name]: on };
      try { localStorage.setItem(SOUND_FX_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    setSfxEffect(name, on);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem(THEME_KEY, t); } catch { /* ignore */ }
  }, []);

  const setTaskbarAutoHide = useCallback((on: boolean) => {
    setTaskbarAutoHideState(on);
    try { localStorage.setItem(AUTOHIDE_KEY, on ? '1' : '0'); } catch { /* ignore */ }
  }, []);

  const setUiMode = useCallback((mode: UiMode) => {
    setUiModeState(mode);
    try { localStorage.setItem(UI_MODE_KEY, mode); } catch { /* ignore */ }
  }, []);

  const setArtVariant = useCallback((v: ArtVariant) => {
    setArtVariantState(v);
    try { localStorage.setItem(ART_KEY, v); } catch { /* ignore */ }
  }, []);

  // ── Inspect + camera ──────────────────────────────────────────
  const setInspect = useCallback((on: boolean) => setInspectState(on), []);
  const toggleInspect = useCallback(() => setInspectState((v) => !v), []);

  const setCamera = useCallback((f: CameraFraming) => {
    const next = { zoom: clampZoom(f.zoom), panX: f.panX, panY: f.panY };
    setCameraState(next);
    try { localStorage.setItem(CAMERA_ZOOM_KEY, String(next.zoom)); } catch { /* ignore */ }
    try { localStorage.setItem(CAMERA_PAN_KEY, JSON.stringify({ x: next.panX, y: next.panY })); } catch { /* ignore */ }
  }, []);

  const resetCamera = useCallback(() => setCamera(DEFAULT_CAMERA), [setCamera]);

  const saveFit = useCallback(() => {
    setFitState(camera);
    try { localStorage.setItem(CAMERA_FIT_KEY, JSON.stringify(camera)); } catch { /* ignore */ }
  }, [camera]);

  const fitDeck = useCallback(() => {
    setCamera(fit ?? DEFAULT_CAMERA);
  }, [fit, setCamera]);

  // ── Deck mode ──────────────────────────────────────────────────────────────
  const setDeckMode = useCallback((on: boolean) => {
    // Entering deck view always requests (and, if needed, mounts) the 3D scene —
    // otherwise toggles in Settings/Terminal would flip the flag with nothing to show.
    if (on) setDeckRequestedState(true);
    setDeckModeState(on);
  }, []);
  const setDeckRequested = useCallback((on: boolean) => setDeckRequestedState(on), []);
  const setDeckProgress = useCallback((n: number) => setDeckProgressState(n), []);

  const setDeckReady = useCallback((ready: boolean) => setDeckReadyState(ready), []);

  const setLauncherOpen = useCallback((open: boolean) => setLauncherOpenState(open), []);
  const toggleLauncher = useCallback(() => setLauncherOpenState((v) => !v), []);

  const setAppDrawerOpen = useCallback((open: boolean) => setAppDrawerOpenState(open), []);
  const toggleAppDrawer = useCallback(() => setAppDrawerOpenState((v) => !v), []);
  const setQuickSettingsOpen = useCallback((open: boolean) => setQuickSettingsOpenState(open), []);
  const toggleQuickSettings = useCallback(() => setQuickSettingsOpenState((v) => !v), []);

  // ── Diegetic dialog + factory reset ───────────────────────────
  const showAlert = useCallback((title: string, message: string) => setAlertState({ title, message }), []);
  const showConfirm = useCallback(
    (title: string, message: string, confirm: AlertConfirmOptions) => setAlertState({ title, message, confirm }),
    [],
  );
  const dismissAlert = useCallback(() => setAlertState(null), []);

  const resetOsSettings = useCallback(() => {
    setFxState(true);
    setSoundState(true);
    setVolumeState(0.7);
    setMutedState(false);
    setBrightnessState(1);
    setWarpState(handheld ? 0 : 0.7);
    setDisplayFxState({ ...DISPLAY_FX_DEFAULTS });
    setSoundFxState({ ...DEFAULT_SOUND_FX });
    SOUND_EFFECTS.forEach((name) => setSfxEffect(name, DEFAULT_SOUND_FX[name]));
    setThemeState('green');
    setTaskbarAutoHideState(false);
    setUiModeState('auto');
    setDeckModeState(false);
    setDeckRequestedState(false);
    setLauncherOpenState(false);
    setAppDrawerOpenState(false);
    setQuickSettingsOpenState(false);
    setArtVariantState('a');
    setInspectState(false);
    setCameraState(DEFAULT_CAMERA);
    setFitState(null);
    resetWallpaper();
    try {
      [FX_KEY, DISPLAY_FX_KEY, SOUND_FX_KEY, SOUND_KEY, VOL_KEY, MUTED_KEY, BRIGHT_KEY, ART_KEY, WARP_KEY, THEME_KEY, AUTOHIDE_KEY, UI_MODE_KEY, CAMERA_ZOOM_KEY, CAMERA_PAN_KEY, CAMERA_FIT_KEY]
        .forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
  }, [handheld]);

  // Push preference changes into the synthesized sound engine.
  useEffect(() => { setSfxEnabled(sound); }, [sound]);
  useEffect(() => { setSfxVolume(volume); }, [volume]);
  useEffect(() => { setSfxMuted(muted); }, [muted]);
  useEffect(() => {
    SOUND_EFFECTS.forEach((name) => setSfxEffect(name, soundFx[name]));
  }, [soundFx]);

  // Autoplay policy: create/resume the AudioContext on the first gesture, then
  // start the gentle data-flow ambience.
  useEffect(() => {
    const unlock = () => {
      unlockAudio();
      startAmbient();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // ── Window manager ──────────────────────────────────────────
  const focusWindow = useCallback((id: WindowId) => {
    setWindows((prev) => {
      const w = prev[id];
      if (!w) return prev;
      const z = ++zRef.current;
      return { ...prev, [id]: { ...w, minimized: false, z } };
    });
  }, []);

  const openWindow = useCallback((id: WindowId) => {
    setWindows((prev) => {
      const existing = prev[id];
      const def = WINDOW_DEFAULTS[id];
      const saved = layoutRef.current[id];
      const el = screenRef.current;
      const sw = el ? el.clientWidth : window.innerWidth;
      const sh = el ? el.clientHeight : window.innerHeight;
      // Clamp into the work area (below the status bar, above the dock).
      const w = Math.max(240, Math.min(saved?.rect.w ?? def.w, sw));
      const h = Math.max(160, Math.min(saved?.rect.h ?? def.h, sh - TOP_BAR_H - DOCK_H));
      const maxX = Math.max(0, sw - w);
      const maxY = Math.max(TOP_BAR_H, sh - DOCK_H - h);
      const rect = saved?.rect
        ? {
            x: Math.min(Math.max(0, saved.rect.x), maxX),
            y: Math.min(Math.max(TOP_BAR_H, saved.rect.y), maxY),
            w,
            h,
          }
        : {
            x: Math.max(0, Math.round((sw - w) / 2)),
            y: Math.max(TOP_BAR_H, Math.round(TOP_BAR_H + (sh - TOP_BAR_H - DOCK_H - h) / 2)),
            w,
            h,
          };
      const maximized = saved?.maximized ?? !!def.maximized;
      const z = ++zRef.current;

      let next = { ...prev };
      // Cap simultaneous windows: drop the oldest (lowest z) before adding a new one.
      if (!existing) {
        const ids = (Object.keys(next) as WindowId[]).filter((k) => next[k]);
        if (ids.length >= MAX_OPEN_WINDOWS) {
          const oldest = ids.reduce((m, k) => (next[k]!.z < next[m]!.z ? k : m), ids[0]);
          delete next[oldest];
        }
      }

      next = {
        ...next,
        [id]: existing
          ? { ...existing, minimized: false, z }
          : { title: def.title, minimized: false, maximized, rect, z },
      };
      return next;
    });
  }, []);

  const openDeckLauncher = useCallback(() => {
    setDeckRequestedState(true);
    setDeckProgressState(0);
    openWindow('deck');
  }, [openWindow]);

  const closeWindow = useCallback((id: WindowId) => {
    setWindows((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const openUrl = useCallback(
    (target: BrowseTarget) => {
      setBrowseState(target);
      openWindow('browser');
    },
    [openWindow],
  );

  const updateBrowse = useCallback((target: BrowseTarget) => setBrowseState(target), []);

  const closeBrowse = useCallback(() => {
    setBrowseState(null);
    closeWindow('browser');
  }, [closeWindow]);

  const minimizeWindow = useCallback((id: WindowId) => {
    setWindows((prev) => {
      const w = prev[id];
      if (!w) return prev;
      return { ...prev, [id]: { ...w, minimized: !w.minimized } };
    });
  }, []);

  const toggleMaximize = useCallback((id: WindowId) => {
    setWindows((prev) => {
      const w = prev[id];
      if (!w) return prev;
      persistLayout(id, w.rect, !w.maximized);
      return { ...prev, [id]: { ...w, maximized: !w.maximized } };
    });
  }, [persistLayout]);

  const moveWindow = useCallback((id: WindowId, rect: WindowRect) => {
    setWindows((prev) => {
      const w = prev[id];
      if (!w) return prev;
      persistLayout(id, rect, w.maximized);
      return { ...prev, [id]: { ...w, rect } };
    });
  }, [persistLayout]);

  const minimizeAll = useCallback(() => {
    setWindows((prev) => {
      const next: Windows = {};
      (Object.keys(prev) as WindowId[]).forEach((id) => {
        const w = prev[id];
        if (w) next[id] = { ...w, minimized: true };
      });
      return next;
    });
  }, []);

  const restoreAll = useCallback(() => {
    setWindows((prev) => {
      const next: Windows = {};
      (Object.keys(prev) as WindowId[]).forEach((id) => {
        const w = prev[id];
        if (w) next[id] = { ...w, minimized: false };
      });
      return next;
    });
  }, []);

  const isOpen = useCallback((id: WindowId) => !!windows[id], [windows]);

  // Escape closes the top-most window (unless focus is inside a form field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable)) return;
      const ids = (Object.keys(windows) as WindowId[]).filter((id) => windows[id]);
      if (ids.length === 0) return;
      const top = ids.reduce((m, id) => (windows[id]!.z > windows[m]!.z ? id : m), ids[0]);
      closeWindow(top);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [windows, closeWindow]);

  // Close the launcher menu and scan window on navigation; reset the scroller.
  useEffect(() => {
    setLauncherOpen(false);
    setAppDrawerOpen(false);
    setQuickSettingsOpen(false);
    closeWindow('scan');
    const el = scrollRef.current;
    if (!el) return;
    const hash = window.location.hash.slice(1);
    const target = hash ? document.getElementById(decodeURIComponent(hash)) : null;
    if (target && el.contains(target)) target.scrollIntoView({ block: 'start' });
    else el.scrollTo({ top: 0, left: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const value = useMemo(
    () => ({
      scrollRef,
      screenRef,
      fx,
      setFx,
      sound,
      setSound,
      volume,
      setVolume,
      muted,
      toggleMute,
      brightness,
      setBrightness,
      warp,
      setWarp,
      displayFx,
      setDisplayFx,
      soundFx,
      setSoundFx,
      taskbarAutoHide,
      setTaskbarAutoHide,
      theme,
      setTheme,
      uiMode,
      setUiMode,
      handheld,
      artVariant,
      setArtVariant,
      inspect,
      setInspect,
      toggleInspect,
      camera,
      setCamera,
      resetCamera,
      fit,
      saveFit,
      fitDeck,
      setMuted,
      alert,
      showAlert,
      showConfirm,
      dismissAlert,
      resetOsSettings,
      windows,
      isOpen,
      openWindow,
      closeWindow,
      launcherOpen,
      setLauncherOpen,
      toggleLauncher,
      appDrawerOpen,
      setAppDrawerOpen,
      toggleAppDrawer,
      quickSettingsOpen,
      setQuickSettingsOpen,
      toggleQuickSettings,
      minimizeWindow,
      toggleMaximize,
      focusWindow,
      moveWindow,
      minimizeAll,
      restoreAll,
      deckReady,
      setDeckReady,
      deckMode,
      setDeckMode,
      deckRequested,
      setDeckRequested,
      openDeckLauncher,
      deckProgress,
      setDeckProgress,
      browse,
      openUrl,
      updateBrowse,
      closeBrowse,
    }),
    [fx, setFx, sound, setSound, volume, setVolume, muted, toggleMute, setMuted, brightness, setBrightness, warp, setWarp, displayFx, setDisplayFx, soundFx, setSoundFx, taskbarAutoHide, setTaskbarAutoHide, theme, setTheme, uiMode, setUiMode, handheld, artVariant, setArtVariant, inspect, setInspect, toggleInspect, camera, setCamera, resetCamera, fit, saveFit, fitDeck, alert, showAlert, showConfirm, dismissAlert, resetOsSettings, windows, isOpen, openWindow, closeWindow, launcherOpen, setLauncherOpen, toggleLauncher, appDrawerOpen, setAppDrawerOpen, toggleAppDrawer, quickSettingsOpen, setQuickSettingsOpen, toggleQuickSettings, minimizeWindow, toggleMaximize, focusWindow, moveWindow, minimizeAll, restoreAll, deckReady, setDeckReady, deckMode, setDeckMode, deckRequested, setDeckRequested, openDeckLauncher, deckProgress, setDeckProgress, browse, openUrl, updateBrowse, closeBrowse],
  );

  const barrelActive = fx && displayFx.barrel && warp > 0.02;

  return (
    <WorkstationContext.Provider value={value}>
      <Cyberdeck3D>
        <svg aria-hidden="true" focusable="false" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
          <defs>
            <filter id="crt-barrel" x="0%" y="0%" width="100%" height="100%" primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
              {barrelMap && (
                <feImage href={barrelMap} result="map" x="0" y="0" width="1" height="1" preserveAspectRatio="none" />
              )}
              <feDisplacementMap in="SourceGraphic" in2="map" scale={(warp * BARREL_AMOUNT_MAX) / BARREL_MAP_GAIN} xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>
        <div
          className="screen"
          data-fx={fx ? 'on' : 'off'}
          data-barrel={barrelActive ? 'on' : 'off'}
          data-theme={theme}
          data-layout={handheld ? 'handheld' : 'desktop'}
          ref={screenRef}
          style={{
            filter: `brightness(${brightness})${barrelActive ? ' url(#crt-barrel)' : ''}`,
            borderRadius: deckMode ? `${12 + warp * 22}px` : 0,
            clipPath: deckMode ? `inset(0 round ${12 + warp * 22}px)` : 'inset(0)',
          }}
        >
          <StatusBar />
          <div
            ref={scrollRef}
            id="screen-scroll"
            className="screen-scroll"
            role="region"
            aria-label="Screen"
            tabIndex={0}
          >
            {children}
          </div>
          <Desktop />
          <Launcher />
          <AppDrawer />
          <QuickSettings />
          <ScanSequence />
          <BrowserWindow />
          <FeedbackWidget />
          <SettingsApp />
          <CyberdeckControls />
          <DeckLauncher />
          <RoamInfo />
          <CoffeeApp />
          <CameraRollProgram />
          <SnakeProgram />
          <MinesweeperProgram />
          <TetrisProgram />
          <AsteroidsProgram />
          <FroggerProgram />
          <UnderwebProgram />
          <SubstrateProgram />
          <Terminal />
          <Dock />
          <GestureLayer />
          <AlertDialog />
          {overlays}
        </div>
      </Cyberdeck3D>
    </WorkstationContext.Provider>
  );
}