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
  { id: 'deck-01', label: 'Deck 01', css: "url('/wallpapers/deck-wallpaper-01.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-02', label: 'Deck 02', css: "url('/wallpapers/deck-wallpaper-02.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-03', label: 'Deck 03', css: "url('/wallpapers/deck-wallpaper-03.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-04', label: 'Deck 04', css: "url('/wallpapers/deck-wallpaper-04.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-05', label: 'Deck 05', css: "url('/wallpapers/deck-wallpaper-05.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-06', label: 'Deck 06', css: "url('/wallpapers/deck-wallpaper-06.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-07', label: 'Deck 07', css: "url('/wallpapers/deck-wallpaper-07.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-08', label: 'Deck 08', css: "url('/wallpapers/deck-wallpaper-08.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-09', label: 'Deck 09', css: "url('/wallpapers/deck-wallpaper-09.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-10', label: 'Deck 10', css: "url('/wallpapers/deck-wallpaper-10.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-11', label: 'Deck 11', css: "url('/wallpapers/deck-wallpaper-11.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-12', label: 'Deck 12', css: "url('/wallpapers/deck-wallpaper-12.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-13', label: 'Deck 13', css: "url('/wallpapers/deck-wallpaper-13.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-14', label: 'Deck 14', css: "url('/wallpapers/deck-wallpaper-14.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-15', label: 'Deck 15', css: "url('/wallpapers/deck-wallpaper-15.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-16', label: 'Deck 16', css: "url('/wallpapers/deck-wallpaper-16.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-17', label: 'Deck 17', css: "url('/wallpapers/deck-wallpaper-17.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-18', label: 'Deck 18', css: "url('/wallpapers/deck-wallpaper-18.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-19', label: 'Deck 19', css: "url('/wallpapers/deck-wallpaper-19.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-20', label: 'Deck 20', css: "url('/wallpapers/deck-wallpaper-20.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-21', label: 'Deck 21', css: "url('/wallpapers/deck-wallpaper-21.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-22', label: 'Deck 22', css: "url('/wallpapers/deck-wallpaper-22.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-23', label: 'Deck 23', css: "url('/wallpapers/deck-wallpaper-23.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-24', label: 'Deck 24', css: "url('/wallpapers/deck-wallpaper-24.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-25', label: 'Deck 25', css: "url('/wallpapers/deck-wallpaper-25.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-26', label: 'Deck 26', css: "url('/wallpapers/deck-wallpaper-26.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-27', label: 'Deck 27', css: "url('/wallpapers/deck-wallpaper-27.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-28', label: 'Deck 28', css: "url('/wallpapers/deck-wallpaper-28.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-29', label: 'Deck 29', css: "url('/wallpapers/deck-wallpaper-29.jpg') center / cover no-repeat, #07100f" },
  { id: 'deck-30', label: 'Deck 30', css: "url('/wallpapers/deck-wallpaper-30.jpg') center / cover no-repeat, #07100f" },
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
