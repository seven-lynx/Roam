'use client';

import { useState } from 'react';
import { click } from '@/lib/sfx';
import { useWorkstation } from '@/components/WorkstationContext';
import { deskArt } from '@/lib/art';

/** Notebook. Click to flip between the closed cover and an open spread. */
export function Notebook() {
  const { artVariant } = useWorkstation();
  const [open, setOpen] = useState(true);

  return (
    <button
      type="button"
      className="gadget"
      aria-label={open ? 'Notebook. Click to close it.' : 'Notebook. Click to open it.'}
      onClick={() => { setOpen((v) => !v); click(560); }}
    >
      <img src={deskArt(open ? 'notebook-open' : 'notebook-closed', artVariant)} alt="" className="art-img" draggable={false} />
    </button>
  );
}
