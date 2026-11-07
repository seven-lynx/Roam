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
import { GameTimer } from '@/components/programs/GameTimer';
import { AnalogStick } from '@/components/programs/AnalogStick';
import { useControlMode } from '@/components/programs/useControlMode';
import { PROGRAMS } from '@/lib/os-programs';
import { makeRunId, WIN_LEVEL } from '@/lib/game-xp';
import { click, beep, success } from '@/lib/sfx';
import type { Steer } from '@/lib/steer';

/**
 * DEBRIS — a drift through the dead web's wreckage. Adapted from
 * zeli-web-games "Asteroids" (Apache-2.0); reskinned + relabeled. The canvas
 * draws with fixed phosphor colors (a self-contained vector program rather
 * than the OS theme).
 */

const W = 480;
const H = 560;

/** Seconds allowed per level — clear the wave before the clock runs out. */
function debrisTimeLimit(level: number): number {
  return Math.max(20, 45 - (level - 1) * 2);
}

interface Rock {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

interface DebrisState {
  ship: { x: number; y: number; angle: number; vx: number; vy: number };
  bullets: Bullet[];
  rocks: Rock[];
  score: number;
  lives: number;
  over: boolean;
  frame: number;
}

/** Spawn a wave: 5 rocks on level 1, one more each level, moving faster. */
function spawnWave(level: number): Rock[] {
  const count = 5 + (level - 1);
  const speed = 1 + (level - 1) * 0.15;
  const rocks: Rock[] = [];
  for (let i = 0; i < count; i++) {
    rocks.push({
      x: Math.random() * W,
      y: Math.random() * H * 0.3,
      vx: (Math.random() - 0.5) * 2 * speed,
      vy: (0.5 + Math.random() * 1.5) * speed,
      size: 20 + Math.random() * 15,
    });
  }
  return rocks;
}

function freshState(level = 1): DebrisState {
  return {
    ship: { x: W / 2, y: H / 2, angle: 0, vx: 0, vy: 0 },
    bullets: [],
    rocks: spawnWave(level),
    score: 0,
    lives: 3,
    over: false,
    frame: 0,
  };
}

function DebrisGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keys = useRef<Record<string, boolean>>({});
  const state = useRef<DebrisState>(freshState(1));
  const waveSpawned = useRef(1);
  const [hud, setHud] = useState({ score: 0, lives: 3, over: false });

  const { session } = useAuth();
  const [runId] = useState(() => makeRunId());
  const { mode, toggle } = useControlMode('roam-asteroids-control');
  const getScore = useCallback(() => state.current.score, []);
  const { level, phase, countdown, timeLeft, lastXp, levelRef, phaseRef, begin, completeLevel, gameOver, resetLevels } =
    useGameLevel({
      game: 'asteroids',
      userId: session?.user.id ?? null,
      runId,
      winLevel: WIN_LEVEL,
      timeLimitFor: debrisTimeLimit,
      getScore,
    });
  const completeLevelRef = useRef(completeLevel);
  const gameOverRef = useRef(gameOver);
  useEffect(() => {
    completeLevelRef.current = completeLevel;
    gameOverRef.current = gameOver;
  });

  const reset = useCallback(() => {
    state.current = freshState(1);
    keys.current = {};
    waveSpawned.current = 1;
    resetLevels();
    setHud({ score: 0, lives: 3, over: false });
  }, [resetLevels]);

  const fire = () => {
    if (state.current.over || phaseRef.current !== 'playing') return;
    const s = state.current;
    s.bullets.push({
      x: s.ship.x,
      y: s.ship.y,
      vx: Math.sin(s.ship.angle) * 6,
      vy: -Math.cos(s.ship.angle) * 6,
      life: 40,
    });
    click(520, 0.04, 0.08);
  };

  // Analog stick (STICK mode): up thrusts, left/right rotate; maps onto the same
  // `keys.current` state the rAF loop already reads, so no loop changes needed.
  const stickHold = (s: Steer | null) => {
    keys.current['ArrowUp'] = s === 'up';
    keys.current['ArrowLeft'] = s === 'left';
    keys.current['ArrowRight'] = s === 'right';
  };

  // Swipe steering (mobile): left/right rotate, up thrusts.
  const swipe = useSwipeSteer((s) => {
    if (state.current.over || phaseRef.current !== 'playing') return;
    const ship = state.current.ship;
    if (s === 'left') ship.angle -= 0.5;
    else if (s === 'right') ship.angle += 0.5;
    else if (s === 'up') {
      ship.vx += Math.sin(ship.angle) * 0.9;
      ship.vy -= Math.cos(ship.angle) * 0.9;
    }
  });

  useEffect(() => {
    reset();
  }, [reset]);

  useGameKeys(
    'asteroids',
    (e) => {
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === ' ') e.preventDefault();
      keys.current[k] = true;
      if (k === ' ') fire();
    },
    (e) => {
      keys.current[e.key] = false;
    },
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;

    const loop = () => {
      const s = state.current;
      const k = keys.current;
      const playing = phaseRef.current === 'playing' && !s.over;

      if (playing) {
        s.frame++;

        // Spawn the next wave when the level advances.
        if (waveSpawned.current !== levelRef.current) {
          s.rocks = s.rocks.concat(spawnWave(levelRef.current));
          waveSpawned.current = levelRef.current;
        }

        if (k['ArrowLeft']) s.ship.angle -= 0.08;
        if (k['ArrowRight']) s.ship.angle += 0.08;
        if (k['ArrowUp']) {
          s.ship.vx += Math.sin(s.ship.angle) * 0.15;
          s.ship.vy -= Math.cos(s.ship.angle) * 0.15;
        }
        s.ship.vx *= 0.98;
        s.ship.vy *= 0.98;
        s.ship.x = (s.ship.x + s.ship.vx + W) % W;
        s.ship.y = (s.ship.y + s.ship.vy + H) % H;

        s.bullets = s.bullets.filter((b) => {
          b.x += b.vx;
          b.y += b.vy;
          b.life--;
          return b.life > 0 && b.x > 0 && b.x < W && b.y > 0 && b.y < H;
        });

        s.rocks.forEach((a) => {
          a.x = (a.x + a.vx + W) % W;
          a.y += a.vy;
          if (a.y > H + 30) {
            a.y = -20;
            a.x = Math.random() * W;
          }
        });

        for (const b of s.bullets) {
          for (const a of s.rocks) {
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            if (Math.hypot(dx, dy) < a.size) {
              a.size = 0;
              b.life = 0;
              s.score += 10;
            }
          }
        }
        s.bullets = s.bullets.filter((b) => b.life > 0);
        s.rocks = s.rocks.filter((a) => a.size > 0);

        for (const a of s.rocks) {
          const dx = s.ship.x - a.x;
          const dy = s.ship.y - a.y;
          if (Math.hypot(dx, dy) < a.size + 8) {
            s.lives--;
            s.ship.x = W / 2;
            s.ship.y = H / 2;
            s.ship.vx = 0;
            s.ship.vy = 0;
            a.size = 0;
            if (s.lives <= 0) {
              s.over = true;
              beep();
              gameOverRef.current(s.score);
              break;
            }
          }
        }
        s.rocks = s.rocks.filter((a) => a.size > 0);

        // Wave cleared → advance to the next level.
        if (!s.over && s.rocks.length === 0) {
          success();
          completeLevelRef.current();
        }

        setHud({ score: s.score, lives: s.lives, over: s.over });
      }

      ctx.fillStyle = '#0a1518';
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = 'rgba(230,220,195,0.25)';
      for (let i = 0; i < 30; i++) {
        const sx = (i * 97 + s.frame * 0.1) % W;
        const sy = (i * 53 + s.frame * 0.05) % H;
        ctx.fillRect(sx, sy, 1, 1);
      }

      ctx.save();
      ctx.translate(s.ship.x, s.ship.y);
      ctx.rotate(s.ship.angle);
      ctx.fillStyle = '#59b3ae';
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(-8, 10);
      ctx.lineTo(8, 10);
      ctx.closePath();
      ctx.fill();
      if (k['ArrowUp']) {
        ctx.fillStyle = '#e0b45f';
        ctx.beginPath();
        ctx.moveTo(-4, 10);
        ctx.lineTo(0, 18);
        ctx.lineTo(4, 10);
        ctx.fill();
      }
      ctx.restore();

      ctx.fillStyle = '#e0b45f';
      s.bullets.forEach((b) => {
        ctx.fillRect(b.x - 1, b.y - 3, 2, 6);
      });

      s.rocks.forEach((a) => {
        ctx.fillStyle = '#8a6d33';
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#6a674b';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [levelRef, phaseRef]);

  return (
    <div style={{ flex: '1 1 auto', minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', gap: 16, fontFamily: 'var(--font-pixel)', fontSize: 12, letterSpacing: '0.08em' }}>
        <span style={{ color: 'var(--muted)' }}>
          WAVE <span style={{ color: 'var(--accent)' }}>{level}</span>
        </span>
        <span style={{ color: 'var(--muted)' }}>
          SCORE <span style={{ color: 'var(--phosphor)' }}>{hud.score}</span>
        </span>
        <span style={{ color: 'var(--muted)' }}>
          HULL <span style={{ color: 'var(--danger)' }}>{'■'.repeat(Math.max(0, hud.lives))}</span>
        </span>
        <GameTimer timeLeft={timeLeft} />
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
            overTitle="DEBRIS CLEARED"
            scoreLabel="SCORE"
            score={hud.score}
            onStart={begin}
            onRestart={reset}
          />
        </div>
      </ScaleToFit>

      {mode === 'dpad' ? (
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            style={ctrlBtn}
            onPointerDown={() => { keys.current['ArrowLeft'] = true; }}
            onPointerUp={() => { keys.current['ArrowLeft'] = false; }}
            onPointerLeave={() => { keys.current['ArrowLeft'] = false; }}
            onPointerCancel={() => { keys.current['ArrowLeft'] = false; }}
            aria-label="Rotate left"
          >
            ◀
          </button>
          <button type="button" style={ctrlBtn} onPointerDown={fire} aria-label="Fire">
            ●
          </button>
          <button
            type="button"
            style={ctrlBtn}
            onPointerDown={() => { keys.current['ArrowUp'] = true; }}
            onPointerUp={() => { keys.current['ArrowUp'] = false; }}
            onPointerLeave={() => { keys.current['ArrowUp'] = false; }}
            onPointerCancel={() => { keys.current['ArrowUp'] = false; }}
            aria-label="Thrust"
          >
            ▲
          </button>
          <button
            type="button"
            style={ctrlBtn}
            onPointerDown={() => { keys.current['ArrowRight'] = true; }}
            onPointerUp={() => { keys.current['ArrowRight'] = false; }}
            onPointerLeave={() => { keys.current['ArrowRight'] = false; }}
            onPointerCancel={() => { keys.current['ArrowRight'] = false; }}
            aria-label="Rotate right"
          >
            ▶
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 360, padding: '0 8px' }}>
          <AnalogStick onHold={stickHold} label="Flight stick" size={104} />
          <button type="button" style={fireBtn} onPointerDown={fire} aria-label="Fire">
            FIRE
          </button>
        </div>
      )}

      <button type="button" className="program-btn" onClick={toggle} style={{ fontSize: 11, padding: '2px 10px' }}>
        {mode === 'dpad' ? 'D-PAD ⇄ STICK' : 'STICK ⇄ D-PAD'}
      </button>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
        ← → ROTATE · ▲ THRUST · ● FIRE · SWIPE TO STEER
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

const fireBtn: CSSProperties = {
  // Large single-shot fire button, opposite the analog stick in STICK mode.
  width: 84,
  height: 84,
  borderRadius: '50%',
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: '0.08em',
  background: 'var(--danger)',
  color: 'var(--bg)',
  border: '1px solid var(--danger)',
  cursor: 'pointer',
  touchAction: 'manipulation',
};

export function AsteroidsProgram() {
  const { isOpen } = useWorkstation();
  if (!isOpen('asteroids')) return null;
  return (
    <ProgramWindow id="asteroids" program={PROGRAMS.asteroids}>
      <DebrisGame />
    </ProgramWindow>
  );
}
