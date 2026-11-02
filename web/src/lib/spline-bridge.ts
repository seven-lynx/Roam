/**
 * Spline ↔ React bridge for the Cyberdeck 3D workstation.
 *
 * The Spline scene owns the visual state; React owns the OS state. This module
 * is the single translation layer between them:
 *
 *   Spline → React   addEventListener('mouseDown') — physical control presses
 *   React → Spline   setVariable(...)               — drive knobs/switches/keys
 *
 * `activeKey` (0..8) is the single source of truth for which deck select key is
 * lit (0 = none). Both sides write it: the Spline scene latches it on a key
 * press (see SPLINE-PROMPTS.local.md), and React re-syncs it when navigation
 * happens off-device (dock links, back button, deep links). Because there is one
 * variable and the latest write wins, the two sides can never drift.
 */

import type { Application, SplineEvent } from '@splinetool/runtime';

import { PRIMARY_KEYS, type NavKey } from '@/lib/os-nav';

/** Spline variable names — must match the Variables panel in the scene. */
export const SPLINE_VARS = {
  vol: 'vol',
  bright: 'bright',
  warp: 'warp',
  /** Helper rotation for the knob: rotation.z = 135 - warp * 270. */
  warpAngle: 'warp-angle',
  fx: 'fx',
  sound: 'sound',
  /** Which deck select key is lit (0..8, 0 = none). */
  activeKey: 'activeKey',
} as const;

/** Spline object names — must match the scene hierarchy. */
export const SPLINE_OBJECTS = {
  screen: 'main-screen',
  knob: 'rotary-knob',
  sliderL: 'slider-left',
  sliderR: 'slider-right',
  switchL: 'switch-left',
  switchR: 'switch-right',
  roam: 'roam-key',
} as const;

/** The eight deck select keys, in order (key-1 .. key-8). */
export const SELECT_KEY_NAMES = [
  'key-1',
  'key-2',
  'key-3',
  'key-4',
  'key-5',
  'key-6',
  'key-7',
  'key-8',
] as const;

export type SelectKeyName = (typeof SELECT_KEY_NAMES)[number];

/** activeKey value that clears the selection (used by roam + off-device nav). */
export const NO_ACTIVE_KEY = 0;
/** key-7 = MENU (launcher). */
export const MENU_ACTIVE_KEY = 7;
/** key-8 = COMMS (feedback). */
export const COMMS_ACTIVE_KEY = 8;

// ── Variable remaps ──────────────────────────────────────────────────────────

/** OS brightness is 0.35..1.3; Spline `bright` is 0..1. */
export const BRIGHTNESS_MIN = 0.35;
export const BRIGHTNESS_MAX = 1.3;
export function brightToSpline(value: number): number {
  // The shipped default is 100% (1.0), which must read as *full* deck brightness.
  // So 100% maps to 1.0 (and anything above 100% clamps); dimmer values scale
  // down to 35% (0).
  return Math.min(1, Math.max(0, (value - BRIGHTNESS_MIN) / (1 - BRIGHTNESS_MIN)));
}
export function splineToBright(v: number): number {
  return BRIGHTNESS_MIN + Math.min(1, Math.max(0, v)) * (1 - BRIGHTNESS_MIN);
}

/** Knob helper rotation (degrees) for a 0..1 warp value. */
export function warpToAngle(warp: number): number {
  return 135 - warp * 270;
}

// ── Deck key → action map ────────────────────────────────────────────────────

/**
 * The eight keys mirror the 2D desk: the six route keys, then MENU (launcher),
 * then COMMS (feedback). ROAM is separate (momentary).
 */
export const MENU_KEY = SELECT_KEY_NAMES[6];
export const COMMS_KEY = SELECT_KEY_NAMES[7];

export type DeckAction =
  | { kind: 'route'; key: NavKey; activeKey: number }
  | { kind: 'menu'; activeKey: number }
  | { kind: 'comms'; activeKey: number }
  | { kind: 'roam' };

/** Resolve a Spline object name to the deck action it triggers (null if none). */
export function deckActionFor(name: string): DeckAction | null {
  const index = SELECT_KEY_NAMES.indexOf(name as SelectKeyName);
  if (index >= 0 && index < PRIMARY_KEYS.length) {
    return { kind: 'route', key: PRIMARY_KEYS[index], activeKey: index + 1 };
  }
  if (name === MENU_KEY) return { kind: 'menu', activeKey: MENU_ACTIVE_KEY };
  if (name === COMMS_KEY) return { kind: 'comms', activeKey: COMMS_ACTIVE_KEY };
  if (name === SPLINE_OBJECTS.roam) return { kind: 'roam' };
  return null;
}

// ── Wiring ───────────────────────────────────────────────────────────────────

/** React-side handlers the bridge calls on a physical press. */
export interface BridgeHandlers {
  onRoute: (key: NavKey) => void;
  onMenu: () => void;
  onComms: () => void;
  onRoam: () => void;
}

/** Attach press listeners for the deck keys + roam button. */
export function attachSplineBridge(app: Application, handlers: BridgeHandlers): void {
  app.addEventListener('mouseDown', (e: SplineEvent) => {
    const action = deckActionFor(e.target.name);
    if (!action) return;
    switch (action.kind) {
      case 'route':
        handlers.onRoute(action.key);
        break;
      case 'menu':
        handlers.onMenu();
        break;
      case 'comms':
        handlers.onComms();
        break;
      case 'roam':
        handlers.onRoam();
        break;
    }
  });
}

/** React → Spline: light the given deck key (0 clears). */
export function setActiveKey(app: Application, key: number): void {
  app.setVariable(SPLINE_VARS.activeKey, key);
}

/** React → Spline: apply the full OS control state in one call. */
export function syncControls(
  app: Application,
  state: {
    volume: number;
    brightness: number;
    warp: number;
    fx: boolean;
    sound: boolean;
    activeKey: number;
  },
): void {
  const vars: Record<string, number | boolean | string> = {
    [SPLINE_VARS.vol]: state.volume,
    [SPLINE_VARS.bright]: brightToSpline(state.brightness),
    [SPLINE_VARS.warp]: state.warp,
    [SPLINE_VARS.warpAngle]: warpToAngle(state.warp),
    [SPLINE_VARS.fx]: state.fx,
    [SPLINE_VARS.sound]: state.sound,
    [SPLINE_VARS.activeKey]: state.activeKey,
  };
  app.setVariables(vars);
}

// ── Scene HUD suppression ───────────────────────────────────────────────────

/**
 * The scene ships a diegetic \"CYBERDECK\" control HUD whose script's object
 * lookups were left stale after the last naming pass — it renders a red box with
 * a bogus issue count. In production we hide any object whose name contains
 * \"hud\" (the physical deck controls are named `switch-*`, `slider-*`,
 * `rotary-knob`, `*-key`, so they are unaffected) and let the React `<DeckHud>`
 * take over. Dev builds keep it so the scene can still be inspected/edited.
 */
export function suppressSceneHud(app: Application): void {
  if (process.env.NODE_ENV === 'development') return;
  try {
    const scene = (app as unknown as {
      _scene?: { traverse?: (cb: (obj: { name?: string; visible?: boolean }) => void) => void };
    })._scene;
    if (!scene?.traverse) return;
    scene.traverse((obj) => {
      const name = (obj.name || '').toLowerCase();
      if (name.includes('hud') && obj.visible !== false) obj.visible = false;
    });
  } catch {
    /* scene internals unavailable — htmlContentMode:'none' still applies */
  }
}
