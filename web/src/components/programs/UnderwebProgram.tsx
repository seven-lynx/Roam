'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useWorkstation } from '@/components/WorkstationContext';
import { ProgramWindow } from '@/components/programs/ProgramWindow';
import { PROGRAMS } from '@/lib/os-programs';
import { click, success } from '@/lib/sfx';
import { awardGameXp, makeRunId } from '@/lib/game-xp';
import { createGame, runCommand, type GameState } from '@/lib/text-adventure';

/**
 * UNDERWEB — the buried-web text adventure. A thin renderer over the pure
 * `text-adventure.ts` engine: it echoes the transcript and feeds typed commands
 * back into `runCommand`. The single text field uses the native soft keyboard
 * on touch devices, so no on-screen keyboard is needed.
 */
function UnderwebGame() {
  const [state, setState] = useState<GameState>(() => createGame());
  const [input, setInput] = useState('');
  const viewRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { session } = useAuth();
  const [runId] = useState(() => makeRunId());

  // Keep the newest transcript line in view.
  useEffect(() => {
    const el = viewRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.transcript]);

  const submit = () => {
    const line = input.trim();
    setInput('');
    if (!line) return;
    click(440, 0.04, 0.06);
    const next = runCommand(state, line);
    if (next.won && !state.won) {
      success();
      if (session?.user.id) {
        void awardGameXp({ userId: session.user.id, game: 'underweb', kind: 'win', runId });
      }
    }
    setState(next);
  };

  const focusInput = () => inputRef.current?.focus();

  return (
    <div className="underweb">
      <div className="underweb-view" ref={viewRef} onClick={focusInput} role="log" aria-live="polite">
        {state.transcript.map((line, i) => (
          <p key={i} className={`underweb-line underweb-${line.kind}`}>
            {line.text}
          </p>
        ))}
      </div>
      <form
        className="underweb-input"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <span className="underweb-prompt" aria-hidden="true">
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
        />
        <button type="submit" className="underweb-send">
          SEND
        </button>
      </form>
    </div>
  );
}

export function UnderwebProgram() {
  const { isOpen } = useWorkstation();
  if (!isOpen('underweb')) return null;
  return (
    <ProgramWindow id="underweb" program={PROGRAMS.underweb}>
      <UnderwebGame />
    </ProgramWindow>
  );
}
