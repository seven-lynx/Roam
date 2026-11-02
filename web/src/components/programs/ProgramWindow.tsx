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
  const [guide, setGuide] = useState(true);

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

        <div className="program-play" style={{ position: 'relative' }}>
          {children}

          {guide && (
            <div
              role="dialog"
              aria-label="Controls"
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: 16,
                textAlign: 'center',
                background: 'rgba(7,16,15,0.95)',
                zIndex: 2,
              }}
            >
              <span
                style={{
                  color: 'var(--accent)',
                  fontSize: 18,
                  letterSpacing: '0.12em',
                  fontFamily: 'var(--font-pixel)',
                }}
              >
                {program.title}
              </span>
              <span style={{ color: 'var(--phosphor)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                {program.file}
              </span>
              <p style={{ color: 'var(--fg)', fontSize: 11, margin: 0, maxWidth: 320, fontFamily: 'var(--font-mono)' }}>
                {program.tagline}
              </p>
              <p style={{ color: 'var(--accent)', fontSize: 11, margin: 0, fontFamily: 'var(--font-pixel)' }}>
                CONTROLS — {program.controls}
              </p>
              <button type="button" className="program-btn" onClick={() => setGuide(false)}>
                RUN // START
              </button>
            </div>
          )}
        </div>

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
