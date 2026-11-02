'use client';

import { useEffect, useState } from 'react';

/**
 * Desktop wallpaper store: built-in presets plus a user-uploaded custom image,
 * and a "cycle" mode that shuffles the whole folder every few minutes.
 *
 * Mirrors the singleton + listener pattern used by `lib/roam-buffer.ts`, with
 * persistence to localStorage so the choice survives revisits. The default
 * mode is `cycle` (random shuffle).
 */

export interface Wallpaper {
  id: string;
  label: string;
  css: string;
}

export const WALLPAPERS: Wallpaper[] = [
  { id: 'cpu-wireframe', label: 'CPU Wireframe', css: "url('/wallpapers/cpu-wireframe.jpg') center / cover no-repeat, #07100f" },
  { id: 'future-city', label: 'Future City', css: "url('/wallpapers/future-city.png') center / cover no-repeat, #07100f" },
  { id: 'watch-dogs-legion', label: 'Watch Dogs: Legion', css: "url('/wallpapers/watch-dogs-legion.jpg') center / cover no-repeat, #07100f" },
  { id: 'mars-2020', label: 'Mars 2020', css: "url('/wallpapers/mars-2020.jpg') center / cover no-repeat, #07100f" },
  { id: 'world-from-space', label: 'World from Space', css: "url('/wallpapers/world-from-space.jpg') center / cover no-repeat, #07100f" },
  { id: 'glacier-patagonia', label: 'Glacier of Patagonia', css: "url('/wallpapers/glacier-patagonia.jpg') center / cover no-repeat, #07100f" },
  { id: 'dual-monitor-4k', label: 'Dual Monitor 4K', css: "url('/wallpapers/dual-monitor-4k.jpg') center / cover no-repeat, #07100f" },
  { id: 'ultrawide', label: 'Ultrawide', css: "url('/wallpapers/ultrawide.jpg') center / cover no-repeat, #07100f" },
  { id: 'aesthetic-01', label: 'Aesthetic I', css: "url('/wallpapers/aesthetic-01.jpg') center / cover no-repeat, #07100f" },
  { id: 'aesthetic-02', label: 'Aesthetic II', css: "url('/wallpapers/aesthetic-02.jpg') center / cover no-repeat, #07100f" },
  { id: 'aesthetic-03', label: 'Aesthetic III', css: "url('/wallpapers/aesthetic-03.jpg') center / cover no-repeat, #07100f" },
  { id: 'photo-2024-02-20', label: 'Photo · Feb 2024', css: "url('/wallpapers/photo-2024-02-20.png') center / cover no-repeat, #07100f" },
  { id: 'photo-2024-03-29', label: 'Photo · Mar 2024', css: "url('/wallpapers/photo-2024-03-29.png') center / cover no-repeat, #07100f" },
  { id: 'photo-2024-10-05', label: 'Photo · Oct 2024', css: "url('/wallpapers/photo-2024-10-05.png') center / cover no-repeat, #07100f" },
  { id: 'abstract-3401050', label: 'Abstract 3401050', css: "url('/wallpapers/abstract-3401050.jpg') center / cover no-repeat, #07100f" },
  { id: 'abstract-673599', label: 'Abstract 673599', css: "url('/wallpapers/abstract-673599.jpg') center / cover no-repeat, #07100f" },
  { id: 'abstract-a18385d', label: 'Abstract a18385d', css: "url('/wallpapers/abstract-a18385d.jpg') center / cover no-repeat, #07100f" },
];

const WALLPAPER_KEY = 'roam-desktop-wallpaper';
const MODE_KEY = 'roam-desktop-wallpaper-mode';

/** How long between automatic wallpapers in cycle mode. */
export const WALLPAPER_CYCLE_MS = 5 * 60 * 1000;

export type WallpaperMode = 'cycle' | 'fixed';

export interface WallpaperSnapshot {
  mode: WallpaperMode;
  current: Wallpaper;
  custom: Wallpaper | null;
}

interface StoredState {
  mode: WallpaperMode;
  currentId: string;
  custom: Wallpaper | null;
}

type Listener = () => void;

function loadState(): StoredState {
  const state: StoredState = { mode: 'cycle', currentId: WALLPAPERS[0].id, custom: null };
  try {
    const rawMode = localStorage.getItem(MODE_KEY);
    if (rawMode === 'cycle' || rawMode === 'fixed') state.mode = rawMode;
    const raw = localStorage.getItem(WALLPAPER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { id?: string; css?: string } | null;
      if (parsed && typeof parsed.id === 'string') {
        if (parsed.id === 'custom' && typeof parsed.css === 'string') {
          state.custom = { id: 'custom', label: 'Custom', css: parsed.css };
          state.currentId = 'custom';
        } else if (WALLPAPERS.some((w) => w.id === parsed.id)) {
          state.currentId = parsed.id;
        }
      }
    }
  } catch {
    /* storage unavailable: keep defaults */
  }
  return state;
}

let state = loadState();
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

function resolve(id: string): Wallpaper {
  if (id === 'custom' && state.custom) return state.custom;
  return WALLPAPERS.find((w) => w.id === id) ?? WALLPAPERS[0];
}

function snapshot(): WallpaperSnapshot {
  return { mode: state.mode, current: resolve(state.currentId), custom: state.custom };
}

function persist() {
  try {
    localStorage.setItem(MODE_KEY, state.mode);
    localStorage.setItem(WALLPAPER_KEY, JSON.stringify(resolve(state.currentId)));
  } catch {
    /* ignore (private mode / quota) */
  }
}

export function getWallpaperState(): WallpaperSnapshot {
  return snapshot();
}

export function subscribeWallpaper(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getWallpaperPool(): Wallpaper[] {
  const pool = [...WALLPAPERS];
  if (state.custom) pool.push(state.custom);
  return pool;
}

/** Switch between shuffling the folder and pinning a single wallpaper. */
export function setWallpaperMode(mode: WallpaperMode): void {
  state = { ...state, mode };
  persist();
  emit();
}

/** Pin a specific wallpaper (switches to fixed mode). */
export function selectWallpaper(id: string): void {
  if (!getWallpaperPool().some((w) => w.id === id)) return;
  state = { ...state, currentId: id, mode: 'fixed' };
  persist();
  emit();
}

/** Save a user-uploaded image as the wallpaper (switches to fixed mode). */
export function setCustomWallpaper(css: string): void {
  state = { ...state, custom: { id: 'custom', label: 'Custom', css }, currentId: 'custom', mode: 'fixed' };
  persist();
  emit();
}

export function removeCustomWallpaper(): void {
  const wasCustom = state.currentId === 'custom';
  state = { ...state, custom: null, currentId: wasCustom ? WALLPAPERS[0].id : state.currentId };
  persist();
  emit();
}

/** Pick the next wallpaper at random (used by the cycle interval). */
export function applyRandomWallpaper(): void {
  const pool = getWallpaperPool();
  if (pool.length === 0) return;
  let pick = pool[Math.floor(Math.random() * pool.length)];
  if (pick.id === state.currentId && pool.length > 1) {
    const others = pool.filter((w) => w.id !== state.currentId);
    pick = others[Math.floor(Math.random() * others.length)];
  }
  state = { ...state, currentId: pick.id };
  persist();
  emit();
}

/** Restore factory wallpaper defaults (used by "Reset OS settings"). */
export function resetWallpaper(): void {
  state = { mode: 'cycle', currentId: WALLPAPERS[0].id, custom: null };
  try {
    localStorage.removeItem(MODE_KEY);
    localStorage.removeItem(WALLPAPER_KEY);
  } catch {
    /* ignore */
  }
  emit();
}

/**
 * React hook mirroring the OS-settings pattern: a deterministic default on the
 * first render (SSR-safe), synced to the store via effect on the client.
 */
export function useWallpaper(): WallpaperSnapshot {
  const [snap, setSnap] = useState<WallpaperSnapshot>(() => ({
    mode: 'cycle',
    current: WALLPAPERS[0],
    custom: null,
  }));
  useEffect(() => {
    setSnap(snapshot());
    return subscribeWallpaper(() => setSnap(snapshot()));
  }, []);
  return snap;
}
