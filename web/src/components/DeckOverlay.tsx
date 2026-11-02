'use client';

/**
 * Paint-on overlays for the cyberdeck's non-screen surfaces: the eight key-cap
 * labels, the rotary (warp) knob label, and the two nixie-tube digits. Each is
 * projected from its named 3D object (a blank paint-on quad) to a viewport
 * fraction using the same machinery as the screen, then drawn as DOM text so the
 * OS can update it live.
 */

import { useEffect, useState } from 'react';
import type { Application } from '@splinetool/runtime';

import { measureObjectQuad } from '@/lib/screen-projection';
import type { ScreenQuad } from '@/lib/deck-framing';
import type { CameraFraming } from '@/components/WorkstationContext';
import { PRIMARY_KEYS } from '@/lib/os-nav';
import { NIXIE_MAX } from '@/lib/roam-buffer';

interface LabelDef {
  name: string;
  text: string;
}

/** Key labels follow the eight deck keys: six routes, then MENU, then COMMS. */
const KEY_LABELS: LabelDef[] = [
  ...PRIMARY_KEYS.map((k, i) => ({ name: `key-label-${i + 1}`, text: k.label })),
  { name: 'key-label-7', text: 'Menu' },
  { name: 'key-label-8', text: 'Comms' },
];

const KNOB_LABEL: LabelDef = { name: 'rotary-knob-label', text: 'Warp' };

/** Nixie digit quads, with fallbacks in case a future export renames them. */
const NIXIE_LEFT = ['nixie-digit-left', 'nixie-tube-left', 'nixie-glass-left'];
const NIXIE_RIGHT = ['nixie-digit-right', 'nixie-tube-right', 'nixie-glass-right'];

const clamp9 = (n: number) => Math.min(NIXIE_MAX, Math.max(0, Math.floor(n)));

interface Props {
  app: Application | null;
  deckReady: boolean;
  deckMode: boolean;
  viewport: { w: number; h: number };
  camera: CameraFraming;
  hot: number;
  warm: number;
}

function measure(app: Application, names: readonly string[]): ScreenQuad | null {
  return measureObjectQuad(app, names);
}

export function DeckOverlay({ app, deckReady, deckMode, viewport, camera, hot, warm }: Props) {
  const [labels, setLabels] = useState<Record<string, ScreenQuad>>({});
  const [nixies, setNixies] = useState<{ left: ScreenQuad | null; right: ScreenQuad | null }>({
    left: null,
    right: null,
  });

  // Re-project whenever the scene loads or the framing/viewport changes. The
  // front view is locked, so positions are stable between those events.
  useEffect(() => {
    if (!app || !deckReady || !deckMode || viewport.w <= 0 || viewport.h <= 0) {
      setLabels({});
      setNixies({ left: null, right: null });
      return;
    }

    // The runtime paints a beat after "loaded"; give matrices a frame to settle.
    const id = window.setTimeout(() => {
      const next: Record<string, ScreenQuad> = {};
      for (const def of [...KEY_LABELS, KNOB_LABEL]) {
        const q = measure(app, [def.name]);
        if (q) next[def.name] = q;
      }
      setLabels(next);
      setNixies({
        left: measure(app, NIXIE_LEFT),
        right: measure(app, NIXIE_RIGHT),
      });
    }, 60);

    return () => window.clearTimeout(id);
  }, [app, deckReady, deckMode, viewport.w, viewport.h, camera]);

  if (!app || !deckReady || !deckMode) return null;

  const labelEls = [...KEY_LABELS, KNOB_LABEL].map((def) => {
    const q = labels[def.name];
    if (!q) return null;
    // Key caps are tilted toward the viewer; keep the text centered in the
    // projected box. Font tracks the box height so labels stay proportional.
    const fontSize = Math.max(5, q.h * viewport.h * 0.85);
    return (
      <span
        key={def.name}
        className="deck-paint-label"
        style={{
          left: `${q.x * 100}%`,
          top: `${q.y * 100}%`,
          width: `${q.w * 100}%`,
          height: `${q.h * 100}%`,
          fontSize,
        }}
      >
        {def.text}
      </span>
    );
  });

  const nixieDigit = (quad: ScreenQuad | null, value: number, key: string) => {
    if (!quad) return null;
    const fontSize = Math.max(6, quad.h * viewport.h * 0.95);
    return (
      <span
        key={key}
        className="deck-paint-nixie"
        style={{
          left: `${quad.x * 100}%`,
          top: `${quad.y * 100}%`,
          width: `${quad.w * 100}%`,
          height: `${quad.h * 100}%`,
          fontSize,
        }}
      >
        {clamp9(value)}
      </span>
    );
  };

  return (
    <div className="deck-paint" aria-hidden="true">
      {labelEls}
      {nixieDigit(nixies.left, hot, 'nixie-hot')}
      {nixieDigit(nixies.right, warm, 'nixie-warm')}
    </div>
  );
}
