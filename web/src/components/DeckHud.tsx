'use client';

import { useEffect, useState } from 'react';

import { getRoamBufferSnapshot, subscribeRoamBuffer, NIXIE_MAX } from '@/lib/roam-buffer';

const clamp9 = (n: number) => Math.min(NIXIE_MAX, Math.max(0, Math.floor(n)));

/**
 * Diegetic deck status readout: a small, pointer-transparent HUD drawn over the
 * cyberdeck view (not the OS screen) that reports the prefetch buffer state. It
 * replaces the scene's own \"CYBERDECK\" control HUD (see `suppressSceneHud`) with
 * a clean READY / HOT / WARM readout — no error text.
 */
export function DeckHud() {
  const [buf, setBuf] = useState(getRoamBufferSnapshot());

  useEffect(() => subscribeRoamBuffer(() => setBuf(getRoamBufferSnapshot())), []);

  return (
    <div className="deck-hud" aria-hidden="true">
      <span className="deck-hud-led" />
      <span className="deck-hud-label">READY</span>
      <span className="deck-hud-sep">│</span>
      <span className="deck-hud-label">HOT</span>
      <span className="deck-hud-digit">{clamp9(buf.hot)}</span>
      <span className="deck-hud-label">WARM</span>
      <span className="deck-hud-digit">{clamp9(buf.warm)}</span>
    </div>
  );
}
