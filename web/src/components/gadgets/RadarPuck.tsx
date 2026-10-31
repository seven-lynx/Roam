'use client';

import { useState } from 'react';
import { blip } from '@/lib/sfx';
import { useWorkstation } from '@/components/WorkstationContext';
import { deskArt } from '@/lib/art';

/** Handheld radar puck. Click to "ping": a blip sounds and the unit flashes. */
export function RadarPuck() {
  const { artVariant } = useWorkstation();
  const [pinging, setPinging] = useState(false);
  const ping = () => {
    blip(520, 0.12);
    setPinging(true);
    window.setTimeout(() => setPinging(false), 400);
  };
  return (
    <button type="button" className="gadget" aria-label="Radar puck. Ping." onClick={ping}>
      <img
        src={deskArt('radar', artVariant)}
        alt=""
        className="art-img transition-[filter] duration-300"
        draggable={false}
        style={{ filter: pinging ? 'brightness(1.6)' : 'none' }}
      />
    </button>
  );
}
