'use client';

import { rotationFor } from '@/lib/desk-layout';
import { useWorkstation } from '@/components/WorkstationContext';
import { deskArt } from '@/lib/art';

/** A photorealistic blank instant photo, tilted deterministically. Decorative. */
export function Polaroid({ id, caption, maxTilt = 8 }: { id: string; caption: string; maxTilt?: number }) {
  const { artVariant } = useWorkstation();
  return (
    <figure
      aria-hidden="true"
      className="w-full"
      style={{ transform: `rotate(${rotationFor(id, maxTilt)}deg)` }}
    >
      <img src={deskArt('polaroid', artVariant)} alt="" className="block w-full" draggable={false} />
      <figcaption className="pt-1 text-center font-hand text-[clamp(0.7rem,1vw,0.95rem)] leading-none text-[#2b2a1d]">{caption}</figcaption>
    </figure>
  );
}
