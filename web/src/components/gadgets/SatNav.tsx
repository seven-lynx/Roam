'use client';

import { useEffect, useRef, useState } from 'react';
import { useWorkstation } from '@/components/WorkstationContext';
import { deskArt } from '@/lib/art';

/** Sat-nav unit: the readout tracks the cursor as a pair of simulated map coordinates. */
export function SatNav() {
  const { artVariant } = useWorkstation();
  const [pos, setPos] = useState({ lat: 41.4021, lon: -81.6132 });
  const raf = useRef(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        const lat = 90 - (e.clientY / window.innerHeight) * 180;
        const lon = (e.clientX / window.innerWidth) * 360 - 180;
        setPos({ lat, lon });
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  const fmt = (n: number, p: string, m: string) => `${Math.abs(n).toFixed(3)}°${n >= 0 ? p : m}`;

  return (
    <div className="gadget relative">
      <img src={deskArt('gps', artVariant)} alt="" className="art-img" draggable={false} />
      <span className="satnav-readout" aria-hidden="true">
        {fmt(pos.lat, 'N', 'S')} · {fmt(pos.lon, 'E', 'W')}
      </span>
    </div>
  );
}
