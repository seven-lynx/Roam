import { computeOpenRect, clampWindowRect, measureWorkArea, LEFT_ANCHOR_RATIO } from '@/lib/window-geometry';
import { TOP_BAR_H, DOCK_H } from '@/components/WorkstationContext';

/**
 * Window-open geometry. The workstation shell calls `computeOpenRect` to place
 * a window when it opens, so these assertions cover the placement rules
 * (centered vs left-anchored) and the work-area clamping directly.
 */
describe('computeOpenRect', () => {
  const sw = 1440;
  const sh = 900;

  it('centers a normal window horizontally', () => {
    const { rect } = computeOpenRect({ w: 680, h: 720 }, undefined, sw, sh);
    expect(rect.w).toBe(680);
    expect(rect.x).toBe(Math.round((sw - rect.w) / 2));
  });

  it('anchors a `left` window left of center', () => {
    const { rect } = computeOpenRect({ w: 680, h: 720, anchor: 'left' }, undefined, sw, sh);
    expect(rect.x).toBe(Math.max(0, Math.round((sw - rect.w) * LEFT_ANCHOR_RATIO)));
    // The window's horizontal center sits in the left half of the screen.
    expect(rect.x + rect.w / 2).toBeLessThan(sw / 2);
  });

  it('clamps a saved rect into the work area', () => {
    const { rect } = computeOpenRect(
      { w: 680, h: 720 },
      { rect: { x: -200, y: 0, w: 900, h: 500 }, maximized: false },
      sw,
      sh,
    );
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(TOP_BAR_H);
    expect(rect.w).toBe(900);
    expect(rect.h).toBe(500);
  });

  it('clamps height to the work area on short screens', () => {
    const { rect } = computeOpenRect({ w: 680, h: 720 }, undefined, sw, 500);
    expect(rect.h).toBe(500 - TOP_BAR_H - DOCK_H);
  });

  it('honours a saved maximized state', () => {
    const { maximized } = computeOpenRect(
      { w: 680, h: 720 },
      { rect: { x: 0, y: TOP_BAR_H, w: 300, h: 300 }, maximized: true },
      sw,
      sh,
    );
    expect(maximized).toBe(true);
  });

  it('falls back to the default maximized flag when nothing is saved', () => {
    const { maximized } = computeOpenRect({ w: 760, h: 560, maximized: true }, undefined, sw, sh);
    expect(maximized).toBe(true);
  });
});

/**
 * `clampWindowRect` runs when the screen shrinks under an already-open window.
 * Its one unbreakable rule: the title bar (and its close button) stays inside
 * the work area, below the status bar and above the dock.
 */
describe('clampWindowRect', () => {
  it('leaves a rect that already fits untouched', () => {
    const rect = { x: 100, y: 120, w: 760, h: 560 };
    expect(clampWindowRect(rect, 1440, 900)).toEqual(rect);
  });

  it('lifts a window back below the status bar when the screen shrinks', () => {
    const rect = { x: 400, y: 500, w: 760, h: 560 };
    const out = clampWindowRect(rect, 1024, 600);
    expect(out.y).toBe(TOP_BAR_H);
    expect(out.h).toBe(600 - TOP_BAR_H - DOCK_H);
    // Horizontal overflow is pulled inside the screen too.
    expect(out.x).toBe(1024 - out.w);
    expect(out.x + out.w).toBeLessThanOrEqual(1024);
  });

  it('never places the title bar above the status bar, even on a tiny screen', () => {
    const out = clampWindowRect({ x: 0, y: 400, w: 900, h: 700 }, 400, 100);
    expect(out.y).toBe(TOP_BAR_H);
    expect(out.x).toBe(0);
    expect(out.w).toBe(400);
  });

  it('clamps a negative saved position into the work area', () => {
    const out = clampWindowRect({ x: -80, y: -200, w: 500, h: 400 }, 1280, 800);
    expect(out.x).toBe(0);
    expect(out.y).toBe(TOP_BAR_H);
  });

  it('does not grow a window that is already smaller than the screen', () => {
    const out = clampWindowRect({ x: 40, y: 60, w: 320, h: 240 }, 1280, 800);
    expect(out).toEqual({ x: 40, y: 60, w: 320, h: 240 });
  });
});

/**
 * The screen element is 0×0 for the first frames of a mount: the deck stage has
 * not been measured yet. Feeding that to `computeOpenRect` floors every window
 * at 240px wide, which is how the README used to open squashed.
 */
describe('measureWorkArea', () => {
  it('uses the screen element once it has been laid out', () => {
    expect(measureWorkArea({ clientWidth: 1280, clientHeight: 800 })).toEqual({ sw: 1280, sh: 800 });
  });

  it('falls back to the viewport while the deck stage is still unsized', () => {
    expect(measureWorkArea({ clientWidth: 0, clientHeight: 0 })).toEqual({
      sw: window.innerWidth,
      sh: window.innerHeight,
    });
  });

  it('falls back to the viewport when the screen is not mounted', () => {
    expect(measureWorkArea(null)).toEqual({ sw: window.innerWidth, sh: window.innerHeight });
  });

  it('never returns a work area narrower than computeOpenRect’s floor', () => {
    const { sw, sh } = measureWorkArea({ clientWidth: 0, clientHeight: 0 });
    expect(sw).toBeGreaterThan(240);
    expect(sh).toBeGreaterThan(240);
  });

  it('places the README at its real width from an unsized screen', () => {
    // Regression: viewport 1280×800, screen not yet laid out.
    const { sw, sh } = { sw: 1280, sh: 800 };
    const { rect } = computeOpenRect({ w: 680, h: 720, anchor: 'left' }, undefined, sw, sh);
    expect(rect.w).toBe(680);
    expect(rect.x).toBe(150);
  });
});
