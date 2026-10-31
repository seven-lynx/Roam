'use client';

import { click } from '@/lib/sfx';
import { useWorkstation } from '@/components/WorkstationContext';
import { deskArt } from '@/lib/art';

/** Film camera. Clicking it fires the shutter: a quick white flash over the screen. */
export function Camera() {
  const { artVariant } = useWorkstation();

  const snap = () => {
    click(1700, 0.04, 0.05);
    const screen = document.querySelector<HTMLElement>('.screen');
    if (!screen || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    screen.classList.remove('screen-flash');
    // Force a reflow so the animation restarts on rapid clicks.
    void screen.offsetWidth;
    screen.classList.add('screen-flash');
    window.setTimeout(() => screen.classList.remove('screen-flash'), 450);
  };

  return (
    <button type="button" className="gadget" aria-label="Film camera. Take a snapshot." onClick={snap}>
      <img src={deskArt('camera', artVariant)} alt="" className="art-img" draggable={false} />
    </button>
  );
}
