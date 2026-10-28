'use client';

import { useEffect, useState } from 'react';
import { click } from '@/lib/sfx';

const CODE = [
  '> roam scan --deep dead.net',
  'link_established 0x2A',
  'for (const s of SECTORS) {',
  '  recover(s.cache);',
  '  if (s.lost) archive();',
  '}',
  'SIGNAL 82% · LAYER 7',
  'const relics = await scan();',
  '> mounting forgotten web…',
];

const MODES = ['SYNTAX', 'TRACE', 'DUMP'];

/**
 * Cyberdeck (clamshell portable). Its screen streams a looping block of code;
 * clicking cycles the header readout between modes. The code is flavour text.
 */
export function Cyberdeck() {
  const [chars, setChars] = useState(0);
  const [mode, setMode] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setChars(Number.MAX_SAFE_INTEGER);
      return;
    }
    const id = setInterval(() => setChars((c) => (c >= CODE.join('\n').length ? 0 : c + 1)), 32);
    return () => clearInterval(id);
  }, []);

  const full = CODE.join('\n');
  const shown = full.slice(0, chars);

  return (
    <button
      type="button"
      className="gadget relative block"
      aria-label="Cyberdeck streaming code. Click to switch mode."
      onClick={() => { setMode((m) => (m + 1) % MODES.length); click(820); }}
    >
      <svg viewBox="0 0 160 110" aria-hidden="true">
        <path d="M8 6h144a8 8 0 0 1 8 8v84a8 8 0 0 1-8 8H8a8 8 0 0 1-8-8V14a8 8 0 0 1 8-8z" fill="#23241d" stroke="#0e0e0b" strokeWidth="2" />
        <rect x="14" y="10" width="132" height="54" rx="4" fill="#0b1214" stroke="#59b3ae" strokeWidth="1" />
        <rect x="14" y="10" width="132" height="6" rx="3" fill="#2a2a22" />
        <circle cx="22" cy="13" r="1.8" fill="#ff2e88" />
        <text x="27" y="15" fontSize="5" fontFamily="monospace" fill="#cfc9a8">{MODES[mode]}</text>
        {/* keyboard */}
        <g>
          {Array.from({ length: 6 }).map((_, r) =>
            Array.from({ length: 14 }).map((_, k) => (
              <rect key={`${r}-${k}`} x={14 + k * 9.2} y={68 + r * 6.2} width="7.6" height="4.6" rx="1" fill="#3a3a30" />
            )),
          )}
        </g>
        <rect x="14" y="104" width="20" height="2.5" rx="1.2" fill="#6a674b" />
        <rect x="40" y="104" width="14" height="2.5" rx="1.2" fill="#6a674b" />
        <rect x="128" y="104" width="18" height="2.5" rx="1.2" fill="#6a674b" />
      </svg>
      <pre
        aria-hidden="true"
        className="pointer-events-none absolute left-[14%] top-[16%] h-[44%] w-[72%] overflow-hidden text-left font-mono text-[0.48rem] leading-[1.35] text-phosphor/90"
        style={{ textShadow: '0 0 4px var(--phosphor-glow)' }}
      >
        {shown}
        <span className="animate-pulse">▊</span>
      </pre>
    </button>
  );
}
