'use client';

import { useWorkstation } from '@/components/WorkstationContext';
import { Window } from '@/components/Window';

/**
 * Diegetic "README" window — the first-run onboarding tour for the OS.
 * Auto-opens once on desktop; on handheld there's no auto-open (a home-screen
 * tile opens it manually), so the content adapts to whichever layout is active.
 */

export interface ReadmeStep {
  glyph: string;
  name: string;
  where: string;
  desc: string;
  account: boolean;
}

export const README_STEPS: ReadmeStep[] = [
  {
    glyph: '◎',
    name: 'ROAM',
    where: 'Roam key · center of the dock',
    desc: 'Tap it to pull up a random corner of the forgotten web. Also under MENU → Roam.',
    account: false,
  },
  {
    glyph: '▲ / ▼',
    name: 'RATE',
    where: 'Up / down arrows · flanking the Roam key',
    desc: 'After a page loads, vote it up or down and shape what everyone sees next.',
    account: true,
  },
  {
    glyph: '↑',
    name: 'UPLOAD URL',
    where: 'MENU → Community → Upload URL',
    desc: 'Submit a fresh page to the network for moderation.',
    account: true,
  },
  {
    glyph: '!',
    name: 'REPORT DEAD LINK',
    where: 'MENU → Community → Report broken link',
    desc: 'Flag a page as gone so it can be pulled from the rotation.',
    account: false,
  },
];

export const README_ACCOUNT_NOTE = "Rating and submitting need an account. Roaming and reporting don't.";

export function Readme() {
  const { isOpen, handheld } = useWorkstation();

  if (!isOpen('readme')) return null;

  return (
    <Window id="readme" icon={<span aria-hidden="true">✎</span>} fitContent>
      <div className="window-scroll">
        <div className="p-5 flex flex-col gap-5">
          <div className="border-b border-line pb-4">
            <h1 className="font-pixel tracking-[0.22em] text-ink text-lg">README</h1>
            <p className="font-mono text-sm text-muted mt-1">
              Welcome to ROAM. Four things do everything — here&apos;s the tour.
            </p>
          </div>

          <ol className="flex flex-col gap-3">
            {README_STEPS.map((s, i) => (
              <li key={s.name} className="flex gap-3 border border-line p-3">
                <span className="font-pixel text-phosphor shrink-0 w-8 text-center tracking-tighter" aria-hidden="true">
                  {s.glyph}
                </span>
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <p className="font-pixel tracking-[0.12em] text-ink text-xs">{s.name}</p>
                    <span className="font-mono text-[10px] text-muted">{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <p className="font-mono text-xs text-phosphor">{s.where}</p>
                  <p className="font-mono text-xs text-muted">{s.desc}</p>
                  {s.account && (
                    <p className="font-mono text-[10px] tracking-[0.14em] text-accent">ACCOUNT REQUIRED</p>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <div className="border border-line bg-panel p-3">
            <p className="font-mono text-xs text-accent leading-relaxed">
              <span aria-hidden="true">🔒 </span>
              {README_ACCOUNT_NOTE}
            </p>
          </div>

          {handheld ? (
            <div className="border-t border-line pt-4">
              <p className="font-pixel tracking-[0.18em] text-ink text-xs">ON THIS HANDHELD</p>
              <p className="font-mono text-xs text-muted mt-2 leading-relaxed">
                The <span className="text-ink">◎</span> key and <span className="text-ink">▲ / ▼</span> arrows are on the
                dock below. Tap <span className="text-ink">▤</span> (or the ALL APPS tile) to pull up the full grid —
                Upload URL and Report broken link live under Community. Windows open full-screen back here.
              </p>
            </div>
          ) : (
            <div className="border-t border-line pt-4">
              <p className="font-mono text-xs text-muted leading-relaxed">
                Everything starts from the dock at the bottom: the <span className="text-ink">◎</span> Roam key, the{' '}
                <span className="text-ink">▲ / ▼</span> rating arrows, and <span className="text-ink">▤</span> MENU.
                Upload URL and Report broken link live under MENU → Community.
              </p>
            </div>
          )}
        </div>
      </div>
    </Window>
  );
}
