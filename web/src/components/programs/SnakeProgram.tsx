'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useWorkstation } from '@/components/WorkstationContext';
import { ProgramWindow } from '@/components/programs/ProgramWindow';
import { useGameKeys } from '@/components/programs/useGameKeys';
import { PROGRAMS } from '@/lib/os-programs';
import { click, beep } from '@/lib/sfx';

/**
 * RELAY.EXE — the signal serpent. Adapted from zeli-web-games "Snake"
 * (Apache-2.0); reskinned to the Roam palette and relabeled.
 */

const GRID = 15;
const CELL = 22;
const SPEED = 110;

type Pt = { x: number; y: number };

function spawnFood(snake: Pt[]): Pt {
  let f: Pt;
  do {
    f = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
  } while (snake.some((s) => s.x === f.x && s.y === f.y));
  return f;
}

interface RelayState {
  snake: Pt[];
  food: Pt;
  score: number;
  active: boolean;
  over: boolean;
}

function fresh(): RelayState {
  return { snake: [{ x: 7, y: 7 }], food: { x: 10, y: 10 }, score: 0, active: true, over: false };
}

function RelayGame() {
  const state = useRef<RelayState>(fresh());
  const dir = useRef<Pt>({ x: 1, y: 0 });
  const [view, setView] = useState<RelayState>(() => fresh());

  const reset = () => {
    state.current = fresh();
    dir.current = { x: 1, y: 0 };
    setView(state.current);
  };

  const steer = (dx: number, dy: number) => {
    const d = dir.current;
    if (dx === -d.x && dy === -d.y) return; // no 180° reversals
    dir.current = { x: dx, y: dy };
  };

  useGameKeys('snake', (e) => {
    const map: Record<string, Pt> = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
    };
    const nd = map[e.key];
    if (!nd) return;
    e.preventDefault();
    steer(nd.x, nd.y);
  });

  useEffect(() => {
    const loop = setInterval(() => {
      const s = state.current;
      if (!s.active) return;
      const d = dir.current;
      const head = { x: s.snake[0].x + d.x, y: s.snake[0].y + d.y };
      const hit =
        head.x < 0 ||
        head.x >= GRID ||
        head.y < 0 ||
        head.y >= GRID ||
        s.snake.some((seg) => seg.x === head.x && seg.y === head.y);
      if (hit) {
        s.active = false;
        s.over = true;
        beep();
        setView({ ...s });
        return;
      }
      const next = [head, ...s.snake];
      if (head.x === s.food.x && head.y === s.food.y) {
        s.score += 1;
        s.food = spawnFood(next);
        click(660, 0.05, 0.1);
      } else {
        next.pop();
      }
      s.snake = next;
      setView({ ...s });
    }, SPEED);
    return () => clearInterval(loop);
  }, []);

  const cellStyle = (seg: Pt, i: number): CSSProperties => {
    const isHead = i === 0;
    const opacity = 1 - (i / Math.max(1, view.snake.length)) * 0.55;
    return {
      position: 'absolute',
      left: seg.x * CELL + 1,
      top: seg.y * CELL + 1,
      width: CELL - 2,
      height: CELL - 2,
      borderRadius: isHead ? 6 : 4,
      background: isHead ? 'var(--accent-strong)' : 'var(--phosphor)',
      opacity,
      boxShadow: isHead ? '0 0 8px var(--phosphor-glow)' : 'none',
    };
  };

  return (
    <div style={{ margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 12, letterSpacing: '0.1em', color: 'var(--muted)' }}>
        PKT <span style={{ color: 'var(--phosphor)' }}>{view.score}</span>
      </div>

      <div
        style={{
          width: GRID * CELL,
          height: GRID * CELL,
          position: 'relative',
          background: 'var(--panel-2)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        {Array.from({ length: GRID * GRID }, (_, i) => {
          const x = i % GRID;
          const y = Math.floor(i / GRID);
          if ((x + y) % 3 !== 0) return null;
          return (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: x * CELL + CELL / 2 - 1,
                top: y * CELL + CELL / 2 - 1,
                width: 2,
                height: 2,
                borderRadius: '50%',
                background: 'var(--line)',
              }}
            />
          );
        })}

        {view.snake.map((seg, i) => (
          <span key={i} style={cellStyle(seg, i)} />
        ))}

        <span
          style={{
            position: 'absolute',
            left: view.food.x * CELL,
            top: view.food.y * CELL,
            width: CELL,
            height: CELL,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--accent)',
              boxShadow: '0 0 8px var(--accent)',
            }}
          />
        </span>

        {view.over && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: 'rgba(7,16,15,0.72)',
              fontFamily: 'var(--font-pixel)',
            }}
          >
            <div style={{ color: 'var(--danger)', fontSize: 16, letterSpacing: '0.12em' }}>SIGNAL LOST</div>
            <div style={{ color: 'var(--muted)', fontSize: 11 }}>PKT {view.score}</div>
            <button type="button" className="program-btn" onClick={reset}>
              RESTART
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <button type="button" style={dBtn} onClick={() => steer(0, -1)} aria-label="Up">
          ▲
        </button>
        <div style={{ display: 'flex', gap: 3 }}>
          <button type="button" style={dBtn} onClick={() => steer(-1, 0)} aria-label="Left">
            ◀
          </button>
          <button type="button" style={dBtn} onClick={() => steer(0, 1)} aria-label="Down">
            ▼
          </button>
          <button type="button" style={dBtn} onClick={() => steer(1, 0)} aria-label="Right">
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}

const dBtn: CSSProperties = {
  width: 36,
  height: 30,
  fontSize: 12,
  background: 'var(--panel-3)',
  color: 'var(--fg)',
  border: '1px solid var(--line)',
  borderRadius: 6,
  cursor: 'pointer',
};

export function SnakeProgram() {
  const { isOpen } = useWorkstation();
  if (!isOpen('snake')) return null;
  return (
    <ProgramWindow id="snake" program={PROGRAMS.snake}>
      <RelayGame />
    </ProgramWindow>
  );
}
