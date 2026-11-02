'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CrtLogo } from '@/components/CrtLogo';

const POST_LINES = [
  'ROAM-OS BIOS v2.6.4',
  'MEMTEST .............. OK (65536K)',
  'DECK LINK ............ LINK',
  'SCAN PROTOCOL ........ v2.6',
  'WARP CALIBRATION ..... OK',
  'SOUND CORE ........... OK',
  'CRT DRIVER ........... LOADED',
];

type Phase = 'poweron' | 'post' | 'splash' | 'gui' | 'hidden';

/**
 * Full-viewport diegetic boot: a CRT power-on, a brief POST + splash on the
 * first boot of a session (a quick power-on on later loads), then fade to the
 * live OS. No deck dependency - the OS renders immediately and the deck mounts
 * separately. Skippable and reduced-motion aware.
 */
export function BootSequence() {
  const [phase, setPhase] = useState<Phase>('poweron');
  const [shown, setShown] = useState(0);
  const fullBootRef = useRef(false);
  const doneRef = useRef(false);

  // Decide first-boot vs quick boot once on mount.
  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    let booted = false;
    try {
      booted = !!sessionStorage.getItem('roam-booted');
      sessionStorage.setItem('roam-booted', '1');
    } catch {
      /* ignore */
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    fullBootRef.current = !reduced && !booted;
    setPhase(reduced ? 'gui' : 'poweron');
  }, []);

  // Phase timings: power-on -> POST (first boot only) -> splash -> fade to OS.
  useEffect(() => {
    if (phase === 'poweron') {
      const t = window.setTimeout(() => setPhase(fullBootRef.current ? 'post' : 'gui'), 650);
      return () => window.clearTimeout(t);
    }
    if (phase === 'post') {
      const t = window.setTimeout(() => setPhase('splash'), 1600);
      return () => window.clearTimeout(t);
    }
    if (phase === 'splash') {
      const t = window.setTimeout(() => setPhase('gui'), 950);
      return () => window.clearTimeout(t);
    }
    if (phase === 'gui') {
      const t = window.setTimeout(() => setPhase('hidden'), 620);
      return () => window.clearTimeout(t);
    }
  }, [phase]);

  // Reveal POST lines one at a time.
  useEffect(() => {
    if (phase !== 'post' || shown >= POST_LINES.length) return;
    const t = window.setTimeout(() => setShown((s) => s + 1), shown === 0 ? 140 : 130);
    return () => window.clearTimeout(t);
  }, [phase, shown]);

  const skip = useCallback(() => {
    doneRef.current = true;
    setPhase('gui');
  }, []);

  if (phase === 'hidden') return null;

  return (
    <div
      className={`boot-overlay${phase === 'poweron' ? ' boot-overlay--poweron' : ''}${phase === 'gui' ? ' boot-overlay--fade' : ''}`}
      onClick={skip}
      role="status"
      aria-live="polite"
    >
      <div className="boot-scanlines" aria-hidden="true" />
      <div className="boot-content">
        {phase === 'post' && (
          <span className="boot-post">
            {POST_LINES.slice(0, shown).map((line) => (
              <span key={line}>{line}</span>
            ))}
          </span>
        )}
        {phase === 'splash' && (
          <>
            <CrtLogo size={200} label="7Lynx" />
            <span className="boot-logo boot-logo--big">ROAM-OS LOADING</span>
          </>
        )}
        {phase === 'poweron' && <span className="boot-flash" aria-hidden="true" />}
      </div>
      {phase !== 'gui' && <span className="boot-skip">click to skip</span>}
    </div>
  );
}