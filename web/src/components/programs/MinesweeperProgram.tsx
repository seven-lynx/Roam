'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useWorkstation } from '@/components/WorkstationContext';
import { GameLevelOverlay } from '@/components/programs/GameLevelOverlay';
import { GameTimer } from '@/components/programs/GameTimer';
import { ProgramWindow } from '@/components/programs/ProgramWindow';
import { ScaleToFit } from '@/components/programs/ScaleToFit';
import { useGameLevel } from '@/components/programs/useGameLevel';
import { PROGRAMS } from '@/lib/os-programs';
import { makeRunId, WIN_LEVEL } from '@/lib/game-xp';
import { beep, success } from '@/lib/sfx';
import {
  type Board,
  chordReveal,
  countFlags,
  countSwept,
  createBoard,
  ensureFirstClickSafe,
  floodReveal,
  isCleared,
  revealAllMines,
  toggleFlag,
} from '@/lib/minesweeper';

/**
 * BOTFIELD — ten buried bots in an eight-by-eight grid. Adapted from
 * zeli-web-games "Minesweeper" (Apache-2.0); reskinned + relabeled.
 */

const BASE_SIZE = 8;
const BASE_MINES = 10;
const CELL = 48;

/** Grid dimension per level: 8 → 10 → 12 → … */
function sizeFor(level: number): number {
  return BASE_SIZE + (level - 1) * 2;
}

/** Buried bots per level: 10 → 15 → 20 → … */
function minesFor(level: number): number {
  return BASE_MINES + (level - 1) * 5;
}

/** Seconds allowed per level — the board grows each level, so the budget grows too. */
function botfieldTimeLimit(level: number): number {
  return Math.min(180, 45 + (level - 1) * 10);
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
  const [board, setBoard] = useState<Board>(() => createBoard(sizeFor(1), minesFor(1)));
  const [flagMode, setFlagMode] = useState(false);
  // A level's first sweep is guaranteed safe; reset whenever a fresh board deals.
  const [firstSweep, setFirstSweep] = useState(true);
  // Latest board for the level clock's game-over score (updated after render).
  const boardRef = useRef(board);
  useEffect(() => {
    boardRef.current = board;
  }, [board]);
  const getScore = useCallback(() => countSwept(boardRef.current), []);

  const { session } = useAuth();
  const [runId] = useState(() => makeRunId());
  const { level, phase, countdown, timeLeft, lastXp, phaseRef, begin, completeLevel, gameOver, resetLevels } =
    useGameLevel({
      game: 'minesweeper',
      userId: session?.user.id ?? null,
      runId,
      winLevel: WIN_LEVEL,
      timeLimitFor: botfieldTimeLimit,
      getScore,
    });

  const completeLevelRef = useRef(completeLevel);
  const gameOverRef = useRef(gameOver);
  useEffect(() => {
    completeLevelRef.current = completeLevel;
    gameOverRef.current = gameOver;
  });

  const size = sizeFor(level);
  const mines = minesFor(level);

  // A new level (or a restart back to level 1) deals a fresh board.
  const dealBoard = useCallback((lvl: number) => {
    setBoard(createBoard(sizeFor(lvl), minesFor(lvl)));
    setFirstSweep(true);
  }, []);

  useEffect(() => {
    dealBoard(level);
  }, [level, dealBoard]);

  const reset = () => {
    resetLevels();
    setFlagMode(false);
    dealBoard(1);
  };

  const flagCell = (r: number, c: number) => {
    if (phaseRef.current !== 'playing') return;
    setBoard((prev) => toggleFlag(prev, r, c));
  };

  const sweep = (r: number, c: number) => {
    if (phaseRef.current !== 'playing') return;
    const cell = board[r][c];

    // A revealed number chords: open its neighbours when the flags match.
    if (cell.revealed) {
      const { board: after, hitMine } = chordReveal(board, r, c);
      if (after === board) return; // not a satisfiable number
      setBoard(after);
      if (hitMine) {
        beep();
        gameOverRef.current(countSwept(after));
        return;
      }
      if (isCleared(after)) {
        success();
        completeLevelRef.current();
      }
      return;
    }

    if (cell.flagged) return;

    // The first sweep of a level is guaranteed safe and opens an area.
    const start = firstSweep ? ensureFirstClickSafe(board, r, c) : board;
    if (firstSweep) setFirstSweep(false);

    if (start[r][c].mine) {
      // Defensive: ensureFirstClickSafe should have cleared this.
      const exploded = revealAllMines(start);
      setBoard(exploded);
      beep();
      gameOverRef.current(countSwept(exploded));
      return;
    }

    const revealed = floodReveal(start, r, c);
    setBoard(revealed);
    if (isCleared(revealed)) {
      success();
      completeLevelRef.current();
    }
  };

  // Long-press flagging — the touch equivalent of right-click. A 450 ms hold on
  // a cell toggles its flag; a plain tap sweeps (or flags in FLAG MODE).
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);
  const suppressContext = useRef(false);
  const lastPointerType = useRef('mouse');

  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onCellPointerDown = (r: number, c: number, e: ReactPointerEvent) => {
    lastPointerType.current = e.pointerType;
    longPressFired.current = false;
    suppressContext.current = false;
    clearLongPress();
    // Only touch/pen long-press; the mouse uses right-click (contextmenu).
    if (e.pointerType !== 'mouse' && e.button === 0) {
      longPressTimer.current = window.setTimeout(() => {
        longPressTimer.current = null;
        longPressFired.current = true;
        suppressContext.current = true;
        flagCell(r, c);
      }, 450);
    }
  };

  const onCellContextMenu = (r: number, c: number, e: ReactMouseEvent) => {
    e.preventDefault();
    if (lastPointerType.current === 'mouse') {
      flagCell(r, c);
      return;
    }
    // Touch browsers may synthesise a contextmenu on long-press; ignore it if
    // our own timer already flagged, otherwise treat it as the flag gesture.
    if (suppressContext.current) return;
    clearLongPress();
    longPressFired.current = true;
    flagCell(r, c);
  };

  const onCellClick = (r: number, c: number) => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    if (flagMode) flagCell(r, c);
    else sweep(r, c);
  };

  const flags = countFlags(board);
  const swept = countSwept(board);
  const remaining = mines - flags;

  return (
    <div style={{ flex: '1 1 auto', minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 12, letterSpacing: '0.08em', color: 'var(--muted)' }}>
        LVL <span style={{ color: 'var(--accent)' }}>{level}</span>
        <span style={{ margin: '0 6px' }}>·</span>
        <span style={{ color: 'var(--danger)' }}>● {remaining}</span> ·{' '}
        <span style={{ color: 'var(--accent)' }}>⚑ {flags}</span> ·{' '}
        <span style={{ color: 'var(--phosphor)' }}>
          {swept}/{size * size - mines}
        </span>
        {timeLeft > 0 && (
          <>
            <span style={{ margin: '0 6px' }}>·</span>
            <GameTimer timeLeft={timeLeft} />
          </>
        )}
      </div>

      <ScaleToFit width={size * CELL + 24} height={size * CELL + 24}>
        <div style={{ position: 'relative' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${size}, ${CELL}px)`,
              gap: 2,
              padding: 4,
              background: 'var(--panel-2)',
              borderRadius: 8,
              border: phase === 'over' ? '2px solid var(--danger)' : '1px solid var(--line)',
            }}
          >
        {board.flat().map((cell, idx) => {
          const r = Math.floor(idx / size);
          const c = idx % size;
          const shown = cell.flagged && !cell.revealed ? '⚑' : cell.revealed ? (cell.mine ? '●' : cell.count > 0 ? String(cell.count) : '') : '';
          return (
            <div
              key={idx}
              onClick={() => onCellClick(r, c)}
              onPointerDown={(e) => onCellPointerDown(r, c, e)}
              onPointerUp={clearLongPress}
              onPointerLeave={clearLongPress}
              onPointerCancel={clearLongPress}
              onContextMenu={(e) => onCellContextMenu(r, c, e)}
              style={{
                width: CELL,
                height: CELL,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 4,
                fontSize: 16,
                fontWeight: 700,
                cursor: !cell.revealed || (!cell.mine && cell.count > 0) ? 'pointer' : 'default',
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
          <GameLevelOverlay
            phase={phase}
            level={level}
            countdown={countdown}
            lastXp={lastXp}
            signedIn={!!session}
            overTitle="SECTOR COMPROMISED"
            scoreLabel="SWEPT"
            score={swept}
            onStart={begin}
            onRestart={reset}
          />
        </div>
      </ScaleToFit>

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
          {flagMode ? 'TAP to flag' : 'TAP to sweep'} · HOLD / RIGHT-CLICK flag
        </span>
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
