'use client';

import { click } from '@/lib/sfx';

/** Film camera. Clicking it fires the shutter: a quick white flash over the screen. */
export function Camera() {
  const snap = () => {
    click(1700, 0.04, 0.05);
    const screen = document.querySelector<HTMLElement>('.screen');
    if (!screen || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    screen.classList.remove('screen-flash');
    // Force a reflow so the animation restarts on rapid clicks.
    void screen.offsetWidth;
    screen.classList.add('screen-flash');
    window.setTimeout(() => screen.classList.remove('screen-flash'), 450);
  };

  return (
    <button type="button" className="gadget" aria-label="Film camera. Take a snapshot." onClick={snap}>
      <svg viewBox="0 0 130 90" aria-hidden="true">
        <rect x="4" y="22" width="122" height="62" rx="7" fill="#2b2a24" stroke="#0e0e0b" strokeWidth="2" />
        <rect x="4" y="22" width="122" height="22" rx="7" fill="#9b9578" />
        <rect x="4" y="38" width="122" height="46" rx="5" fill="#26251f" />
        {[0, 1, 2, 3, 4, 5, 6].map((n) => (
          <rect key={n} x={10 + n * 16} y="44" width="12" height="2" fill="#3b3a31" />
        ))}
        <rect x="14" y="10" width="26" height="14" rx="2" fill="#6a674b" stroke="#2c2b20" strokeWidth="1.5" />
        <rect x="19" y="13" width="16" height="8" fill="#0e1a1c" />
        <circle cx="90" cy="14" r="6" fill="#ff2e88" stroke="#6f0d3a" strokeWidth="1.5" />
        <circle cx="65" cy="58" r="24" fill="#16150f" stroke="#0a0a07" strokeWidth="2" />
        <circle cx="65" cy="58" r="19" fill="#1f2a2c" stroke="#59b3ae" strokeWidth="1" opacity=".9" />
        <circle cx="65" cy="58" r="11" fill="#0b1214" stroke="#3f7f7d" strokeWidth="1" />
        <circle cx="60" cy="53" r="3.2" fill="rgba(255,255,255,.4)" />
        <rect x="104" y="30" width="14" height="5" rx="2" fill="#5a573f" />
        <rect x="12" y="62" width="22" height="9" rx="2" fill="#4d4b37" />
        <text x="23" y="69" textAnchor="middle" fontSize="6" fontFamily="monospace" fill="#cfc9a8">ISO 400</text>
      </svg>
    </button>
  );
}
