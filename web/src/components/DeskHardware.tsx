'use client';

import type { CSSProperties } from 'react';
import { useWorkstation } from '@/components/WorkstationContext';
import { deskArt, type ArtSlug } from '@/lib/art';

/** A decorative hardware prop lying on the desk surface. */
function Prop({ slug, style }: { slug: ArtSlug; style: CSSProperties }) {
  const { artVariant } = useWorkstation();
  return (
    <div className="desk-prop" style={style}>
      <img src={deskArt(slug, artVariant)} alt="" className="art-img" draggable={false} />
    </div>
  );
}

/**
 * Freestanding hardware scattered on the desk around the machine: vacuum tubes,
 * nixie modules, cables and loose plates. Purely decorative — rendered behind
 * the chassis (z-index 1) and hidden below 1100px, where the chassis fills the
 * viewport and no desk surface is visible.
 */
export function DeskHardware() {
  return (
    <div className="desk-hardware" aria-hidden="true">
      <Prop slug="nixie" style={{ left: 'calc(var(--rail-w) + 2.2vw)', top: '3.5vh', width: 'min(13vw, 220px)' }} />
      <Prop slug="vacuum" style={{ right: 'calc(var(--rail-w) + 2vw)', top: '5vh', width: 'min(5.5vw, 96px)' }} />
      <Prop slug="coil-cable" style={{ right: 'calc(var(--rail-w) + 1.5vw)', bottom: '2.5vh', width: 'min(17vw, 280px)' }} />
      <Prop slug="loose-cable" style={{ left: 'calc(var(--rail-w) + 2vw)', bottom: '2vh', width: 'min(24vw, 400px)' }} />
      <Prop slug="ribbon-cable" style={{ left: 'calc(var(--rail-w) + 4vw)', top: '2vh', width: 'min(15vw, 240px)' }} />
      <Prop slug="vent" style={{ right: 'calc(var(--rail-w) + 5vw)', bottom: '6vh', width: 'min(16vw, 260px)' }} />
      <Prop slug="plaque" style={{ left: 'calc(var(--rail-w) + 6vw)', bottom: '6vh', width: 'min(18vw, 300px)' }} />
    </div>
  );
}
