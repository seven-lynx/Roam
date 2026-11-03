'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useWorkstation } from '@/components/WorkstationContext';
import { ProgramWindow } from '@/components/programs/ProgramWindow';
import { ScaleToFit } from '@/components/programs/ScaleToFit';
import { useGameKeys } from '@/components/programs/useGameKeys';
import { useSwipeSteer } from '@/components/programs/useSwipeSteer';
import { useGameLevel } from '@/components/programs/useGameLevel';
import { GameLevelOverlay } from '@/components/programs/GameLevelOverlay';
import { PROGRAMS } from '@/lib/os-programs';
import { makeRunId } from '@/lib/game-xp';
import { click, beep } from '@/lib/sfx';

/**
 * COMPILER — falling data shards. Adapted from zeli-web-games "MiniTetris"
 * (Apache-2.0); reskinned to the Roam palette + relabeled.
 */

const COLS = 10;
const ROWS = 20;
const CELL = 26;
const LINES_PER_LEVEL = 5;
const BASE_DROP_MS = 500;
const MIN_DROP_MS = 200;

/** Drop interval (ms) tightens as the level climbs. */
function speedFor(level: number): number {
  return Math.max(MIN_DROP_MS, BASE_DROP_MS - (level - 1) * 30);
}

const SHAPES: number[][][] = [
  [[1, 1, 1, 1]],
  [
    [1, 1],
    [1, 1],
  ],
  [
    [0, 1, 0],
    [1, 1, 1],
  ],
  [
    [1, 0],
    [1, 0],
    [1, 1],
  ],
  [
    [0, 1],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 1, 1],
    [1, 1, 0],
  ],
  [
    [1, 1, 0],
    [0, 1, 1],
  ],
];

const SHAPE_COLORS = [
  'var(--phosphor)',
  'var(--accent)',
  'var(--warn)',
  'var(--info)',
  'var(--accent-strong)',
  'var(--phosphor-bright)',
  'var(--danger)',
];

const emptyBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(0));

function CompilerGame() {
  const [board, setBoard] = useState<number[][]>(emptyBoard);
  const [piece, setPiece] = useState<number[][] | null>(null);
  const [pos, setPos] = useState({ r: 0, c: 3 });
  const [lines, setLines] = useState(0);
  const [active, setActive] = useState(true);
  const [shapeIdx, setShapeIdx] = useState(0);
  const linesRef = useRef(0);

  const { session } = useAuth();
  const [runId] = useState(() => makeRunId());
  const { level, phase, countdown, lastXp, levelRef, phaseRef, begin, completeLevel, gameOver, resetLevels } =
    useGameLevel({ game: 'tetris', userId: session?.user.id ?? null, runId });
  const completeLevelRef = useRef(completeLevel);
  const gameOverRef = useRef(gameOver);
  useEffect(() => {
    completeLevelRef.current = completeLevel;
    gameOverRef.current = gameOver;
  });

  const newPiece = useCallback(() => {
    const idx = Math.floor(Math.random() * SHAPES.length);
    setShapeIdx(idx);
    setPiece(SHAPES[idx]);
    setPos({ r: 0, c: Math.floor((COLS - SHAPES[idx][0].length) / 2) });
  }, []);

  useEffect(() => {
    newPiece();
  }, [newPiece]);

  const collides = useCallback((b: number[][], p: number[][] | null, r: number, c: number) => {
    if (!p) return false;
    for (let pr = 0; pr < p.length; pr++)
      for (let pc = 0; pc < p[pr].length; pc++)
        if (p[pr][pc]) {
          const nr = r + pr;
          const nc = c + pc;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || b[nr][nc]) return true;
        }
    return false;
  }, []);

  const merge = useCallback((b: number[][], p: number[][], r: number, c: number, color: number) => {
    const nb = b.map((row) => [...row]);
    for (let pr = 0; pr < p.length; pr++)
      for (let pc = 0; pc < p[pr].length; pc++) if (p[pr][pc]) nb[r + pr][c + pc] = color;
    return nb;
  }, []);

  const clearLines = useCallback((b: number[][]) => {
    const nb = b.filter((row) => row.some((c) => !c));
    const cleared = ROWS - nb.length;
    while (nb.length < ROWS) nb.unshift(Array(COLS).fill(0));
    return { board: nb, cleared };
  }, []);

  const rotate = useCallback((p: number[][]) => {
    const rows = p.length;
    const cols = p[0].length;
    return Array.from({ length: cols }, (_, c) => Array.from({ length: rows }, (_, rr) => p[rows - 1 - rr][c]));
  }, []);

  const drop = useCallback(() => {
    if (!piece || !active || phaseRef.current !== 'playing') return;
    const nr = pos.r + 1;
    if (collides(board, piece, nr, pos.c)) {
      const nb = merge(board, piece, pos.r, pos.c, shapeIdx + 1);
      const { board: cb, cleared } = clearLines(nb);
      linesRef.current += cleared;
      setLines(linesRef.current);
      setBoard(cb);
      if (cleared > 0) click(440, 0.04, 0.08);
      if (linesRef.current >= levelRef.current * LINES_PER_LEVEL) {
        completeLevelRef.current();
      }

      const idx = Math.floor(Math.random() * SHAPES.length);
      const np = SHAPES[idx];
      const nc = Math.floor((COLS - np[0].length) / 2);
      if (collides(cb, np, 0, nc)) {
        setActive(false);
        beep();
        gameOverRef.current(linesRef.current);
        return;
      }
      setShapeIdx(idx);
      setPiece(np);
      setPos({ r: 0, c: nc });
    } else {
      setPos({ r: nr, c: pos.c });
    }
  }, [piece, pos, board, shapeIdx, active, collides, merge, clearLines, levelRef, phaseRef]);

  useEffect(() => {
    if (!active || phaseRef.current !== 'playing') return;
    const t = setInterval(drop, speedFor(level));
    return () => clearInterval(t);
  }, [active, drop, level, phaseRef]);

  useGameKeys('tetris', (e) => {
    if (!piece || !active || phaseRef.current !== 'playing') return;
    e.preventDefault();
    if (e.key === 'ArrowLeft' && !collides(board, piece, pos.r, pos.c - 1)) setPos((p) => ({ ...p, c: p.c - 1 }));
    if (e.key === 'ArrowRight' && !collides(board, piece, pos.r, pos.c + 1)) setPos((p) => ({ ...p, c: p.c + 1 }));
    if (e.key === 'ArrowDown') drop();
    if (e.key === 'ArrowUp') {
      const rp = rotate(piece);
      if (!collides(board, rp, pos.r, pos.c)) setPiece(rp);
    }
  });

  const swipe = useSwipeSteer((s) => {
    if (!piece || !active || phaseRef.current !== 'playing') return;
    if (s === 'left' && !collides(board, piece, pos.r, pos.c - 1)) setPos((p) => ({ ...p, c: p.c - 1 }));
    else if (s === 'right' && !collides(board, piece, pos.r, pos.c + 1)) setPos((p) => ({ ...p, c: p.c + 1 }));
    else if (s === 'down') drop();
    else if (s === 'up') {
      const rp = rotate(piece);
      if (!collides(board, rp, pos.r, pos.c)) setPiece(rp);
    }
  });

  const restart = () => {
    setBoard(emptyBoard());
    setLines(0);
    linesRef.current = 0;
    resetLevels();
    setActive(true);
    newPiece();
  };

  const display = board.map((row) => [...row]);
  if (piece)
    for (let pr = 0; pr < piece.length; pr++)
      for (let pc = 0; pc < piece[pr].length; pc++)
        if (piece[pr][pc] && pos.r + pr >= 0) display[pos.r + pr][pos.c + pc] = shapeIdx + 1;

  return (
    <div style={{ flex: '1 1 auto', minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 12, letterSpacing: '0.08em', color: 'var(--muted)' }}>
        LVL <span style={{ color: 'var(--accent)' }}>{level}</span>
        <span style={{ margin: '0 8px' }}>·</span>
        LINES <span style={{ color: 'var(--phosphor)' }}>{lines}</span>
      </div>

      <ScaleToFit width={COLS * CELL} height={ROWS * CELL}>
        <div
          {...swipe}
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
            background: 'var(--panel-2)',
            borderRadius: 6,
            border: !active ? '2px solid var(--danger)' : '1px solid var(--line)',
            padding: 1,
            touchAction: 'none',
          }}
        >
        {display.flat().map((c, i) => (
          <div
            key={i}
            style={{
              width: CELL,
              height: CELL,
              background: c ? SHAPE_COLORS[c - 1] : 'transparent',
              border: c ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(255,255,255,0.02)',
              borderRadius: 2,
              boxShadow: c ? 'inset 0 1px 2px rgba(255,255,255,0.2)' : 'none',
            }}
          />
        ))}
        <GameLevelOverlay
          phase={phase}
          level={level}
          countdown={countdown}
          lastXp={lastXp}
          signedIn={!!session}
          overTitle="BUFFER OVERFLOW"
          scoreLabel="LINES"
          score={lines}
          onStart={begin}
          onRestart={restart}
        />
        </div>
      </ScaleToFit>

      <div style={{ display: 'flex', gap: 4 }}>
        <button type="button" style={ctrlBtn} onClick={() => !collides(board, piece, pos.r, pos.c - 1) && setPos((p) => ({ ...p, c: p.c - 1 }))}>
          ◀
        </button>
        <button
          type="button"
          style={ctrlBtn}
          onClick={() => {
            if (!piece) return;
            const rp = rotate(piece);
            if (!collides(board, rp, pos.r, pos.c)) setPiece(rp);
          }}
        >
          ↻
        </button>
        <button type="button" style={ctrlBtn} onClick={drop}>
          ▼
        </button>
        <button type="button" style={ctrlBtn} onClick={() => !collides(board, piece, pos.r, pos.c + 1) && setPos((p) => ({ ...p, c: p.c + 1 }))}>
          ▶
        </button>
      </div>
    </div>
  );
}

const ctrlBtn: CSSProperties = {
  // 44px minimum touch target (Apple HIG / Material).
  width: 44,
  height: 44,
  fontSize: 14,
  background: 'var(--panel-3)',
  color: 'var(--fg)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  cursor: 'pointer',
  touchAction: 'manipulation',
};

export function TetrisProgram() {
  const { isOpen } = useWorkstation();
  if (!isOpen('tetris')) return null;
  return (
    <ProgramWindow id="tetris" program={PROGRAMS.tetris}>
      <CompilerGame />
    </ProgramWindow>
  );
}
