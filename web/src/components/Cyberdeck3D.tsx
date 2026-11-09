'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Application } from '@splinetool/runtime';

import {
  useWorkstation,
  DEFAULT_ZOOM,
  CAMERA_ZOOM_MIN,
  CAMERA_ZOOM_MAX,
  type CameraFraming,
} from '@/components/WorkstationContext';
import {
  attachSplineBridge,
  syncControls,
  suppressSceneHud,
  COMMS_ACTIVE_KEY,
  MENU_ACTIVE_KEY,
  NO_ACTIVE_KEY,
  type BridgeHandlers,
} from '@/lib/spline-bridge';
import { PRIMARY_KEYS, isActivePath, type NavKey } from '@/lib/os-nav';
import { click, clickHeavy, clickNav } from '@/lib/sfx';
import { deriveQuad, ANCHOR_ASPECT, type ScreenQuad } from '@/lib/deck-framing';
import { BootSequence } from '@/components/BootSequence';
import { SplineScene } from '@/components/SplineScene';
import { DeckOverlay } from '@/components/DeckOverlay';
import { DeckHud } from '@/components/DeckHud';
import { getRoamBufferSnapshot, getRoamExhaustion, roamBufferTick, subscribeRoamBuffer } from '@/lib/roam-buffer';

/** Prefetch cadence: fast while the feed has URLs, slow while it is dry. */
const TICK_MS = 4000;
const DRY_TICK_MS = 60_000;

// Camera framing: Spline exposes `setZoom` (documented) and, through the `controls`
// getter, a three.js-style OrbitControls whose `pan(dx, dy)` (screen pixels) nudges
// the locked front view. Zoom is absolute; pan is an accumulated offset. The camera
// state itself now lives in `WorkstationContext` so the OS (dock/terminal) can drive it.
// The screen quad is derived from the camera (see `deriveQuad`), so the overlay and
// the deck stay glued whenever the framing changes.
const ZOOM_STEP = 0.1;
const PAN_STEP = 24;

// Best-effort "physical device" parallax: while the front view is locked, dragging a
// non-interactive part of the deck orbits the camera by a small amount (±20° azimuth,
// ±8° polar) and the DOM screen tilts to match. Approximate by design — see setParallax.
const ENABLE_PARALLAX = true;
const PARALLAX_AZIMUTH_LIMIT = (20 * Math.PI) / 180;
const PARALLAX_POLAR_LIMIT = (8 * Math.PI) / 180;
const PARALLAX_SCALE = 320; // pointer px per radian of orbit

const clampZoom = (n: number) => Math.min(CAMERA_ZOOM_MAX, Math.max(CAMERA_ZOOM_MIN, n));

/** The subset of three.js OrbitControls this component relies on (all optional). */
interface OrbitControlsLike {
  pan?: (dx: number, dy: number) => void;
  rotateLeft?: (angle: number) => void;
  rotateUp?: (angle: number) => void;
  getAzimuthalAngle?: () => number;
  getPolarAngle?: () => number;
  update?: () => void;
  enableRotate?: boolean;
  enableZoom?: boolean;
  enablePan?: boolean;
  enableDamping?: boolean;
}

/** The undocumented three.js OrbitControls exposed through Spline's `controls`. */
function getOrbitControls(app: Application | null): OrbitControlsLike | null {
  const oc = app?.controls?.orbitControls as Record<string, unknown> | undefined;
  return oc && typeof oc === 'object' ? (oc as unknown as OrbitControlsLike) : null;
}

const nudgeBtn: CSSProperties = {
  padding: '0.15rem 0.45rem',
  border: '1px solid var(--line)',
  borderRadius: '4px',
  background: 'var(--panel-3)',
  color: 'var(--ink)',
  cursor: 'pointer',
  fontFamily: 'var(--font-mono)',
  lineHeight: 1,
};

/** The lit deck key (1..6) for a route, or 0 when no route key owns the path. */
function activeKeyForPath(pathname: string): number {
  const index = PRIMARY_KEYS.findIndex((key) => isActivePath(pathname, key.href));
  return index >= 0 ? index + 1 : NO_ACTIVE_KEY;
}

/**
 * Full-viewport 3D cyberdeck: the self-hosted Spline scene plus the live Roam-OS
 * DOM overlaid on its screen quad. Bridges the physical controls to the existing
 * workstation state (`WorkstationContext`).
 */
export function Cyberdeck3D({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    volume, brightness, warp, fx, sound, windows, openWindow,
    launcherOpen, toggleLauncher,
    inspect, setInspect, camera, setCamera, resetCamera, saveFit, fitDeck, deckMode, deckRequested, deckReady, setDeckReady, setDeckProgress,
  } = useWorkstation();

  const appRef = useRef<Application | null>(null);
  const [app, setApp] = useState<Application | null>(null);
  const [buffer, setBuffer] = useState(getRoamBufferSnapshot);
  const [calibrating, setCalibrating] = useState(false);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const viewportRef = useRef({ w: 0, h: 0 });
  // Draggable/resizable quad for the calibrate overlay (baked into ANCHOR_QUAD).
  const [calibQuad, setCalibQuad] = useState<ScreenQuad | null>(null);
  const calibDragRef = useRef<{ mode: string; sx: number; sy: number; q0: ScreenQuad } | null>(null);
  // Mirror the context camera so onLoad + callbacks read it without stale closures.
  const cameraRef = useRef<CameraFraming>(camera);
  const prevCameraRef = useRef<CameraFraming>(camera);
  // Parallax (locked-front-view orbit) + inspect-exit bookkeeping.
  const screenElRef = useRef<HTMLDivElement | null>(null);
  const parallaxRef = useRef<{ x: number; y: number; az: number; pol: number } | null>(null);
  const parallaxAngleRef = useRef({ az: 0, pol: 0 });
  const rafRef = useRef<number | null>(null);
  const preInspectZoomRef = useRef<number | null>(null);
  // The full-viewport container: measured to size the fixed-aspect stage (whose
  // dimensions drive the derived quad) and to catch parallax drags.
  const containerRef = useRef<HTMLDivElement | null>(null);

  // The bridge is attached once on load; these refs keep its handlers fresh.
  const routerRef = useRef(router);
  const openWindowRef = useRef(openWindow);
  const toggleLauncherRef = useRef(toggleLauncher);
  const windowsRef = useRef(windows);

  // Deck-key behavior mirrors the old 2D hardware deck.
  const handlers = useMemo<BridgeHandlers>(
    () => ({
      onRoute: (key: NavKey) => {
        clickNav();
        routerRef.current.push(key.href);
      },
      onMenu: () => {
        click();
        toggleLauncherRef.current();
      },
      onComms: () => {
        clickNav();
        openWindowRef.current('feedback');
      },
      onRoam: () => {
        clickHeavy();
        openWindowRef.current('scan');
      },
    }),
    [],
  );

  // Which deck key is lit: launcher (7) / comms (8) / route key (1..6) / none (0).
  const activeKey = useMemo(() => {
    if (launcherOpen) return MENU_ACTIVE_KEY;
    if (windows.feedback) return COMMS_ACTIVE_KEY;
    return activeKeyForPath(pathname);
  }, [launcherOpen, windows.feedback, pathname]);

  // Latest control state, for the one-shot initial sync when the scene loads.
  const stateRef = useRef({ volume, brightness, warp, fx, sound, activeKey });

  // Keep the mutable refs current. `react-hooks/refs` requires ref writes to
  // happen in effects, not during render.
  useEffect(() => {
    routerRef.current = router;
    openWindowRef.current = openWindow;
    toggleLauncherRef.current = toggleLauncher;
    windowsRef.current = windows;
    stateRef.current = { volume, brightness, warp, fx, sound, activeKey };
    cameraRef.current = camera;
  });

  const applyZoom = useCallback((app: Application | null, z: number) => {
    if (!app) return;
    try {
      app.setZoom(z);
    } catch {
      /* older runtime without setZoom */
    }
    // Settle the camera synchronously so a screen re-measure is accurate.
    const oc = getOrbitControls(app);
    try {
      if (typeof oc?.update === 'function') oc.update();
    } catch {
      /* ignore */
    }
  }, []);

  const applyPan = useCallback((app: Application | null, dx: number, dy: number) => {
    if (!app || (dx === 0 && dy === 0)) return;
    const oc = getOrbitControls(app);
    if (!oc) return;
    try {
      // Panning is disabled while the front view is locked (setOrbitLocked sets
      // enablePan=false), which silently dropped every programmatic pan. Re-enable
      // it just for this call, apply the delta, then restore the lock.
      const prevPan = typeof oc.enablePan === 'boolean' ? oc.enablePan : null;
      if (typeof oc.enablePan === 'boolean') oc.enablePan = true;
      if (typeof oc.pan === 'function') oc.pan(dx, dy);
      if (typeof oc.update === 'function') oc.update();
      if (prevPan !== null && typeof oc.enablePan === 'boolean') oc.enablePan = prevPan;
    } catch {
      /* panning unavailable */
    }
  }, []);

  /** Lock (or unlock) native orbit when the OS is/isn't in inspect mode. */
  const setOrbitLocked = useCallback((app: Application | null, locked: boolean) => {
    const oc = getOrbitControls(app);
    if (!oc) return;
    try {
      if (typeof oc.enableRotate === 'boolean') oc.enableRotate = !locked;
      if (typeof oc.enableZoom === 'boolean') oc.enableZoom = !locked;
      if (typeof oc.enablePan === 'boolean') oc.enablePan = !locked;
      if (typeof oc.enableDamping === 'boolean') oc.enableDamping = !locked;
      if (typeof oc.update === 'function') oc.update();
    } catch {
      /* controls API varies between Spline versions */
    }
  }, []);

  /** Orbit the deck + tilt the DOM screen to a target parallax angle. */
  const setParallax = useCallback((oc: OrbitControlsLike, az: number, pol: number) => {
    parallaxAngleRef.current = { az, pol };
    try {
      const curAz = typeof oc.getAzimuthalAngle === 'function' ? oc.getAzimuthalAngle() : 0;
      const curPol = typeof oc.getPolarAngle === 'function' ? oc.getPolarAngle() : 0;
      if (typeof oc.rotateLeft === 'function') oc.rotateLeft(az - curAz);
      if (typeof oc.rotateUp === 'function') oc.rotateUp(pol - curPol);
      if (typeof oc.update === 'function') oc.update();
    } catch {
      /* ignore */
    }
    // Approximate the screen "staying latched" as the deck tilts. The translateX
    // fudge factor (60px/rad) is a hand-tuned approximation, not a projection.
    const el = screenElRef.current;
    if (el) {
      el.style.transform = `perspective(1400px) translateX(${az * 60}px) rotateY(${az}rad) rotateX(${-pol * 0.6}rad)`;
    }
  }, []);

  /** Ease the parallax angles back to a target (used to spring back on release). */
  const springParallax = useCallback((oc: OrbitControlsLike, targetAz: number, targetPol: number) => {
    const startAz = parallaxAngleRef.current.az;
    const startPol = parallaxAngleRef.current.pol;
    const t0 = performance.now();
    const DUR = 260;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / DUR);
      const e = 1 - Math.pow(1 - t, 3);
      setParallax(oc, startAz + (targetAz - startAz) * e, startPol + (targetPol - startPol) * e);
      rafRef.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    rafRef.current = requestAnimationFrame(step);
  }, [setParallax]);

  /** Snap the deck + screen back to the front view, canceling any spring. */
  const resetParallax = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const oc = getOrbitControls(appRef.current);
    const { az, pol } = parallaxAngleRef.current;
    parallaxAngleRef.current = { az: 0, pol: 0 };
    if (oc) {
      try {
        if (az !== 0 && typeof oc.rotateLeft === 'function') oc.rotateLeft(-az);
        if (pol !== 0 && typeof oc.rotateUp === 'function') oc.rotateUp(-pol);
        if (typeof oc.update === 'function') oc.update();
      } catch {
        /* ignore */
      }
    }
    if (screenElRef.current) screenElRef.current.style.transform = '';
  }, []);

  /** Drag a non-interactive part of the deck to orbit it (immersion only). */
  const onParallaxDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (inspect || calibrating || !ENABLE_PARALLAX) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('.cyberdeck-screen, .cyberdeck-toolbar, .cyberdeck-calibrate, .cyberdeck-screen-handles')) return;
      const oc = getOrbitControls(appRef.current);
      if (!oc || typeof oc.getAzimuthalAngle !== 'function' || typeof oc.rotateLeft !== 'function') return;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      parallaxRef.current = {
        x: e.clientX,
        y: e.clientY,
        az: parallaxAngleRef.current.az,
        pol: parallaxAngleRef.current.pol,
      };
      const onMove = (ev: PointerEvent) => {
        const p = parallaxRef.current;
        if (!p) return;
        const dx = (ev.clientX - p.x) / PARALLAX_SCALE;
        const dy = (ev.clientY - p.y) / PARALLAX_SCALE;
        const az = Math.min(PARALLAX_AZIMUTH_LIMIT, Math.max(-PARALLAX_AZIMUTH_LIMIT, p.az + dx));
        const pol = Math.min(PARALLAX_POLAR_LIMIT, Math.max(-PARALLAX_POLAR_LIMIT, p.pol + dy));
        setParallax(oc, az, pol);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        parallaxRef.current = null;
        springParallax(oc, 0, 0);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [inspect, calibrating, setParallax, springParallax],
  );

  const onLoad = useCallback(
    (app: Application) => {
      appRef.current = app;
      setApp(app);
      attachSplineBridge(app, handlers);
      suppressSceneHud(app);
      syncControls(app, stateRef.current);
      // Lock the front view (orbit is only enabled in inspect mode), then re-apply
      // the persisted camera framing (the scene resets its camera on load).
      setOrbitLocked(app, true);
      applyZoom(app, cameraRef.current.zoom);
      applyPan(app, cameraRef.current.panX, cameraRef.current.panY);
      // The runtime reports "loaded" a beat before the applied camera is actually
      // painted and before the viewport has been measured. Wait a few frames (and
      // for the viewport) so the boot screen doesn't drop while the deck is still
      // drawing, and the screen quad is already aligned when it does.
      let frames = 0;
      const settle = () => {
        frames += 1;
        const v = viewportRef.current;
        if (v.w > 0 && v.h > 0 && frames >= 3) {
          setDeckReady(true);
        } else if (frames < 120) {
          requestAnimationFrame(settle);
        } else {
          setDeckReady(true);
        }
      };
      requestAnimationFrame(settle);
    },
    [handlers, applyZoom, applyPan, setOrbitLocked, setDeckReady],
  );

  // React → Spline: push the OS control state whenever it changes.
  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    syncControls(app, { volume, brightness, warp, fx, sound, activeKey });
  }, [volume, brightness, warp, fx, sound, activeKey]);

  // React → Spline: push the camera framing whenever it changes. Zoom is absolute,
  // pan is an accumulated offset, so pan is applied as a delta from the last value.
  useEffect(() => {
    const app = appRef.current;
    const prev = prevCameraRef.current;
    if (!app) {
      prevCameraRef.current = camera;
      return;
    }
    applyPan(app, camera.panX - prev.panX, camera.panY - prev.panY);
    applyZoom(app, camera.zoom);
    prevCameraRef.current = camera;
  }, [camera, applyPan, applyZoom]);

  // Inspect mode: reset zoom (keep pan) on entry, restore it on exit, and toggle
  // native orbit. The screen overlay is hidden while inspecting, so the zoom reset
  // is what "returns the deck to normal size" before the user zooms in freely.
  useEffect(() => {
    setOrbitLocked(appRef.current, !inspect);
    resetParallax();
    if (inspect) {
      if (preInspectZoomRef.current === null) {
        preInspectZoomRef.current = cameraRef.current.zoom;
        setCamera({ ...cameraRef.current, zoom: DEFAULT_ZOOM });
      }
    } else if (preInspectZoomRef.current !== null) {
      const prev = preInspectZoomRef.current;
      preInspectZoomRef.current = null;
      setCamera({ ...cameraRef.current, zoom: prev });
    }
  }, [inspect, setCamera, setOrbitLocked, resetParallax]);

  // Re-center any parallax tilt when navigating or entering calibrate mode.
  useEffect(() => {
    resetParallax();
  }, [pathname, calibrating, resetParallax]);

  // Drop the runtime handle + cancel any parallax spring on unmount (the Spline
  // component disposes the app itself).
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      appRef.current = null;
    };
  }, []);

  // Mirror the prefetch buffer (hot/warm) into React so the nixie tubes track it.
  useEffect(() => subscribeRoamBuffer(() => setBuffer(getRoamBufferSnapshot())), []);

  // Drive the prefetch loop: one tick shortly after mount, then on a fixed cadence.
  // A dry feed backs off rather than retrying every tick: a cooldown lasts hours and
  // an empty pool lasts until new URLs land, so the fast cadence only burns calls.
  // It keeps checking (a `stop` would strand the deck once the cooldown lifts) —
  // it just checks once a minute while there is nothing to fetch.
  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const loop = () => {
      if (cancelled) return;
      void roamBufferTick().finally(() => {
        if (cancelled) return;
        timer = window.setTimeout(loop, getRoamExhaustion() ? DRY_TICK_MS : TICK_MS);
      });
    };
    timer = window.setTimeout(loop, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  // ── Screen-quad calibration ─────────────────────────────────────────────────
  // ── Derived screen quad ──────────────────────────────────────────────────
  // Measure the viewport once and on resize (browser zoom / window resize), then
  // derive the overlay rect from the camera so the DOM screen and the 3D deck
  // stay glued whenever the framing changes.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const vw = rect.width;
      const vh = rect.height;
      // The stage keeps the canvas at a fixed aspect so the fraction-based overlay
      // can never drift with viewport size. In OS-only mode it fills the viewport
      // (the deck is hidden), so no letterboxing applies.
      let sw = vw;
      let sh = vh;
      if (deckMode && vw > 0 && vh > 0) {
        if (vw / vh > ANCHOR_ASPECT) {
          sw = vh * ANCHOR_ASPECT;
          sh = vh;
        } else {
          sw = vw;
          sh = vw / ANCHOR_ASPECT;
        }
      }
      viewportRef.current = { w: sw, h: sh };
      setViewport({ w: sw, h: sh });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [deckMode]);

  // Never strand the deck: if the scene fails to load or paint, mark it ready
  // after a generous grace period so the mount window can still complete.
  useEffect(() => {
    if (deckReady || !deckRequested) return;
    const t = window.setTimeout(() => setDeckReady(true), 12000);
    return () => window.clearTimeout(t);
  }, [deckReady, deckRequested, setDeckReady]);

  // Derive the overlay rect from the camera so the DOM screen and the 3D deck
  // stay glued whenever the framing changes (see deriveQuad).
  const quad = useMemo<ScreenQuad>(
    () => deriveQuad(camera, viewport.w, viewport.h),
    [camera, viewport.w, viewport.h],
  );

  // While calibrating, the overlay is driven by the dragged quad (not the camera).
  const displayQuad = calibrating && calibQuad ? calibQuad : quad;

  const startCalibMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!calibQuad) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      calibDragRef.current = { mode: 'move', sx: e.clientX, sy: e.clientY, q0: calibQuad };
    },
    [calibQuad],
  );

  const startCalibResize = useCallback(
    (dir: string) => (e: ReactPointerEvent<HTMLSpanElement>) => {
      if (!calibQuad) return;
      // Keep the pointer-down from bubbling to the parent move handler, which
      // would otherwise overwrite this resize mode with `move` and turn every
      // resize drag into a plain reposition.
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      calibDragRef.current = { mode: dir, sx: e.clientX, sy: e.clientY, q0: calibQuad };
    },
    [calibQuad],
  );

  const onCalibMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const d = calibDragRef.current;
      if (!d || !viewport.w || !viewport.h) return;
      const dx = (e.clientX - d.sx) / viewport.w;
      const dy = (e.clientY - d.sy) / viewport.h;
      const q = d.q0;
      const next: ScreenQuad = { ...q };
      if (d.mode === 'move') {
        next.x = q.x + dx;
        next.y = q.y + dy;
      } else {
        if (d.mode.includes('e')) next.w = q.w + dx;
        if (d.mode.includes('s')) next.h = q.h + dy;
        if (d.mode.includes('w')) { next.x = q.x + dx; next.w = q.w - dx; }
        if (d.mode.includes('n')) { next.y = q.y + dy; next.h = q.h - dy; }
      }
      next.w = Math.max(0.02, next.w);
      next.h = Math.max(0.02, next.h);
      setCalibQuad(next);
    },
    [viewport.w, viewport.h],
  );

  const endCalibDrag = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    calibDragRef.current = null;
  }, []);

  const nudgeZoom = useCallback(
    (delta: number) => {
      setCamera({ ...cameraRef.current, zoom: clampZoom(cameraRef.current.zoom + delta) });
    },
    [setCamera],
  );

  const nudgePan = useCallback(
    (dx: number, dy: number) => {
      setCamera({
        ...cameraRef.current,
        panX: cameraRef.current.panX + dx,
        panY: cameraRef.current.panY + dy,
      });
    },
    [setCamera],
  );

  const centerCamera = useCallback(() => {
    setCamera({ ...cameraRef.current, panX: 0, panY: 0 });
  }, [setCamera]);

  // Arrow keys / WASD pan the camera, `[` / `]` zooms it, C centers it and
  // F snaps to the saved fit (calibrate mode only).
  useEffect(() => {
    if (!calibrating) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (typing) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          nudgePan(-PAN_STEP, 0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          nudgePan(PAN_STEP, 0);
          break;
        case 'ArrowUp':
          e.preventDefault();
          nudgePan(0, -PAN_STEP);
          break;
        case 'ArrowDown':
          e.preventDefault();
          nudgePan(0, PAN_STEP);
          break;
        case 'w':
        case 'W':
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          e.preventDefault();
          nudgePan(0, -PAN_STEP);
          break;
        case 'a':
        case 'A':
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          e.preventDefault();
          nudgePan(-PAN_STEP, 0);
          break;
        case 's':
        case 'S':
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          e.preventDefault();
          nudgePan(0, PAN_STEP);
          break;
        case 'd':
        case 'D':
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          e.preventDefault();
          nudgePan(PAN_STEP, 0);
          break;
        case 'c':
        case 'C':
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          e.preventDefault();
          centerCamera();
          break;
        case 'f':
        case 'F':
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          e.preventDefault();
          if (e.shiftKey) saveFit();
          else fitDeck();
          break;
        case '[':
          e.preventDefault();
          nudgeZoom(-ZOOM_STEP);
          break;
        case ']':
          e.preventDefault();
          nudgeZoom(ZOOM_STEP);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [calibrating, nudgePan, nudgeZoom, centerCamera, fitDeck, saveFit]);

  // Inspect-mode keys: `[` / `]` zoom, `c` re-centers pan, Escape returns to the OS.
  useEffect(() => {
    if (!inspect) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (typing) return;
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          setInspect(false);
          break;
        case '[':
          e.preventDefault();
          nudgeZoom(-ZOOM_STEP);
          break;
        case ']':
          e.preventDefault();
          nudgeZoom(ZOOM_STEP);
          break;
        case 'c':
        case 'C':
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          e.preventDefault();
          centerCamera();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inspect, setInspect, nudgeZoom, centerCamera]);

  // In OS-only mode the OS fills the viewport; in deck view it sits on the quad.
  const screenStyle = useMemo(
    () =>
      deckMode
        ? {
            left: `${displayQuad.x * 100}%`,
            top: `${displayQuad.y * 100}%`,
            width: `${displayQuad.w * 100}%`,
            height: `${displayQuad.h * 100}%`,
          }
        : { left: 0, top: 0, width: '100%', height: '100%' },
    [deckMode, displayQuad],
  );

  return (
    <div className="cyberdeck-3d" ref={containerRef} onPointerDownCapture={onParallaxDown} data-deck={deckMode}>
      <div className="cyberdeck-stage" style={{ width: viewport.w || undefined, height: viewport.h || undefined }}>
        {deckRequested && (
          <SplineScene
            scene="/spline/cyberdeck.splinecode"
            onLoad={onLoad}
            onProgress={setDeckProgress}
            style={{ width: '100%', height: '100%' }}
          />
        )}
        <div
          ref={screenElRef}
          className="cyberdeck-screen"
          data-inspect={inspect}
          data-calibrating={calibrating}
          data-deck={deckMode}
          data-ready={deckMode ? deckReady : true}
          style={screenStyle}
          aria-hidden={inspect}
        >
          {children}
        </div>
        <DeckOverlay
          app={app}
          deckReady={deckReady}
          deckMode={deckMode}
          viewport={viewport}
          camera={camera}
          hot={buffer.hot}
          warm={buffer.warm}
        />
        {calibrating && calibQuad && (
          <div
            className="cyberdeck-screen-handles"
            style={{
              left: `${calibQuad.x * 100}%`,
              top: `${calibQuad.y * 100}%`,
              width: `${calibQuad.w * 100}%`,
              height: `${calibQuad.h * 100}%`,
            }}
            onPointerDown={startCalibMove}
            onPointerMove={onCalibMove}
            onPointerUp={endCalibDrag}
            onPointerCancel={endCalibDrag}
          >
            <span className="handle handle-n" onPointerDown={startCalibResize('n')} onPointerMove={onCalibMove} onPointerUp={endCalibDrag} onPointerCancel={endCalibDrag} />
            <span className="handle handle-s" onPointerDown={startCalibResize('s')} onPointerMove={onCalibMove} onPointerUp={endCalibDrag} onPointerCancel={endCalibDrag} />
            <span className="handle handle-e" onPointerDown={startCalibResize('e')} onPointerMove={onCalibMove} onPointerUp={endCalibDrag} onPointerCancel={endCalibDrag} />
            <span className="handle handle-w" onPointerDown={startCalibResize('w')} onPointerMove={onCalibMove} onPointerUp={endCalibDrag} onPointerCancel={endCalibDrag} />
            <span className="handle handle-nw" onPointerDown={startCalibResize('nw')} onPointerMove={onCalibMove} onPointerUp={endCalibDrag} onPointerCancel={endCalibDrag} />
            <span className="handle handle-ne" onPointerDown={startCalibResize('ne')} onPointerMove={onCalibMove} onPointerUp={endCalibDrag} onPointerCancel={endCalibDrag} />
            <span className="handle handle-sw" onPointerDown={startCalibResize('sw')} onPointerMove={onCalibMove} onPointerUp={endCalibDrag} onPointerCancel={endCalibDrag} />
            <span className="handle handle-se" onPointerDown={startCalibResize('se')} onPointerMove={onCalibMove} onPointerUp={endCalibDrag} onPointerCancel={endCalibDrag} />
          </div>
        )}
      </div>
      <BootSequence />
      {deckMode && deckReady && <DeckHud />}
      {deckMode && (
        <div className="cyberdeck-toolbar">
          <button
            type="button"
            className="cyberdeck-inspect"
            onClick={() => {
              if (!calibrating) setCalibQuad(quad);
              else setCalibQuad(null);
              setCalibrating((value) => !value);
            }}
            aria-pressed={calibrating}
            aria-label={calibrating ? 'Finish calibrating' : 'Calibrate the screen (dev)'}
          >
            {calibrating ? 'Done' : 'Calibrate'}
          </button>
        </div>
      )}
      {inspect && (
        <button
          type="button"
          className="cyberdeck-return"
          onClick={() => setInspect(false)}
          aria-label="Return to the screen"
        >
          ⟵ Return to screen
        </button>
      )}
      {calibrating && (
        <div className="cyberdeck-calibrate" role="toolbar" aria-label="Screen calibration">
          <div className="cyberdeck-calibrate-title">Camera framing · screen quad follows · WASD/arrows pan · [ ] zoom · C center · F fit (Shift+F save)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '1ch', color: 'var(--phosphor)' }}>z</span>
            <button type="button" onClick={() => nudgeZoom(-ZOOM_STEP)} style={nudgeBtn}>
              -
            </button>
            <span style={{ width: '4.5rem', textAlign: 'center' }}>{camera.zoom.toFixed(2)}×</span>
            <button type="button" onClick={() => nudgeZoom(ZOOM_STEP)} style={nudgeBtn}>
              +
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '1ch', color: 'var(--phosphor)' }}>◱</span>
            <button type="button" onClick={() => nudgePan(0, -PAN_STEP)} style={nudgeBtn} aria-label="Pan up">
              ▲
            </button>
            <button type="button" onClick={() => nudgePan(-PAN_STEP, 0)} style={nudgeBtn} aria-label="Pan left">
              ◀
            </button>
            <button type="button" onClick={() => nudgePan(0, PAN_STEP)} style={nudgeBtn} aria-label="Pan down">
              ▼
            </button>
            <button type="button" onClick={() => nudgePan(PAN_STEP, 0)} style={nudgeBtn} aria-label="Pan right">
              ▶
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" className="cyberdeck-reset" onClick={centerCamera}>
              Center
            </button>
            <button type="button" className="cyberdeck-reset" onClick={fitDeck} title="Snap to the saved framing">
              Fit deck
            </button>
            <button type="button" className="cyberdeck-reset" onClick={saveFit} title="Save the current framing as the fit target">
              Save fit
            </button>
            <button
              type="button"
              className="cyberdeck-reset"
              onClick={() => {
                const payload = JSON.stringify({ camera, quad }, null, 2);
                navigator.clipboard.writeText(payload).then(
                  () => { /* copied */ },
                  () => { /* fallback */ },
                );
              }}
              title="Copy current camera + quad to clipboard (for baking defaults)"
            >
              Copy framing
            </button>
            <button
              type="button"
              className="cyberdeck-reset"
              onClick={() => {
                const q = calibQuad ?? quad;
                const payload = JSON.stringify(q, null, 2);
                navigator.clipboard.writeText(payload).then(
                  () => { /* copied */ },
                  () => { /* fallback */ },
                );
              }}
              title="Copy the screen quad (drag the handles over the 3D screen first)"
            >
              Copy quad
            </button>
            <button type="button" className="cyberdeck-reset" onClick={resetCamera}>
              Reset camera
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
