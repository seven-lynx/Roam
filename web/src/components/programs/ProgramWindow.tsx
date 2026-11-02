'use client';

import { useState, type ReactNode } from 'react';
import { Window } from '@/components/Window';
import { LynxMark } from '@/components/LynxMark';
import type { WindowId } from '@/components/WorkstationContext';
import type { Program } from '@/lib/os-programs';

/**
 * Shared chrome for an in-OS program: the standard `Window` plus a diegetic
 * kicker (7LYNX brand + DOS path) and a toggleable ABOUT / LICENSE drawer.
 */
export function ProgramWindow({
  id,
  program,
  children,
}: {
  id: WindowId;
  program: Program;
  children: ReactNode;
}) {
  const [about, setAbout] = useState(false);

  return (
    <Window id={id} icon={<span aria-hidden="true">{program.glyph}</span>}>
      <div className="program-shell">
        <div className="program-kicker">
          <span className="program-brand">
            <LynxMark size={12} /> 7LYNX
          </span>
          <span className="program-path">{program.file}</span>
          <button
            type="button"
            className="program-about-toggle"
            aria-expanded={about}
            onClick={() => setAbout((v) => !v)}
          >
            {about ? 'CLOSE' : 'ABOUT'}
          </button>
        </div>

        <div className="program-play">{children}</div>

        {about && (
          <div className="program-about" role="note">
            <div className="program-about-head">
              <span className="kicker">{program.title}</span>
              <span className="program-about-file">{program.file}</span>
            </div>
            <p className="program-about-tagline">{program.tagline}</p>
            <p className="program-about-controls">CONTROLS — {program.controls}</p>
            <p className="program-about-license">
              <LynxMark size={11} /> {program.license.name} ({program.license.spdx}) · adapted from{' '}
              {program.source}
            </p>
          </div>
        )}
      </div>
    </Window>
  );
}
