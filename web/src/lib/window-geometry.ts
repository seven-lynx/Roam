import { TOP_BAR_H, DOCK_H, type WindowRect } from '@/components/WorkstationContext';

/**
 * Pure window-open geometry, shared by the workstation shell (to place a window
 * when it opens) and the unit tests. Extracted so the placement rules — center
 * by default, left-of-center for anchored windows, saved-rect clamping, and the
 * work-area height clamp — are verifiable without mounting the OS.
 */

/** Default size (+ optional placement hints) for a window. */
export interface WindowDefaultSize {
  w: number;
  h: number;
  maximized?: boolean;
  /** `center` (default) or `left` — `left` sits in the left portion of the screen. */
  anchor?: 'center' | 'left';
}

export interface SavedWindowGeometry {
  rect: WindowRect;
  maximized: boolean;
}

export interface OpenRect {
  rect: WindowRect;
  maximized: boolean;
}

/** Left-anchored windows sit a quarter of the leftover space in from the left,
 *  so their center lands clearly left of the screen's midpoint (and clear of the
 *  right-hand widget rail). */
export const LEFT_ANCHOR_RATIO = 0.25;

export function computeOpenRect(
  def: WindowDefaultSize,
  saved: SavedWindowGeometry | undefined,
  sw: number,
  sh: number,
): OpenRect {
  // Clamp into the work area (below the status bar, above the dock).
  const w = Math.max(240, Math.min(saved?.rect.w ?? def.w, sw));
  const h = Math.max(160, Math.min(saved?.rect.h ?? def.h, sh - TOP_BAR_H - DOCK_H));
  const maxX = Math.max(0, sw - w);
  const maxY = Math.max(TOP_BAR_H, sh - DOCK_H - h);
  const rect: WindowRect = saved?.rect
    ? {
        x: Math.min(Math.max(0, saved.rect.x), maxX),
        y: Math.min(Math.max(TOP_BAR_H, saved.rect.y), maxY),
        w,
        h,
      }
    : {
        x:
          def.anchor === 'left'
            ? Math.max(0, Math.round((sw - w) * LEFT_ANCHOR_RATIO))
            : Math.max(0, Math.round((sw - w) / 2)),
        y: Math.max(TOP_BAR_H, Math.round(TOP_BAR_H + (sh - TOP_BAR_H - DOCK_H - h) / 2)),
        w,
        h,
      };
  const maximized = saved?.maximized ?? !!def.maximized;
  return { rect, maximized };
}
