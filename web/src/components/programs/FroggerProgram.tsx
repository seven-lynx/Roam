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
import { makeRunId, WIN_LEVEL } from '@/lib/game-xp';
import { click, beep, success } from '@/lib/sfx';

/**
 * FIREWALK — guide a probe packet through the dead web's perimeter. A Frogger
 * analogue reskinned to a hacking metaphor: the "frog" is a probe, the traffic
 * lanes are shifting rule-filters, the river is the dark static you cross by
 * riding carrier packets, and the five goal slots are open ports.
 */

const COLS = 13;
const ROWS = 15;
const CELL = 34;
const W = COLS * CELL;
const H = ROWS * CELL;
const START_COL = 6;
const GOAL_COLS = [1, 3, 5, 7, 9];
const GOAL_COUNT = GOAL_COLS.length;

type RowKind = 'goal' | 'buffer' | 'filter' | 'static' | 'start';

/** Top row (0) is the ports; the bottom (14) is the launch pad. */
const ROW_KINDS: RowKind[] = [
  'goal', // 0
  'buffer', // 1
  'filter', // 2
  'filter', // 3
  'buffer', // 4
  'filter', // 5
  'filter', // 6
  'buffer', // 7
  'static', // 8
  'static', // 9
  'buffer', // 10
  'filter', // 11
  'filter', // 12
  'buffer', // 13
  'start', // 14
];

interface LaneEntity {
  x: number;
  dir: 1 | -1;
  speed: number;
  cells: number;
}

interface FirewalkState {
  player: { x: number; row: number };
  ride: { entity: LaneEntity; offset: number } | null;
  lanes: Record<number, LaneEntity[]>;
  goals: boolean[];
  score: number;
  lives: number;
  over: boolean;
  frame: number;
}

/** Lane specs: row -> { direction, width in cells, base speed, gap, count }. */
const LANE_SPECS: Record<number, { dir: 1 | -1; cells: number; baseSpeed: number; gap: number; count: number }> = {
  2: { dir: 1, cells: 1, baseSpeed: 1.15, gap: 6, count: 4 },
  3: { dir: -1, cells: 1, baseSpeed: 1.35, gap: 7, count: 4 },
  5: { dir: 1, cells: 2, baseSpeed: 0.95, gap: 8, count: 3 },
  6: { dir: -1, cells: 1, baseSpeed: 1.25, gap: 6, count: 4 },
  11: { dir: 1, cells: 1, baseSpeed: 1.05, gap: 6, count: 4 },
  12: { dir: -1, cells: 2, baseSpeed: 0.85, gap: 8, count: 3 },
  8: { dir: -1, cells: 3, baseSpeed: 0.7, gap: 9, count: 3 },
  9: { dir: 1, cells: 3, baseSpeed: 0.82, gap: 9, count: 3 },
};

function buildLanes(level: number): Record<number, LaneEntity[]> {
  const scale = 1 + (level - 1) * 0.12;
  const lanes: Record<number, LaneEntity[]> = {};
  for (const [rowStr, spec] of Object.entries(LANE_SPECS)) {
    const row = Number(rowStr);
    const arr: LaneEntity[] = [];
    for (let i = 0; i < spec.count; i++) {
      arr.push({
        x: i * spec.gap * CELL + Math.random() * CELL,
        dir: spec.dir,
        speed: spec.baseSpeed * scale,
        cells: spec.cells,
      });
    }
    lanes[row] = arr;
  }
  return lanes;
}

function freshState(level: number): FirewalkState {
  return {
    player: { x: START_COL * CELL, row: ROWS - 1 },
    ride: null,
    lanes: buildLanes(level),
    goals: Array(GOAL_COUNT).fill(false),
    score: 0,
    lives: 3,
    over: false,
    frame: 0,
  };
}

// Fixed phosphor palette (a self-contained vector program, like DEBRIS).
const BG = '#0a1518';
const GRID = 'rgba(230,220,195,0.13)';
const BUFFER = 'rgba(120,150,140,0.12)';
const STATIC = '#0e1f28';
const STATIC_LINE = 'rgba(89,179,174,0.28)';
const CARRIER = '#59b3ae';
const GUARD = '#e0b45f';
const GUARD_EDGE = '#8a6d33';
const PORT = '#59b3ae';
const PORT_FILLED = '#7fe3d8';
const WALL = '#2a2418';
const PLAYER = '#7fe3d8';

function FirewalkGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef<FirewalkState>(freshState(1));
  const laneLevel = useRef(1);
  const [hud, setHud] = useState({ score: 0, lives: 3, goals: 0, over: false });

  const { session } = useAuth();
  const [runId] = useState(() => makeRunId());
  const { level, phase, countdown, lastXp, levelRef, phaseRef, begin, completeLevel, gameOver, resetLevels } =
    useGameLevel({ game: 'frogger', userId: session?.user.id ?? null, runId, winLevel: WIN_LEVEL });

  const completeLevelRef = useRef(completeLevel);
  const gameOverRef = useRef(gameOver);
  useEffect(() => {
    completeLevelRef.current = completeLevel;
    gameOverRef.current = gameOver;
  });

  const syncHud = useCallback(() => {
    const s = state.current;
    setHud({ score: s.score, lives: s.lives, goals: s.goals.filter(Boolean).length, over: s.over });
  }, []);

  const respawn = useCallback(() => {
    const s = state.current;
    s.player.x = START_COL * CELL;
    s.player.row = ROWS - 1;
    s.ride = null;
  }, []);

  const die = useCallback(() => {
    const s = state.current;
    if (s.over) return;
    s.lives -= 1;
    beep();
    if (s.lives <= 0) {
      s.over = true;
      gameOverRef.current(s.score);
    } else {
      respawn();
    }
    syncHud();
  }, [respawn, syncHud]);

  const reset = useCallback(() => {
    state.current = freshState(1);
    laneLevel.current = 1;
    resetLevels();
    syncHud();
  }, [resetLevels, syncHud]);

  const hop = (dx: number, dy: number) => {
    const s = state.current;
    if (s.over || phaseRef.current !== 'playing') return;

    // Snap back onto the grid (offsets drift while riding a carrier).
    s.player.x = Math.round(s.player.x / CELL) * CELL;
    s.ride = null;

    const nx = s.player.x + dx * CELL;
    const nrow = s.player.row + dy;
    const ncol = Math.floor(nx / CELL);

    if (nx < 0 || ncol >= COLS) {
      die();
      return;
    }
    if (nrow < 0) {
      die(); // past the top of the board
      return;
    }
    if (nrow === 0) {
      const gi = GOAL_COLS.indexOf(ncol);
      if (gi >= 0 && !s.goals[gi]) {
        s.goals[gi] = true;
        s.score += 50;
        click(660, 0.05, 0.1);
        if (s.goals.every(Boolean)) {
          success();
          completeLevelRef.current();
        }
        respawn();
        syncHud();
      } else {
        die(); // sealed cell or already-open port
      }
      return;
    }
    if (nrow >= ROWS) return; // blocked at the launch pad

    s.player.x = nx;
    s.player.row = nrow;

    if (ROW_KINDS[nrow] === 'static') {
      const lane = s.lanes[nrow] ?? [];
      const carrier = lane.find((e) => nx + CELL > e.x + 2 && nx < e.x + e.cells * CELL - 2);
      if (carrier) {
        s.ride = { entity: carrier, offset: nx - carrier.x };
      } else {
        die();
      }
    }
  };

  const hopDir = (d: 'up' | 'down' | 'left' | 'right') => {
    if (d === 'up') hop(0, -1);
    else if (d === 'down') hop(0, 1);
    else if (d === 'left') hop(-1, 0);
    else hop(1, 0);
  };

  const swipe = useSwipeSteer(hopDir);

  useGameKeys('frogger', (e) => {
    const map: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };
    const d = map[e.key];
    if (!d) return;
    e.preventDefault();
    hopDir(d);
  });

  useEffect(() => {
    reset();
  }, [reset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;

    const loop = () => {
      const s = state.current;
      const playing = phaseRef.current === 'playing' && !s.over;

      if (playing) {
        s.frame++;

        // Rebuild the lanes when the level advances.
        if (laneLevel.current !== levelRef.current) {
          laneLevel.current = levelRef.current;
          s.lanes = buildLanes(levelRef.current);
          s.goals = Array(GOAL_COUNT).fill(false);
          respawn();
        }

        // Advance every lane entity (rule-filters + carrier packets).
        for (const rowStr of Object.keys(s.lanes)) {
          for (const e of s.lanes[Number(rowStr)] ?? []) {
            const w = e.cells * CELL;
            e.x += e.dir * e.speed;
            if (e.dir === 1 && e.x > W) e.x = -w;
            else if (e.dir === -1 && e.x + w < 0) e.x = W;
          }
        }

        // Ride the carrier, or fall off the edge.
        if (s.ride) {
          s.player.x = s.ride.entity.x + s.ride.offset;
          if (s.player.x < 0 || s.player.x + CELL > W) die();
        }

        // Rule-filter collision.
        if (!s.over && ROW_KINDS[s.player.row] === 'filter') {
          const lane = s.lanes[s.player.row] ?? [];
          const px = s.player.x;
          for (const e of lane) {
            const w = e.cells * CELL;
            if (px + CELL - 4 > e.x && px + 4 < e.x + w) {
              die();
              break;
            }
          }
        }

        syncHud();
      }

      // ── Draw ─────────────────────────────────────────────────────────────
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = GRID;
      ctx.lineWidth = 1;
      for (let c = 1; c < COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(c * CELL, 0);
        ctx.lineTo(c * CELL, H);
        ctx.stroke();
      }
      for (let r = 1; r < ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * CELL);
        ctx.lineTo(W, r * CELL);
        ctx.stroke();
      }

      for (let r = 0; r < ROWS; r++) {
        const kind = ROW_KINDS[r];
        const y = r * CELL;

        if (kind === 'buffer' || kind === 'start') {
          ctx.fillStyle = BUFFER;
          ctx.fillRect(0, y, W, CELL);
        }

        if (kind === 'goal') {
          for (let c = 0; c < COLS; c++) {
            const x = c * CELL;
            const gi = GOAL_COLS.indexOf(c);
            if (gi >= 0) {
              const filled = s.goals[gi];
              ctx.fillStyle = filled ? PORT_FILLED : 'rgba(89,179,174,0.16)';
              ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
              if (!filled) {
                ctx.strokeStyle = PORT;
                ctx.strokeRect(x + 2.5, y + 2.5, CELL - 5, CELL - 5);
              }
            } else {
              ctx.fillStyle = WALL;
              ctx.fillRect(x, y, CELL, CELL);
            }
          }
        }

        if (kind === 'static') {
          ctx.fillStyle = STATIC;
          ctx.fillRect(0, y, W, CELL);
          ctx.strokeStyle = STATIC_LINE;
          ctx.beginPath();
          for (let x = 0; x <= W; x += 8) {
            const a = y + CELL / 2 + Math.sin(x * 0.3 + s.frame * 0.05) * 3;
            const b = y + CELL / 2 + Math.sin((x + 4) * 0.3 + s.frame * 0.05) * 3;
            ctx.moveTo(x, a);
            ctx.lineTo(x + 4, b);
          }
          ctx.stroke();
        }

        const lane = s.lanes[r] ?? [];
        for (const e of lane) {
          if (kind === 'static') {
            ctx.fillStyle = CARRIER;
            ctx.fillRect(e.x, y + 3, e.cells * CELL, CELL - 6);
          } else {
            ctx.fillStyle = GUARD;
            ctx.fillRect(e.x, y + 2, e.cells * CELL, CELL - 4);
            ctx.strokeStyle = GUARD_EDGE;
            ctx.strokeRect(e.x + 0.5, y + 2.5, e.cells * CELL - 1, CELL - 5);
          }
        }
      }

      // The probe packet.
      const cx = s.player.x + CELL / 2;
      const cy = s.player.row * CELL + CELL / 2;
      ctx.shadowColor = PLAYER;
      ctx.shadowBlur = 10;
      ctx.fillStyle = PLAYER;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 7);
      ctx.lineTo(cx + 7, cy);
      ctx.lineTo(cx, cy + 7);
      ctx.lineTo(cx - 7, cy);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [levelRef, phaseRef, die, respawn, syncHud]);

  return (
    <div style={{ flex: '1 1 auto', minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', gap: 14, fontFamily: 'var(--font-pixel)', fontSize: 12, letterSpacing: '0.08em' }}>
        <span style={{ color: 'var(--muted)' }}>
          DEPTH <span style={{ color: 'var(--accent)' }}>{level}</span>
        </span>
        <span style={{ color: 'var(--muted)' }}>
          SCORE <span style={{ color: 'var(--phosphor)' }}>{hud.score}</span>
        </span>
        <span style={{ color: 'var(--muted)' }}>
          PORTS <span style={{ color: 'var(--phosphor)' }}>{hud.goals}/{GOAL_COUNT}</span>
        </span>
        <span style={{ color: 'var(--muted)' }}>
          RETRY <span style={{ color: 'var(--danger)' }}>{'■'.repeat(Math.max(0, hud.lives))}</span>
        </span>
      </div>

      <ScaleToFit width={W} height={H}>
        <div {...swipe} style={{ position: 'relative', width: W, height: H, touchAction: 'none' }}>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            style={{ borderRadius: 10, border: '1px solid var(--line)', background: 'var(--panel-2)', display: 'block' }}
          />
          <GameLevelOverlay
            phase={phase}
            level={level}
            countdown={countdown}
            lastXp={lastXp}
            signedIn={!!session}
            overTitle="SIGNAL DROPPED"
            scoreLabel="SCORE"
            score={hud.score}
            onStart={begin}
            onRestart={reset}
          />
        </div>
      </ScaleToFit>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <button type="button" style={padBtn} onClick={() => hop(0, -1)} aria-label="Up">
          ▲
        </button>
        <div style={{ display: 'flex', gap: 3 }}>
          <button type="button" style={padBtn} onClick={() => hop(-1, 0)} aria-label="Left">
            ◀
          </button>
          <button type="button" style={padBtn} onClick={() => hop(0, 1)} aria-label="Down">
            ▼
          </button>
          <button type="button" style={padBtn} onClick={() => hop(1, 0)} aria-label="Right">
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}

const padBtn: CSSProperties = {
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

export function FroggerProgram() {
  const { isOpen } = useWorkstation();
  if (!isOpen('frogger')) return null;
  return (
    <ProgramWindow id="frogger" program={PROGRAMS.frogger}>
      <FirewalkGame />
    </ProgramWindow>
  );
}
