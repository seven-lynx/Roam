'use client';

import { useShellMode } from '@/components/ShellModeContext';

/** Which register the notice speaks in — ROAM-OS (the wanderer voice) or Roam
 *  Classic (the plainer web-app voice). Derived from the active shell so a deep
 *  link to `/submit?found=1` always matches the surface it renders on. */
export type SubmitSignalNoticeVariant = 'roam-os' | 'classic';

const COPY: Record<SubmitSignalNoticeVariant, { kicker: string; title: string; body: string }> = {
  'roam-os': {
    kicker: '// uncharted signal',
    title: 'SIGNAL FOUND',
    body: "This page isn't in ~/roam yet. You found it first — log it and every wanderer after you gets it too.",
  },
  classic: {
    kicker: 'New signal',
    title: 'SIGNAL FOUND',
    body: "Nobody has logged this page before. Good find, wanderer — add it and it's here for everyone who comes after you.",
  },
};

/**
 * Diegetic congratulations shown on the Submit URL screen when the operator
 * upvotes a page that isn't in the catalog yet. Presentational only: the caller
 * decides when it shows (`?found=1`). Styled per shell so it reads as part of
 * the surrounding screen rather than a bolted-on banner.
 */
export function SubmitSignalNotice({ variant }: { variant: SubmitSignalNoticeVariant }) {
  const copy = COPY[variant];

  if (variant === 'classic') {
    return (
      <div
        role="status"
        className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-5 py-4 flex flex-col gap-1.5"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
          {copy.kicker}
        </p>
        <p className="text-base font-bold text-zinc-900 dark:text-white">{copy.title}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{copy.body}</p>
      </div>
    );
  }

  return (
    <div role="status" className="rounded-xl border border-gold/60 bg-panel-2/40 px-5 py-4 flex flex-col gap-1.5">
      <p className="kicker text-muted">{copy.kicker}</p>
      <p className="font-mono text-base font-semibold text-gold tracking-wide">{copy.title}</p>
      <p className="text-sm text-muted leading-relaxed">{copy.body}</p>
    </div>
  );
}

/** Convenience wrapper for `/submit`: picks the register from the active shell. */
export function useSubmitSignalVariant(): SubmitSignalNoticeVariant {
  const { mode } = useShellMode();
  return mode === 'classic' ? 'classic' : 'roam-os';
}