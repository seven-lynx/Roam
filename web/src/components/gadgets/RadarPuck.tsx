'use client';

import { useState } from 'react';
import { RadarSweep } from '@/components/RadarSweep';
import { blip } from '@/lib/sfx';

/** Handheld radar puck. Click to "ping": a blip sounds and the sweep flashes. */
export function RadarPuck() {
  const [pinging, setPinging] = useState(false);
  const ping = () => {
    blip(520, 0.12);
    setPinging(true);
    window.setTimeout(() => setPinging(false), 400);
  };
  return (
    <button type="button" className="gadget puck" aria-label="Radar puck. Ping." onClick={ping}>
      <span className="block transition-[filter] duration-300" style={{ filter: pinging ? 'brightness(1.6)' : 'none' }}>
        <RadarSweep />
      </span>
    </button>
  );
}
