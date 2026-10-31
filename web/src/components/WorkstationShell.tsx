'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import {
  WorkstationContext,
  WINDOW_DEFAULTS,
  BRIGHTNESS_MIN,
  BRIGHTNESS_MAX,
  type Windows,
  type WindowId,
  type WindowRect,
} from '@/components/WorkstationContext';
import { StatusBar } from '@/components/StatusBar';
import { HardwareDeck } from '@/components/HardwareDeck';
import { Launcher } from '@/components/Launcher';
import FeedbackWidget from '@/components/FeedbackWidget';
import { ScanSequence } from '@/components/ScanSequence';
import { Terminal } from '@/components/Terminal';
import { Dock } from '@/components/Dock';
import { setSfxVolume, setSfxMuted, setSfxEnabled, unlockAudio, startAmbient } from '@/lib/sfx';
import { DeskHardware } from '@/components/DeskHardware';
import { deskArt, type ArtVariant } from '@/lib/art';

const FX_KEY = 'roam-fx';
const SOUND_KEY = 'roam-sound';
const VOL_KEY = 'roam-vol';
const MUTED_KEY = 'roam-muted';
const BRIGHT_KEY = 'roam-bright';
const ART_KEY = 'roam-art';

/**
 * The device. Everything the site shows renders on `.screen`; the window itself
 * never scrolls. Owns the global workstation state: sound, volume, CRT
 * brightness, effects, and the window manager (open/minimize/maximize/drag).
 */
export function WorkstationShell({
  children,
  overlays,
  rails,
}: {
  children: ReactNode;
  overlays?: ReactNode;
  rails?: ReactNode;
}) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);

  const [fx, setFxState] = useState(true);
  const [sound, setSoundState] = useState(true);
  const [volume, setVolumeState] = useState(0.7);
  const [muted, setMutedState] = useState(false);
  const [brightness, setBrightnessState] = useState(1);
  const [artVariant, setArtVariantState] = useState<ArtVariant>('a');
  const [windows, setWindows] = useState<Windows>({});
  const zRef = useRef(0);

  // Restore persisted preferences once on mount.
  useEffect(() => {
    try {
      if (localStorage.getItem(FX_KEY) === 'off') setFxState(false);
      if (localStorage.getItem(SOUND_KEY) === 'off') setSoundState(false);
      if (localStorage.getItem(MUTED_KEY) === '1') setMutedState(true);
      const v = Number(localStorage.getItem(VOL_KEY));
      if (Number.isFinite(v)) setVolumeState(Math.min(1, Math.max(0, v)));
      const b = Number(localStorage.getItem(BRIGHT_KEY));
      if (Number.isFinite(b)) setBrightnessState(Math.min(BRIGHTNESS_MAX, Math.max(BRIGHTNESS_MIN, b)));
      const a = localStorage.getItem(ART_KEY);
      if (a === 'b') setArtVariantState('b');
    } catch {
      /* storage unavailable: keep defaults */
    }
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

  const setBrightness = useCallback((v: number) => {
    const c = Math.min(BRIGHTNESS_MAX, Math.max(BRIGHTNESS_MIN, v));
    setBrightnessState(c);
    try { localStorage.setItem(BRIGHT_KEY, String(c)); } catch { /* ignore */ }
  }, []);

  const setArtVariant = useCallback((v: ArtVariant) => {
    setArtVariantState(v);
    try { localStorage.setItem(ART_KEY, v); } catch { /* ignore */ }
  }, []);

  // Push preference changes into the synthesized sound engine.
  useEffect(() => { setSfxEnabled(sound); }, [sound]);
  useEffect(() => { setSfxVolume(volume); }, [volume]);
  useEffect(() => { setSfxMuted(muted); }, [muted]);

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
      const el = screenRef.current;
      const x = Math.max(0, Math.round((el ? el.clientWidth - def.w : 0) / 2));
      const y = Math.max(0, Math.round((el ? el.clientHeight - def.h : 0) / 2));
      const z = ++zRef.current;
      return {
        ...prev,
        [id]: existing
          ? { ...existing, minimized: false, z }
          : { title: def.title, minimized: false, maximized: !!def.maximized, rect: { x, y, w: def.w, h: def.h }, z },
      };
    });
  }, []);

  const closeWindow = useCallback((id: WindowId) => {
    setWindows((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

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
      return { ...prev, [id]: { ...w, maximized: !w.maximized } };
    });
  }, []);

  const moveWindow = useCallback((id: WindowId, rect: WindowRect) => {
    setWindows((prev) => {
      const w = prev[id];
      if (!w) return prev;
      return { ...prev, [id]: { ...w, rect } };
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

  // Close the launcher and scan windows on navigation; reset the screen scroller.
  useEffect(() => {
    closeWindow('launcher');
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
      artVariant,
      setArtVariant,
      windows,
      isOpen,
      openWindow,
      closeWindow,
      minimizeWindow,
      toggleMaximize,
      focusWindow,
      moveWindow,
    }),
    [fx, setFx, sound, setSound, volume, setVolume, muted, toggleMute, brightness, setBrightness, artVariant, setArtVariant, windows, isOpen, openWindow, closeWindow, minimizeWindow, toggleMaximize, focusWindow, moveWindow],
  );

  return (
    <WorkstationContext.Provider value={value}>
      <div className="desk">
        <DeskHardware />
        {rails}
        <div className="chassis">
          <div className="chassis-metal" aria-hidden="true" style={{ backgroundImage: `url(${deskArt('metal', artVariant)})` }} />
          <div className="bezel">
            <div
              className="screen"
              data-fx={fx ? 'on' : 'off'}
              ref={screenRef}
              style={{ filter: `brightness(${brightness})` }}
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
              <Launcher />
              <ScanSequence />
              <FeedbackWidget />
              <Terminal />
              <Dock />
              {overlays}
            </div>
          </div>
          <HardwareDeck />
        </div>
      </div>
    </WorkstationContext.Provider>
  );
}