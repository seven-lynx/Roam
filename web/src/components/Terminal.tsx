'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkstation } from '@/components/WorkstationContext';
import { Window } from '@/components/Window';
import { parseCommand } from '@/lib/terminal';
import { clickHeavy, clickNav } from '@/lib/sfx';

interface Line {
  text: string;
  kind: 'input' | 'output';
}

/** In-screen command terminal — the desktop-terminal centrepiece of ROAM-OS. */
export function Terminal() {
  const { isOpen, openWindow, setFx, setSound, setVolume, setBrightness } = useWorkstation();
  const router = useRouter();
  const open = isOpen('terminal');
  const [lines, setLines] = useState<Line[]>([{ text: 'ROAM-OS terminal v2.6 — type "help"', kind: 'output' }]);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines, open]);

  const run = (raw: string) => {
    const result = parseCommand(raw);
    setLines((prev) => {
      const next = [...prev, { text: `> ${raw}`, kind: 'input' as const }];
      if (result.type === 'output') return next.concat(result.lines.map((t) => ({ text: t, kind: 'output' as const })));
      if (result.type === 'clear') return [];
      return next;
    });

    if (result.type === 'action') {
      switch (result.action) {
        case 'roam':
          clickHeavy();
          openWindow('scan');
          break;
        case 'goto':
          router.push(result.arg.startsWith('/') ? result.arg : `/${result.arg}`);
          break;
        case 'fx':
          clickNav();
          setFx(result.arg === 'on');
          break;
        case 'sound':
          clickNav();
          setSound(result.arg === 'on');
          break;
        case 'vol':
          setVolume(Number(result.arg) / 100);
          break;
        case 'brt':
          setBrightness(Number(result.arg) / 100);
          break;
      }
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    setValue('');
    run(v);
  };

  if (!open) return null;

  return (
    <Window id="terminal" icon={<span aria-hidden="true">&gt;_</span>}>
      <div ref={scrollRef} className="window-scroll font-mono text-sm leading-relaxed">
        <div className="p-3">
          {lines.map((l, i) => (
            <div key={i} className={l.kind === 'input' ? 'text-ink' : 'text-muted'}>
              {l.text || '\u00A0'}
            </div>
          ))}
        </div>
      </div>
      <form onSubmit={onSubmit} className="terminal-input">
        <span className="text-ink" aria-hidden="true">&gt;</span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-label="Terminal command"
          className="flex-1 bg-transparent outline-none text-ink"
        />
      </form>
    </Window>
  );
}