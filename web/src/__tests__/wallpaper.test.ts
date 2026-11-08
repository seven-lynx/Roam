import { existsSync } from 'node:fs';
import path from 'node:path';

import {
  MOBILE_WALLPAPERS,
  WALLPAPERS,
  applyRandomMobileWallpaper,
  getWallpaperState,
  removeCustomWallpaper,
  resetWallpaper,
  selectWallpaper,
  setCustomWallpaper,
} from '@/lib/wallpaper';

const MOBILE_KEY = 'roam-mobile-wallpaper';
const CUSTOM_CSS = 'url("data:image/png;base64,AAAA") center / cover no-repeat, #07100f';

/** Pull the asset path out of a wallpaper's `css` shorthand. */
function cssPath(css: string): string {
  const match = /url\('([^']+)'\)/.exec(css);
  return match ? match[1] : '';
}

describe('wallpaper store', () => {
  beforeEach(() => {
    localStorage.clear();
    resetWallpaper();
  });

  afterEach(() => {
    localStorage.clear();
    resetWallpaper();
  });

  describe('mobile preset catalog', () => {
    it('ships 13 portrait presets with unique ids and labels', () => {
      expect(MOBILE_WALLPAPERS).toHaveLength(13);
      expect(new Set(MOBILE_WALLPAPERS.map((w) => w.id)).size).toBe(13);
      expect(new Set(MOBILE_WALLPAPERS.map((w) => w.label)).size).toBe(13);
      expect(MOBILE_WALLPAPERS.every((w) => w.id.startsWith('mobile-'))).toBe(true);
    });

    it('points every preset at a file that exists under public/wallpapers/mobile', () => {
      for (const wallpaper of MOBILE_WALLPAPERS) {
        const asset = cssPath(wallpaper.css);
        expect(asset).toMatch(/^\/wallpapers\/mobile\/mobile-wallpaper-\d{2}\.jpeg$/);
        expect(existsSync(path.join(process.cwd(), 'public', asset))).toBe(true);
      }
    });

    it('keeps the desktop and mobile id namespaces separate', () => {
      const desktopIds = new Set(WALLPAPERS.map((w) => w.id));
      expect(MOBILE_WALLPAPERS.some((w) => desktopIds.has(w.id))).toBe(false);
      expect(MOBILE_WALLPAPERS.some((w) => cssPath(w.css).startsWith('/wallpapers/mobile/'))).toBe(true);
    });
  });

  describe('surface resolution', () => {
    it('defaults the desktop surface to the first deck and mobile to the first mobile preset', () => {
      expect(getWallpaperState().current.id).toBe(WALLPAPERS[0].id);
      expect(getWallpaperState('mobile').current.id).toBe(MOBILE_WALLPAPERS[0].id);
    });

    it('keeps a pinned desktop wallpaper out of the mobile surface', () => {
      selectWallpaper('deck-03');
      expect(getWallpaperState().current.id).toBe('deck-03');
      expect(getWallpaperState('mobile').current.id).toBe(MOBILE_WALLPAPERS[0].id);
    });

    it('shuffles the mobile surface without touching the desktop selection', () => {
      selectWallpaper('deck-03');
      applyRandomMobileWallpaper();
      expect(getWallpaperState('mobile').current.id).not.toBe(MOBILE_WALLPAPERS[0].id);
      expect(getWallpaperState().current.id).toBe('deck-03');
    });
  });

  describe('mobile shuffle', () => {
    it('persists the picked mobile wallpaper', () => {
      applyRandomMobileWallpaper();
      const picked = getWallpaperState('mobile').current.id;
      expect(localStorage.getItem(MOBILE_KEY)).toBe(picked);
    });

    it('never repeats the wallpaper it is already showing', () => {
      let previous = getWallpaperState('mobile').current.id;
      for (let i = 0; i < 40; i += 1) {
        applyRandomMobileWallpaper();
        const next = getWallpaperState('mobile').current.id;
        expect(next).not.toBe(previous);
        previous = next;
      }
    });

    it('keeps every pick inside the mobile set', () => {
      const mobileIds = new Set(MOBILE_WALLPAPERS.map((w) => w.id));
      for (let i = 0; i < 20; i += 1) {
        applyRandomMobileWallpaper();
        expect(mobileIds.has(getWallpaperState('mobile').current.id)).toBe(true);
      }
    });
  });

  describe('custom upload', () => {
    beforeEach(() => setCustomWallpaper(CUSTOM_CSS));

    it('wins on the mobile surface', () => {
      expect(getWallpaperState('mobile').current.id).toBe('custom');
      expect(getWallpaperState('mobile').current.css).toBe(CUSTOM_CSS);
    });

    it('is never shuffled away', () => {
      applyRandomMobileWallpaper();
      expect(getWallpaperState('mobile').current.id).toBe('custom');
    });

    it('falls back to a mobile preset once it is removed', () => {
      removeCustomWallpaper();
      const current = getWallpaperState('mobile').current.id;
      expect(MOBILE_WALLPAPERS.some((w) => w.id === current)).toBe(true);
    });
  });

  it('clears the stored mobile pick on reset', () => {
    applyRandomMobileWallpaper();
    resetWallpaper();
    expect(localStorage.getItem(MOBILE_KEY)).toBeNull();
    expect(getWallpaperState('mobile').current.id).toBe(MOBILE_WALLPAPERS[0].id);
  });
});
