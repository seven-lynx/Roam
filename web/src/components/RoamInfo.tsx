'use client';

import Link from 'next/link';
import { useWorkstation } from '@/components/WorkstationContext';
import { Window } from '@/components/Window';

/**
 * Diegetic "ROAM INFO" window — the landing copy, how-it-works steps and
 * download links, surfaced inside the OS now that the homepage is the desktop.
 */
export function RoamInfo() {
  const { isOpen } = useWorkstation();

  if (!isOpen('info')) return null;

  return (
    <Window id="info" icon={<span aria-hidden="true">◎</span>}>
      <div className="window-scroll">
        <div className="p-5 flex flex-col gap-5">
          <div>
            <h1 className="font-pixel tracking-[0.22em] text-ink text-lg">ROAM</h1>
            <p className="font-mono text-sm text-muted mt-1">
              Scan the forgotten web. One press pulls up a random corner of the internet, rated by real people.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {[
              { n: '01', t: 'Pick your interests', d: 'Select categories you care about — discovery becomes personal.' },
              { n: '02', t: 'Get a random page', d: 'Tap Roam in your browser or Android app. One click, one page.' },
              { n: '03', t: 'Rate and refine', d: 'Up or down — your votes shape what everyone sees next.' },
            ].map((s) => (
              <div key={s.n} className="flex gap-3">
                <span className="font-pixel text-phosphor">{s.n}</span>
                <div>
                  <p className="font-mono text-sm text-ink">{s.t}</p>
                  <p className="font-mono text-xs text-muted">{s.d}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <Link href="/extensions" className="set-btn" style={{ width: 'auto' }}>Browser extension</Link>
            <Link href="/android" className="set-btn" style={{ width: 'auto' }}>Android app</Link>
            <Link href="/support-roam" className="set-btn" style={{ width: 'auto' }}>Support Roam</Link>
          </div>
        </div>
      </div>
    </Window>
  );
}
