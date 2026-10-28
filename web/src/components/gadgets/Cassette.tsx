'use client';

import { useState } from 'react';
import { click } from '@/lib/sfx';

/** Cassette. Press it to spin the reels (a purely visual toggle with a click). */
export function Cassette() {
  const [playing, setPlaying] = useState(false);

  return (
    <button
      type="button"
      className="gadget"
      data-on={playing}
      aria-pressed={playing}
      aria-label="Cassette tape. Toggle the reels."
      onClick={() => { setPlaying((v) => !v); click(660); }}
    >
      <svg viewBox="0 0 130 84" aria-hidden="true">
        <rect x="3" y="3" width="124" height="78" rx="6" fill="#c9c3a1" stroke="#4d4b37" strokeWidth="2" />
        <rect x="12" y="10" width="106" height="34" rx="3" fill="#efe9cf" />
        <text x="18" y="24" fontSize="9" fontFamily="var(--font-hand), cursive" fontWeight="700" fill="#2b2a1d">mixtape: dead links</text>
        <line x1="18" y1="33" x2="112" y2="33" stroke="#b8b293" strokeWidth="1" />
        <line x1="18" y1="39" x2="86" y2="39" stroke="#b8b293" strokeWidth="1" />
        <rect x="30" y="50" width="70" height="24" rx="12" fill="#1c1b15" />
        {[48, 82].map((cx) => (
          <g key={cx} className="reel">
            <circle cx={cx} cy="62" r="8" fill="#efe9cf" />
            <circle cx={cx} cy="62" r="3" fill="#1c1b15" />
            {[0, 60, 120].map((a) => (
              <rect key={a} x={cx - 0.8} y="54.5" width="1.6" height="4" fill="#1c1b15" transform={`rotate(${a} ${cx} 62)`} />
            ))}
          </g>
        ))}
        <circle cx="12" cy="74" r="2" fill="#4d4b37" />
        <circle cx="118" cy="74" r="2" fill="#4d4b37" />
        <rect x="108" y="12" width="8" height="5" rx="1" fill="#ff2e88" />
      </svg>
    </button>
  );
}
