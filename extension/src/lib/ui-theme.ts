// ui-theme.ts — ROAM-OS appearance preferences for the popup.
//
// The popup is the only surface that reads these. Unlike web and Android, the
// extension never paints CRT effects over anything the user is already looking
// at: the overlay lives inside the 300px popup window and nowhere else.
//
// Storage keys match Android's appearance settings (viewmodel/MainViewModel.kt)
// so the same vocabulary describes the same switches on every surface. Pure
// functions with no chrome.* or DOM dependency — popup.ts does the I/O.

/** Display theme. `roam_os` is the default; `classic` is the pre-ROAM-OS look. */
export type UiTheme = 'roam_os' | 'classic';

export const THEME_KEY = 'app_theme_variant'; // 'roam_os' | 'classic'
export const FX_KEY = 'crt_effects';          // master: scanlines + grain + vignette
export const STATIC_KEY = 'crt_static';       // animated analog snow (opt-in)
export const FLICKER_KEY = 'crt_flicker';     // brightness flutter (opt-in)

export interface UiFx {
  /** Master switch for the scanline, grain and vignette layers. */
  effects: boolean;
  /** Animated analog snow. Off by default: a glance is not a movie. */
  crtStatic: boolean;
  /** Brightness-dip flutter. Off by default, for the same reason. */
  flicker: boolean;
}

export const DEFAULT_UI_THEME: UiTheme = 'roam_os';

export const DEFAULT_UI_FX: UiFx = {
  effects: true,
  crtStatic: false,
  flicker: false,
};

/** Anything that is not exactly `'classic'` resolves to the default theme. */
export function resolveTheme(value: unknown): UiTheme {
  return value === 'classic' ? 'classic' : DEFAULT_UI_THEME;
}

/** Reads the three effect switches, coercing a missing/non-boolean value to its default. */
export function resolveFx(stored: Record<string, unknown>): UiFx {
  const bool = (value: unknown, fallback: boolean): boolean =>
    typeof value === 'boolean' ? value : fallback;
  return {
    effects: bool(stored[FX_KEY], DEFAULT_UI_FX.effects),
    crtStatic: bool(stored[STATIC_KEY], DEFAULT_UI_FX.crtStatic),
    flicker: bool(stored[FLICKER_KEY], DEFAULT_UI_FX.flicker),
  };
}

/** The slice of `HTMLElement` this module writes to — keeps it testable in node. */
export interface ThemeRoot {
  setAttribute(name: string, value: string): void;
}

/**
 * Attribute values for `<html>`. The theme value is snake_case in storage
 * (`roam_os`, matching Android) and kebab-case in CSS (`roam-os`, matching the
 * web shell), so the mapping lives here rather than in every selector.
 */
export function themeAttributes(theme: UiTheme, fx: UiFx): Record<string, string> {
  const on = (value: boolean): string => (value ? 'on' : 'off');
  return {
    'data-theme': theme === 'classic' ? 'classic' : 'roam-os',
    'data-fx': on(fx.effects),
    'data-static': on(fx.crtStatic),
    'data-flicker': on(fx.flicker),
  };
}

/** Applies `themeAttributes` to the document element (or a stand-in in tests). */
export function applyTheme(theme: UiTheme, fx: UiFx, root: ThemeRoot): void {
  for (const [name, value] of Object.entries(themeAttributes(theme, fx))) {
    root.setAttribute(name, value);
  }
}
