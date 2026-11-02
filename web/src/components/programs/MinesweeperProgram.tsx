'use client';

import { useState } from 'react';
import { useWorkstation } from '@/components/WorkstationContext';
import { ProgramWindow } from '@/components/programs/ProgramWindow';
import { PROGRAMS } from '@/lib/os-programs';
import { beep, success } from '@/lib/sfx';

/**
 * BOTFIELD.EXE — six buried bots in a six-by-six grid. Adapted from
 * zeli-web-games "Minesweeper" (Apache-2.0); reskinned + relabeled.
 */

const SIZE = 6;
const MINES = 6;

interface Cell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  count: number;
}

function createBoard(): Cell[][] {
  const board: Cell[][] = Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => ({ mine: false, revealed: false, flagged: false, count: 0 })),
  );
  let placed = 0;
  while (placed < MINES) {
    const r = Math.floor(Math.random() * SIZE);
    const c = Math.floor(Math.random() * SIZE);
    if (!board[r][c].mine) {
      board[r][c].mine = true;
      placed++;
    }
  }
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (!board[r][c].mine) {
        let cnt = 0;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc].mine) cnt++;
          }
        board[r][c].count = cnt;
      }
  return board;
}

const COUNT_COLORS = [
  '',
  'var(--phosphor)',
  'var(--phosphor-bright)',
  'var(--warn)',
  'var(--accent)',
  'var(--accent-strong)',
  'var(--danger)',
  'var(--fg)',
  'var(--muted)',
];

function BotfieldGame() {
  const [board, setBoard] = useState<Cell[][]>(createBoard);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [flagMode, setFlagMode] = useState(false);

  const flood = (b: Cell[][], sr: number, sc: number): Cell[][] => {
    const next = b.map((row) => row.map((cell) => ({ ...cell })));
    const stack: Array<[number, number]> = [[sr, sc]];
    while (stack.length) {
      const [r, c] = stack.pop()!;
      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) continue;
      const cell = next[r][c];
      if (cell.revealed || cell.flagged) continue;
      cell.revealed = true;
      if (cell.count === 0 && !cell.mine) {
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) stack.push([r + dr, c + dc]);
      }
    }
    return next;
  };

  const checkWin = (b: Cell[][]) => {
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) if (!b[r][c].mine && !b[r][c].revealed) return false;
    return true;
  };

  const reset = () => {
    setBoard(createBoard());
    setGameOver(false);
    setWon(false);
  };

  const sweep = (r: number, c: number) => {
    if (gameOver || won) return;
    if (board[r][c].flagged || board[r][c].revealed) return;
    const next = board.map((row) => row.map((cell) => ({ ...cell })));
    if (next[r][c].mine) {
      const exploded = next.map((row) => row.map((cell) => (cell.mine ? { ...cell, revealed: true } : cell)));
      setBoard(exploded);
      setGameOver(true);
      beep();
      return;
    }
    const revealed = flood(next, r, c);
    setBoard(revealed);
    if (checkWin(revealed)) {
      setWon(true);
      success();
    }
  };

  const flagCell = (r: number, c: number) => {
    if (gameOver || won) return;
    if (board[r][c].revealed) return;
    const next = board.map((row) => row.map((cell) => ({ ...cell })));
    next[r][c].flagged = !next[r][c].flagged;
    setBoard(next);
  };

  const flags = board.flat().filter((c) => c.flagged).length;
  const swept = board.flat().filter((c) => c.revealed && !c.mine).length;

  return (
    <div style={{ margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 12, letterSpacing: '0.08em', color: 'var(--muted)' }}>
        <span style={{ color: 'var(--danger)' }}>● {MINES}</span> ·{' '}
        <span style={{ color: 'var(--accent)' }}>⚑ {flags}</span> ·{' '}
        <span style={{ color: 'var(--phosphor)' }}>
          {swept}/{SIZE * SIZE - MINES}
        </span>
        {gameOver && <span style={{ color: 'var(--danger)' }}> — SECTOR COMPROMISED</span>}
        {won && <span style={{ color: 'var(--phosphor)' }}> — FIELD CLEAR</span>}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${SIZE}, 44px)`,
          gap: 2,
          padding: 4,
          background: 'var(--panel-2)',
          borderRadius: 8,
          border: won ? '2px solid var(--phosphor)' : gameOver ? '2px solid var(--danger)' : '1px solid var(--line)',
        }}
      >
        {board.flat().map((cell, idx) => {
          const r = Math.floor(idx / SIZE);
          const c = idx % SIZE;
          const shown = cell.flagged && !cell.revealed ? '⚑' : cell.revealed ? (cell.mine ? '●' : cell.count > 0 ? String(cell.count) : '') : '';
          return (
            <div
              key={idx}
              onClick={() => (flagMode ? flagCell(r, c) : sweep(r, c))}
              onContextMenu={(e) => { e.preventDefault(); flagCell(r, c); }}
              style={{
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 4,
                fontSize: 16,
                fontWeight: 700,
                cursor: cell.revealed ? 'default' : 'pointer',
                userSelect: 'none',
                touchAction: 'manipulation',
                background: cell.revealed ? (cell.mine ? 'rgba(255,92,122,0.25)' : 'var(--panel-3)') : 'var(--panel)',
                color: cell.revealed && !cell.mine ? (COUNT_COLORS[cell.count] ?? 'var(--fg)') : 'var(--fg)',
              }}
            >
              {shown}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          aria-pressed={flagMode}
          onClick={() => setFlagMode((v) => !v)}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            padding: '4px 8px',
            color: flagMode ? 'var(--accent)' : 'var(--muted)',
            background: flagMode ? 'var(--panel-3)' : 'var(--panel-2)',
            border: `1px solid ${flagMode ? 'var(--accent)' : 'var(--line)'}`,
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          ⚑ {flagMode ? 'FLAG MODE' : 'FLAG'}
        </button>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>
          {flagMode ? 'TAP to flag' : 'TAP to sweep'} · RIGHT-CLICK flag
        </span>
        {(gameOver || won) && (
          <button type="button" className="program-btn" onClick={reset}>
            RESTART
          </button>
        )}
      </div>
    </div>
  );
}

export function MinesweeperProgram() {
  const { isOpen } = useWorkstation();
  if (!isOpen('minesweeper')) return null;
  return (
    <ProgramWindow id="minesweeper" program={PROGRAMS.minesweeper}>
      <BotfieldGame />
    </ProgramWindow>
  );
}
