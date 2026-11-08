import { computeOpenRect, LEFT_ANCHOR_RATIO } from '@/lib/window-geometry';
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
