'use client';

import { useState } from 'react';
import { click } from '@/lib/sfx';

const PAGES = [
  {
    label: 'FIELD NOTES',
    sketch: 'spiral',
    lines: ['sector 7 → 404', 'cache dated 1999', 'where did', 'everyone go?', 'ask the archive'],
  },
  {
    label: 'SIGNAL LOG',
    sketch: 'wave',
    lines: ['pulse @ 03:00', 'listen twice,', 'reply once', 'back up first', '— wanderer'],
  },
];

/**
 * Open notebook. Left page is a hand-drawn sketch (spiral or waveform), right
 * page is cryptic field notes. Click to flip between the two spreads.
 */
export function Notebook() {
  const [page, setPage] = useState(0);
  const p = PAGES[page];

  return (
    <button
      type="button"
      className="gadget"
      aria-label="Notebook of field notes. Click to turn the page."
      onClick={() => { setPage((n) => (n + 1) % PAGES.length); click(560); }}
    >
      <svg viewBox="0 0 140 104" aria-hidden="true">
        {/* spine + cover */}
        <path d="M4 12q22-4 44 0t44 0q20 0 44 0v80q-24 0-44 0t-44 0-44 0-44 0z" fill="#c9c3a1" stroke="#5d5a3e" strokeWidth="2" />
        <line x1="70" y1="10" x2="70" y2="94" stroke="#5d5a3e" strokeWidth="1.5" />
        <line x1="70" y1="10" x2="70" y2="94" stroke="rgba(0,0,0,.25)" strokeWidth="3" />
        {/* page edges */}
        <path d="M8 14q20-4 40 0v76q-20-4-40 0z" fill="#f3edda" />
        <path d="M72 14q20-4 40 0v76q-20-4-40 0z" fill="#f3edda" />
        {/* sketch (left page) */}
        {p.sketch === 'spiral' ? (
          <path d="M28 52a18 18 0 0 1 0-26 18 18 0 0 1 26 0 18 18 0 0 1 0 26 18 18 0 0 1-26 0" fill="none" stroke="#2f6f6b" strokeWidth="1.4" opacity=".85" />
        ) : (
          <polyline points="18,60 24,40 30,52 36,28 42,48 48,34 54,46" fill="none" stroke="#2f6f6b" strokeWidth="1.6" />
        )}
        <circle cx="52" cy="30" r="2.4" fill="#ff2e88" />
        {/* notes (right page) */}
        {p.lines.map((l, i) => (
          <text key={l} x="82" y={30 + i * 11} fontSize="9" fontFamily="var(--font-hand), cursive" fill="#2b2a1d">{l}</text>
        ))}
        <text x="82" y="88" fontSize="6" fontFamily="monospace" fill="#8a6d33">{p.label}</text>
      </svg>
    </button>
  );
}
