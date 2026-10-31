'use client';

import { useEffect, useState } from 'react';
import { click } from '@/lib/sfx';
import { useWorkstation } from '@/components/WorkstationContext';
import { deskArt } from '@/lib/art';

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
  const { artVariant } = useWorkstation();
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
      <img src={deskArt('cyberdeck', artVariant)} alt="" className="art-img" draggable={false} />
      <span className="cyberdeck-mode" aria-hidden="true">{MODES[mode]}</span>
      <pre
        aria-hidden="true"
        className="cyberdeck-code pointer-events-none absolute left-[16%] top-[22%] h-[40%] w-[68%] overflow-hidden text-left font-mono text-[0.5rem] leading-[1.35] text-phosphor/90"
        style={{ textShadow: '0 0 4px var(--phosphor-glow)' }}
      >
        {shown}
        <span className="animate-pulse">▊</span>
      </pre>
    </button>
  );
}
