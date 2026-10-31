'use client';

import { useState } from 'react';
import { click } from '@/lib/sfx';
import { useWorkstation } from '@/components/WorkstationContext';
import { deskArt } from '@/lib/art';

/** Cassette. Press it to toggle "playback" (a glow + click). */
export function Cassette() {
  const { artVariant } = useWorkstation();
  const [playing, setPlaying] = useState(false);

  return (
    <button
      type="button"
      className="gadget"
      data-on={playing}
      aria-pressed={playing}
      aria-label="Cassette tape. Toggle playback."
      onClick={() => { setPlaying((v) => !v); click(660); }}
    >
      <img src={deskArt('cassette', artVariant)} alt="" className="art-img" draggable={false} />
    </button>
  );
}
