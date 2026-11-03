'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useWorkstation } from '@/components/WorkstationContext';
import { ProgramWindow } from '@/components/programs/ProgramWindow';
import { ScaleToFit } from '@/components/programs/ScaleToFit';
import { useGameKeys } from '@/components/programs/useGameKeys';
import { useSwipeSteer } from '@/components/programs/useSwipeSteer';
import { useGameLevel } from '@/components/programs/useGameLevel';
import { GameLevelOverlay } from '@/components/programs/GameLevelOverlay';
import { AnalogStick } from '@/components/programs/AnalogStick';
import { useControlMode } from '@/components/programs/useControlMode';
import { PROGRAMS } from '@/lib/os-programs';
import { makeRunId } from '@/lib/game-xp';
import { click, beep } from '@/lib/sfx';

/**
 * RELAY — the signal serpent. Adapted from zeli-web-games "Snake"
 * (Apache-2.0); reskinned to the Roam palette and relabeled.
 */

const GRID = 18;
const CELL = 28;
const PACKETS_PER_LEVEL = 5;
const BASE_SPEED = 135;
const MIN_SPEED = 68;

/** Tick interval (ms) tightens as the level climbs. */
function speedFor(level: number): number {
  return Math.max(MIN_SPEED, BASE_SPEED - (level - 1) * 8);
}

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

  const { session } = useAuth();
  const [runId] = useState(() => makeRunId());
  const { mode, toggle } = useControlMode('roam-snake-control');
  const { level, phase, countdown, lastXp, levelRef, phaseRef, begin, completeLevel, gameOver, resetLevels } =
    useGameLevel({ game: 'snake', userId: session?.user.id ?? null, runId });

  // Latest callbacks so the fixed-effect loop never closes over a stale closure.
  const completeLevelRef = useRef(completeLevel);
  const gameOverRef = useRef(gameOver);
  useEffect(() => {
    completeLevelRef.current = completeLevel;
    gameOverRef.current = gameOver;
  });

  const reset = () => {
    state.current = fresh();
    dir.current = { x: 1, y: 0 };
    resetLevels();
    setView(state.current);
  };

  const steer = (dx: number, dy: number) => {
    const d = dir.current;
    if (dx === -d.x && dy === -d.y) return; // no 180° reversals
    dir.current = { x: dx, y: dy };
  };

  const steerDir = (s: 'up' | 'down' | 'left' | 'right') => {
    if (s === 'up') steer(0, -1);
    else if (s === 'down') steer(0, 1);
    else if (s === 'left') steer(-1, 0);
    else steer(1, 0);
  };

  const swipe = useSwipeSteer(steerDir);

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
    let alive = true;
    let timer = 0;
    const tick = () => {
      if (!alive) return;
      const s = state.current;
      // Pause while the LEVEL COMPLETE / LEVEL START interstitials are shown.
      if (s.active && phaseRef.current === 'playing') {
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
          gameOverRef.current(s.score);
          setView({ ...s });
        } else {
          const next = [head, ...s.snake];
          if (head.x === s.food.x && head.y === s.food.y) {
            s.score += 1;
            s.food = spawnFood(next);
            click(660, 0.05, 0.1);
            if (s.score >= levelRef.current * PACKETS_PER_LEVEL) {
              completeLevelRef.current();
            }
          } else {
            next.pop();
          }
          s.snake = next;
          setView({ ...s });
        }
      }
      timer = window.setTimeout(tick, speedFor(levelRef.current));
    };
    timer = window.setTimeout(tick, speedFor(1));
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [levelRef, phaseRef]);

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
    <div style={{ flex: '1 1 auto', minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 12, letterSpacing: '0.1em', color: 'var(--muted)' }}>
        LVL <span style={{ color: 'var(--accent)' }}>{level}</span>
        <span style={{ margin: '0 8px' }}>·</span>
        PKT <span style={{ color: 'var(--phosphor)' }}>{view.score}</span>
      </div>

      <ScaleToFit width={GRID * CELL} height={GRID * CELL}>
        <div
          {...swipe}
          style={{
            width: GRID * CELL,
            height: GRID * CELL,
            position: 'relative',
            background: 'var(--panel-2)',
            border: '1px solid var(--line)',
            borderRadius: 6,
            overflow: 'hidden',
            touchAction: 'none',
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

        <GameLevelOverlay
          phase={phase}
          level={level}
          countdown={countdown}
          lastXp={lastXp}
          signedIn={!!session}
          overTitle="SIGNAL LOST"
          scoreLabel="PKT"
          score={view.score}
          onStart={begin}
          onRestart={reset}
        />
        </div>
      </ScaleToFit>

      {mode === 'dpad' ? (
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
      ) : (
        <AnalogStick onSteer={steerDir} label="Steering stick" />
      )}
      <button type="button" className="program-btn" onClick={toggle} style={{ fontSize: 11, padding: '2px 10px' }}>
        {mode === 'dpad' ? 'D-PAD ⇄ STICK' : 'STICK ⇄ D-PAD'}
      </button>
    </div>
  );
}

const dBtn: CSSProperties = {
  // 44px minimum touch target for the on-screen D-pad (Apple HIG / Material).
  width: 44,
  height: 44,
  fontSize: 14,
  background: 'var(--panel-3)',
  color: 'var(--fg)',
  border: '1px solid var(--line)',
  borderRadius: 6,
  cursor: 'pointer',
  touchAction: 'manipulation',
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
