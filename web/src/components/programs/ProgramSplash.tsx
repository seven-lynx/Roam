'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LynxMark } from '@/components/LynxMark';
import type { Program } from '@/lib/os-programs';

export const BOOT_LINES = [
  'memtest ............ OK',
  'video .............. 7LYNX/CRT',
  'audio core ......... READY',
  'input map .......... READY',
];

/** How long the boot splash stays on screen before the program runs. */
export const SPLASH_MS = 1400;

/**
 * Diegetic boot splash shown over a program's play area the moment it mounts:
 * the 7LYNX mark, the program glyph/title/path, and a short POST-style log that
 * types out line by line. Auto-dismisses after `SPLASH_MS`, skips on any key or
 * click, and dismisses immediately for reduced-motion users.
 */
export function ProgramSplash({ program, onDone }: { program: Program; onDone: () => void }) {
  const [shown, setShown] = useState(0);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);

  // Keep the latest callback without mutating a ref during render (react-hooks/refs).
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current();
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }

    const t = window.setTimeout(finish, SPLASH_MS);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return; // Escape is the shell's window-close key
      finish();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [finish]);

  // Reveal log lines one at a time while the splash is up.
  useEffect(() => {
    if (shown >= BOOT_LINES.length) return;
    const t = window.setTimeout(() => setShown((s) => s + 1), shown === 0 ? 160 : 150);
    return () => window.clearTimeout(t);
  }, [shown]);

  return (
    <div
      className="program-splash"
      onClick={finish}
      role="status"
      aria-label={`Loading ${program.title}`}
    >
      <span className="program-splash-scanlines" aria-hidden="true" />
      <span className="program-splash-glyph" aria-hidden="true">
        {program.glyph}
      </span>
      <span className="program-splash-brand">
        <LynxMark size={16} /> 7LYNX
      </span>
      <span className="program-splash-title">{program.title}</span>
      <span className="program-splash-file">{program.file}</span>
      <span className="program-splash-tagline">{program.tagline}</span>
      <span className="program-splash-log">
        {BOOT_LINES.slice(0, shown).map((line) => (
          <span key={line}>{line}</span>
        ))}
      </span>
      <span className="program-splash-skip">press any key · click to skip</span>
    </div>
  );
}
