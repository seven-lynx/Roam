'use client';

import { useWorkstation } from '@/components/WorkstationContext';
import { Window } from '@/components/Window';
import { click } from '@/lib/sfx';

/**
 * Diegetic "MOUNT DECK" loader: opened when the operator asks for the 3D
 * cyberdeck. Shows real fetch progress, a Cancel, and an OK that stays grayed
 * until the scene is fully mounted (then flips `deckMode` on).
 */
export function DeckLauncher() {
  const { isOpen, closeWindow, deckReady, deckProgress, setDeckMode } = useWorkstation();

  if (!isOpen('deck')) return null;

  const pct = Math.max(0, Math.min(100, Math.round(deckProgress * 100)));
  const done = deckReady;

  return (
    <Window id="deck" icon={<span aria-hidden="true">⛶</span>}>
      <div className="window-scroll">
        <div className="p-5 flex flex-col gap-4">
          <p className="font-pixel tracking-[0.18em] text-phosphor text-sm">MOUNT DECK</p>
          <p className="font-mono text-sm text-muted leading-relaxed">
            The OS you&rsquo;re reading runs on the <span className="text-ink">screen of a 3D cyberdeck</span>.
            This steps back from the screen so you can see the machine itself.
          </p>
          <p className="font-mono text-xs text-muted leading-relaxed">
            Streaming the deck scene — this is a one-time download (~4&nbsp;MB). While it loads, the OS stays
            exactly where it is. When the bar fills, press OK and the interface will shrink onto the deck&rsquo;s
            screen. Cancel leaves everything as-is.
          </p>

          <div
            className="deck-progress"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Deck load progress"
          >
            <div className="deck-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="font-mono text-xs text-muted tabular-nums">
            {done ? 'LINK · READY — press OK to step back from the screen' : `${pct}% · streaming deck geometry`}
          </p>

          <p className="font-mono text-[11px] text-muted leading-relaxed">
            Once mounted, use <span className="text-ink">⟳ Inspect</span> to orbit the deck and the top-right{' '}
            <span className="text-ink">⛶ DECK</span> button to return to the screen.
          </p>

          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              className="set-btn"
              onClick={() => {
                click();
                closeWindow('deck');
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!done}
              onClick={() => {
                click();
                setDeckMode(true);
                closeWindow('deck');
              }}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </Window>
  );
}
