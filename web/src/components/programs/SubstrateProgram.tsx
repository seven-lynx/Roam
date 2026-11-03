'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkstation } from '@/components/WorkstationContext';
import { ProgramWindow } from '@/components/programs/ProgramWindow';
import { PROGRAMS } from '@/lib/os-programs';
import { click } from '@/lib/sfx';
import { createSubstrateSession, type SubstrateSession } from '@/lib/zmachine';

/** The story is a static asset served from `web/public/stories/`. */
const STORY_URL = '/stories/zork1.z3';

/**
 * SUBSTRATE — the Zork I text adventure, rebranded to ROAM-OS lore. A thin
 * renderer over the pure `zmachine.ts` session: it streams the transcript +
 * status line and feeds typed commands back into the Z-machine. The single
 * text field uses the native soft keyboard on touch devices.
 */
function SubstrateGame() {
  const [session, setSession] = useState<SubstrateSession | null>(null);
  const [status, setStatus] = useState('');
  const [text, setText] = useState('');
  const [input, setInput] = useState('');
  const sessionRef = useRef<SubstrateSession | null>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const s = createSubstrateSession(STORY_URL, {
      onUpdate: () => {
        const cur = sessionRef.current;
        if (cur) {
          setText(cur.mainText);
          setStatus(cur.statusLine);
        }
      },
      onError: (err) => console.error('SUBSTRATE engine error:', err),
    });
    sessionRef.current = s;
    setSession(s);
    return () => {
      sessionRef.current = null;
      s.destroy();
    };
  }, []);

  // Keep the newest transcript line in view.
  useEffect(() => {
    const el = viewRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text]);

  // Strip the engine's dangling "> " prompt (our input field supplies its own).
  const displayText = useMemo(() => text.replace(/\n?>\s*$/, ''), [text]);

  const submit = () => {
    const line = input.trim();
    setInput('');
    if (!line || !session) return;
    click(440, 0.04, 0.06);
    session.send(line);
  };

  const focusInput = () => inputRef.current?.focus();

  return (
    <div className="substrate">
      <div className="substrate-status" aria-hidden="true">
        {status}
      </div>
      <div
        className="substrate-view"
        ref={viewRef}
        onClick={focusInput}
        role="log"
        aria-live="polite"
      >
        <pre className="substrate-text">{displayText || 'Loading\u2026'}</pre>
      </div>
      <form
        className="substrate-input"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <span className="substrate-prompt" aria-hidden="true">
          &gt;
        </span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="send"
          aria-label="Command"
          disabled={!session}
        />
        <button type="submit" className="substrate-send">
          SEND
        </button>
      </form>
    </div>
  );
}

export function SubstrateProgram() {
  const { isOpen } = useWorkstation();
  if (!isOpen('substrate')) return null;
  return (
    <ProgramWindow id="substrate" program={PROGRAMS.substrate}>
      <SubstrateGame />
    </ProgramWindow>
  );
}
