import type { CSSProperties, ReactNode } from 'react';
import { offsetFor, rotationFor } from '@/lib/desk-layout';
import { Cyberdeck } from '@/components/gadgets/Cyberdeck';
import { Compass } from '@/components/gadgets/Compass';
import { Camera } from '@/components/gadgets/Camera';
import { Notebook } from '@/components/gadgets/Notebook';
import { SatNav } from '@/components/gadgets/SatNav';
import { Cassette } from '@/components/gadgets/Cassette';
import { Floppy } from '@/components/gadgets/Floppy';
import { RadarPuck } from '@/components/gadgets/RadarPuck';
import { StickyNote } from '@/components/gadgets/StickyNote';
import { Polaroid } from '@/components/gadgets/Polaroid';
import { CoordTag } from '@/components/gadgets/CoordTag';

/**
 * One slot on a rail. `w` is a multiple of the rail's gadget unit (--g), so
 * every piece scales with the window and a rail can never overflow it.
 * Tilt and sideways nudge come from the id, which keeps the desk looking
 * scattered but identical on server and client.
 */
function Slot({ id, w, tilt = 3, nudge = 8, children }: { id: string; w: number; tilt?: number; nudge?: number; children: ReactNode }) {
  const style: CSSProperties = {
    width: `calc(var(--g) * ${w})`,
    maxWidth: '100%',
    transform: `translateX(${offsetFor(id, nudge)}%) rotate(${rotationFor(id, tilt)}deg)`,
  };
  return <div style={style}>{children}</div>;
}

/** Left side of the desk: field kit and navigation gear. */
export function LeftRail() {
  return (
    <aside className="rail rail--left" aria-label="Desk: field kit">
      <Slot id="l-crt" w={1.25} tilt={-3}><Notebook /></Slot>
      <Slot id="l-note1" w={1.15} tilt={5}>
        <StickyNote id="l-note1" text="check the old forum sector. something still answers there" />
      </Slot>
      <Slot id="l-hand" w={1.1} tilt={-6}><Cyberdeck /></Slot>
      <Slot id="l-tag1" w={1} tilt={2}><CoordTag>SECTOR 07 // 41.40N 81.61W</CoordTag></Slot>
      <Slot id="l-nav" w={1.2} tilt={4}><SatNav /></Slot>
      <Slot id="l-compass" w={0.8} tilt={0} nudge={14}><Compass /></Slot>
    </aside>
  );
}

/** Right side of the desk: recording gear, media and ephemera. */
export function RightRail() {
  return (
    <aside className="rail rail--right" aria-label="Desk: recording gear">
      <Slot id="r-cam" w={1.2} tilt={4}><Camera /></Slot>
      <Slot id="r-note1" w={1.1} tilt={-4}>
        <StickyNote id="r-note1" text="don't trust the 404s" color="pink" />
      </Slot>
      <Slot id="r-radar" w={0.78} tilt={0} nudge={12}><RadarPuck /></Slot>
      <Slot id="r-polaroid" w={0.95} tilt={7}><Polaroid id="r-polaroid" caption="last seen: 1999" scene="skyline" /></Slot>
      <Slot id="r-cass" w={1.2} tilt={-3}><Cassette /></Slot>
      <Slot id="r-floppy" w={0.82} tilt={5}><Floppy /></Slot>
      <Slot id="r-note2" w={1} tilt={3}>
        <StickyNote id="r-note2" text="back up everything" color="mint" />
      </Slot>
    </aside>
  );
}
