// tests/ui-theme.test.ts
//
// Vitest unit tests for src/lib/ui-theme.ts — the popup's ROAM-OS appearance
// switches. The module is pure (no chrome.*/DOM), so the storage-key contract
// and the attribute mapping are both exercised directly.
//
// Run: cd extension && pnpm vitest run src/__tests__/ui-theme.test.ts

import { describe, it, expect } from 'vitest';
import {
  applyTheme,
  DEFAULT_UI_FX,
  DEFAULT_UI_THEME,
  FLICKER_KEY,
  FX_KEY,
  resolveFx,
  resolveTheme,
  STATIC_KEY,
  THEME_KEY,
  themeAttributes,
} from '../lib/ui-theme';
import type { ThemeRoot, UiFx } from '../lib/ui-theme';

const ALL_OFF: UiFx = { effects: true, crtStatic: false, flicker: false };

function fakeRoot(): ThemeRoot & { attributes: Record<string, string> } {
  const attributes: Record<string, string> = {};
  return {
    attributes,
    setAttribute(name: string, value: string) {
      attributes[name] = value;
    },
  };
}

describe('storage keys', () => {
  it('matches the keys Android reads, so the same setting means the same thing', () => {
    expect({ THEME_KEY, FX_KEY, STATIC_KEY, FLICKER_KEY }).toEqual({
      THEME_KEY: 'app_theme_variant',
      FX_KEY: 'crt_effects',
      STATIC_KEY: 'crt_static',
      FLICKER_KEY: 'crt_flicker',
    });
  });
});

describe('resolveTheme', () => {
  it('defaults to ROAM-OS', () => {
    expect(DEFAULT_UI_THEME).toBe('roam_os');
    expect(resolveTheme(undefined)).toBe('roam_os');
  });

  it('honours an explicit classic choice', () => {
    expect(resolveTheme('classic')).toBe('classic');
  });

  it('falls back to ROAM-OS for anything unrecognised', () => {
    expect(resolveTheme('cyberpunk')).toBe('roam_os');
    expect(resolveTheme(null)).toBe('roam_os');
    expect(resolveTheme(0)).toBe('roam_os');
  });
});

describe('resolveFx', () => {
  it('turns the master on and the animated layers off by default', () => {
    expect(DEFAULT_UI_FX).toEqual({ effects: true, crtStatic: false, flicker: false });
    expect(resolveFx({})).toEqual({ effects: true, crtStatic: false, flicker: false });
  });

  it('reads each stored switch', () => {
    expect(resolveFx({ [FX_KEY]: false, [STATIC_KEY]: true, [FLICKER_KEY]: true })).toEqual({
      effects: false,
      crtStatic: true,
      flicker: true,
    });
  });

  it('keeps a stored false instead of treating it as missing', () => {
    expect(resolveFx({ [FX_KEY]: false }).effects).toBe(false);
  });

  it('ignores non-boolean values', () => {
    expect(resolveFx({ [FX_KEY]: 'yes', [STATIC_KEY]: 1, [FLICKER_KEY]: null })).toEqual({
      effects: true,
      crtStatic: false,
      flicker: false,
    });
  });
});

describe('themeAttributes', () => {
  it('maps storage values onto the css attributes', () => {
    expect(themeAttributes('roam_os', ALL_OFF)).toEqual({
      'data-theme': 'roam-os',
      'data-fx': 'on',
      'data-static': 'off',
      'data-flicker': 'off',
    });
  });

  it('uses the kebab-case classic value the stylesheet selects on', () => {
    const attrs = themeAttributes('classic', { ...ALL_OFF, effects: false });
    expect(attrs['data-theme']).toBe('classic');
    expect(attrs['data-fx']).toBe('off');
  });
});

describe('applyTheme', () => {
  it('writes real data-* attribute names', () => {
    const root = fakeRoot();
    applyTheme('classic', { effects: true, crtStatic: true, flicker: true }, root);
    expect(root.attributes).toEqual({
      'data-theme': 'classic',
      'data-fx': 'on',
      'data-static': 'on',
      'data-flicker': 'on',
    });
  });

  it('overwrites a previous state rather than accumulating attributes', () => {
    const root = fakeRoot();
    applyTheme('roam_os', ALL_OFF, root);
    applyTheme('roam_os', { ...ALL_OFF, crtStatic: true }, root);
    expect(Object.keys(root.attributes)).toHaveLength(4);
    expect(root.attributes['data-static']).toBe('on');
  });
});
