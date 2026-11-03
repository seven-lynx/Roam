'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useWorkstation } from '@/components/WorkstationContext';
import { ProgramWindow } from '@/components/programs/ProgramWindow';
import { ScaleToFit } from '@/components/programs/ScaleToFit';
import { useGameKeys } from '@/components/programs/useGameKeys';
import { PROGRAMS } from '@/lib/os-programs';
import { click, beep, success } from '@/lib/sfx';

/**
 * DEBRIS — a drift through the dead web's wreckage. Adapted from
 * zeli-web-games "Asteroids" (Apache-2.0); reskinned + relabeled. The canvas
 * draws with fixed phosphor colors (a self-contained vector program rather
 * than the OS theme).
 */

const W = 480;
const H = 560;

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

function freshState(): DebrisState {
  const rocks: Rock[] = [];
  for (let i = 0; i < 5; i++) {
    rocks.push({
      x: Math.random() * W,
      y: Math.random() * H * 0.3,
      vx: (Math.random() - 0.5) * 2,
      vy: 0.5 + Math.random() * 1.5,
      size: 20 + Math.random() * 15,
    });
  }
  return {
    ship: { x: W / 2, y: H / 2, angle: 0, vx: 0, vy: 0 },
    bullets: [],
    rocks,
    score: 0,
    lives: 3,
    over: false,
    frame: 0,
  };
}

function DebrisGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keys = useRef<Record<string, boolean>>({});
  const state = useRef<DebrisState>(freshState());
  const [hud, setHud] = useState({ score: 0, lives: 3, over: false });

  const reset = () => {
    state.current = freshState();
    keys.current = {};
    setHud({ score: 0, lives: 3, over: false });
  };

  const fire = () => {
    if (state.current.over) return;
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

  useEffect(() => {
    reset();
  }, []);

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

      if (!s.over) {
        s.frame++;
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

        if (s.frame % 60 === 0 && s.rocks.length < 8) {
          s.rocks.push({
            x: Math.random() * W,
            y: -20,
            vx: (Math.random() - 0.5) * 2,
            vy: 0.5 + Math.random(),
            size: 18 + Math.random() * 15,
          });
        }
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
              break;
            }
          }
        }
        s.rocks = s.rocks.filter((a) => a.size > 0);

        if (s.score >= 100) {
          s.over = true;
          success();
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
  }, []);

  return (
    <div style={{ flex: '1 1 auto', minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', gap: 16, fontFamily: 'var(--font-pixel)', fontSize: 12, letterSpacing: '0.08em' }}>
        <span style={{ color: 'var(--muted)' }}>
          SCORE <span style={{ color: 'var(--accent)' }}>{hud.score}/100</span>
        </span>
        <span style={{ color: 'var(--muted)' }}>
          HULL <span style={{ color: 'var(--danger)' }}>{'■'.repeat(Math.max(0, hud.lives))}</span>
        </span>
      </div>

      <ScaleToFit width={W} height={H}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{ borderRadius: 10, border: '1px solid var(--line)', background: 'var(--panel-2)' }}
        />
      </ScaleToFit>

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

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
        ← → ROTATE · ▲ THRUST · ● FIRE
      </div>

      {hud.over && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 12, color: 'var(--danger)', letterSpacing: '0.08em' }}>
            DEBRIS CLEARED
          </span>
          <button type="button" className="program-btn" onClick={reset}>
            RESTART
          </button>
        </div>
      )}
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

export function AsteroidsProgram() {
  const { isOpen } = useWorkstation();
  if (!isOpen('asteroids')) return null;
  return (
    <ProgramWindow id="asteroids" program={PROGRAMS.asteroids}>
      <DebrisGame />
    </ProgramWindow>
  );
}
