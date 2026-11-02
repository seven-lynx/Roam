'use client';

import { useWorkstation } from '@/components/WorkstationContext';

/**
 * Decorative CRT overlay: aperture grille, scanlines, analog grain, animated
 * static, edge fringing, a vignette and a brightness flicker, plus a
 * curved-glass "barrel" layer whose strength follows the warp slider. Scoped
 * to the screen; pointer-events are disabled so it never blocks input, and the
 * FX switch hides the whole layer set via the `.crt-layer` class.
 */
export function TerminalOverlay() {
  const { warp, displayFx } = useWorkstation();
  return (
    <div aria-hidden="true" className="crt-layer pointer-events-none absolute inset-0 z-[45] overflow-hidden">
      {displayFx.grille && <div className="crt-grille absolute inset-0" />}
      {displayFx.scanlines && <div className="crt-scanlines absolute inset-0" />}
      {displayFx.grain && <div className="crt-grain absolute inset-0" />}
      {displayFx.static && <div className="crt-static absolute inset-0" />}
      {displayFx.fringe && <div className="crt-fringe absolute inset-0" />}
      {displayFx.vignette && <div className="crt-vignette absolute inset-0" />}
      {displayFx.flicker && <div className="crt-flicker absolute inset-0" />}
      {displayFx.curvature && <div className="crt-curvature absolute inset-0" style={{ opacity: warp }} />}
    </div>
  );
}
