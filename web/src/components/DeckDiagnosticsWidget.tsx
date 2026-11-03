'use client';

import { useEffect, useState } from 'react';
import { useWorkstation } from '@/components/WorkstationContext';
import { getRoamBufferSnapshot, subscribeRoamBuffer, NIXIE_MAX } from '@/lib/roam-buffer';

const CONFIG_KEY = 'roam-deck-rings';

type RingKey = 'load' | 'hot' | 'warm';

/** Conky `settings_table`-style config, persisted so users can tune the layout. */
interface DeckRingConfig {
  bg: boolean;
  sweep: number;
  thickness: number;
  load: boolean;
  hot: boolean;
  warm: boolean;
}

const DEFAULT_CONFIG: DeckRingConfig = {
  bg: true,
  sweep: 240,
  thickness: 9,
  load: true,
  hot: true,
  warm: true,
};

const SWEEP_PRESETS = [180, 240, 270, 360];

function readConfig(): DeckRingConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DeckRingConfig>;
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch {
    /* storage unavailable — fall through to defaults */
  }
  return { ...DEFAULT_CONFIG };
}

function formatUptime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ── SVG arc helpers (Conky `cairo_arc` port) ────────────────────────────────
 * Angles are degrees; 0° is 12 o'clock and positive sweeps clockwise, matching
 * Conky's `-π/2` offset for the top of the ring. */
const CX = 110;
const CY = 110;

function polar(radius: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: CX + radius * Math.sin(a), y: CY - radius * Math.cos(a) };
}

function arcPath(radius: number, a0: number, a1: number): string {
  const p0 = polar(radius, a0);
  const p1 = polar(radius, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 >= a0 ? 1 : 0;
  return `M ${p0.x.toFixed(3)} ${p0.y.toFixed(3)} A ${radius} ${radius} 0 ${large} ${sweep} ${p1.x.toFixed(3)} ${p1.y.toFixed(3)}`;
}

/** A single open-arc gauge: dim background track + glowing phosphor fill. */
function RingGauge({
  radius,
  thickness,
  sweep,
  value,
  color,
}: {
  radius: number;
  thickness: number;
  sweep: number;
  value: number;
  color: string;
}) {
  const pct = Math.max(0, Math.min(1, value));
  // Open the gap toward the right (90°) instead of the bottom (180°) so the
  // concentric rings read as gauges filling from the left and facing right.
  const start = -90 - sweep / 2;
  const end = -90 + sweep / 2;
  const fillStyle = { stroke: color };

  if (sweep >= 359.9) {
    const c = 2 * Math.PI * radius;
    return (
      <g strokeWidth={thickness}>
        <circle className="deck-ring-track" cx={CX} cy={CY} r={radius} />
        <circle
          className="deck-ring-fill"
          style={fillStyle}
          cx={CX}
          cy={CY}
          r={radius}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${CX} ${CY})`}
        />
      </g>
    );
  }

  return (
    <g strokeWidth={thickness}>
      <path className="deck-ring-track" d={arcPath(radius, start, end)} />
      <path className="deck-ring-fill" style={fillStyle} d={arcPath(radius, start, start + pct * sweep)} />
    </g>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
      <path
        d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"
        fill="currentColor"
      />
      <path
        d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3.3h-4l-.4 2.7a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1l.4 2.7h4l.4-2.7a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4-2.1-1.6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
function RingConfigPanel({
  cfg,
  onUpdate,
  onClose,
}: {
  cfg: DeckRingConfig;
  onUpdate: (patch: Partial<DeckRingConfig>) => void;
  onClose: () => void;
}) {
  const chip = (on: boolean) => `deck-diag-chip${on ? ' is-on' : ''}`;
  return (
    <div className="deck-diag-panel">
      <div className="deck-diag-panel-head">
        <span>RING CONFIG</span>
        <button type="button" className="deck-diag-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="deck-diag-field">
        <span className="deck-diag-field-label">Sweep</span>
        <div className="deck-diag-chips">
          {SWEEP_PRESETS.map((s) => (
            <button
              key={s}
              type="button"
              className={chip(cfg.sweep === s)}
              onClick={() => onUpdate({ sweep: s })}
            >
              {s}°
            </button>
          ))}
        </div>
      </div>

      <label className="deck-diag-field">
        <span className="deck-diag-field-label">Thickness {cfg.thickness}</span>
        <input
          type="range"
          min={6}
          max={16}
          step={1}
          value={cfg.thickness}
          onChange={(e) => onUpdate({ thickness: Number(e.target.value) })}
        />
      </label>

      <div className="deck-diag-field">
        <span className="deck-diag-field-label">Rings</span>
        <div className="deck-diag-chips">
          <button type="button" className={chip(cfg.load)} onClick={() => onUpdate({ load: !cfg.load })}>
            Load
          </button>
          <button type="button" className={chip(cfg.hot)} onClick={() => onUpdate({ hot: !cfg.hot })}>
            Hot
          </button>
          <button type="button" className={chip(cfg.warm)} onClick={() => onUpdate({ warm: !cfg.warm })}>
            Warm
          </button>
        </div>
      </div>

      <div className="deck-diag-field deck-diag-field-row">
        <span className="deck-diag-field-label">Background</span>
        <button type="button" className={chip(cfg.bg)} onClick={() => onUpdate({ bg: !cfg.bg })}>
          {cfg.bg ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
}
/** Live deck health as Conky rings: concentric open-arc gauges in a round disc. */
export function DeckDiagnosticsWidget() {
  const { deckReady, deckRequested, deckProgress } = useWorkstation();
  const [buffer, setBuffer] = useState(getRoamBufferSnapshot);
  const [uptime, setUptime] = useState(0);
  const [cfg, setCfg] = useState<DeckRingConfig>(readConfig);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => subscribeRoamBuffer(() => setBuffer(getRoamBufferSnapshot())), []);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setUptime(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const update = (patch: Partial<DeckRingConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const link = deckReady ? 'READY' : deckRequested ? 'SYNCING' : 'STANDBY';
  const linkClass = deckReady ? 'is-ok' : deckRequested ? 'is-warn' : '';

  const loadPct = Math.max(0, Math.min(1, deckProgress));
  const hot = Math.min(buffer.hot, NIXIE_MAX);
  const warm = Math.min(buffer.warm, NIXIE_MAX);

  const rings: Array<{ key: RingKey; value: number; label: string; digit: string; color: string }> = [];
  if (cfg.load) rings.push({ key: 'load', value: loadPct, label: 'LOAD', digit: `${Math.round(deckProgress * 100)}%`, color: 'var(--phosphor)' });
  if (cfg.hot) rings.push({ key: 'hot', value: hot / NIXIE_MAX, label: 'HOT', digit: String(hot), color: 'var(--warn)' });
  if (cfg.warm) rings.push({ key: 'warm', value: warm / NIXIE_MAX, label: 'WARM', digit: String(warm), color: 'var(--accent)' });

  // Concentric radii: outer → inner, spaced so the strokes never overlap.
  const step = cfg.thickness + 9;
  const outerR = 108 - cfg.thickness / 2;
  const radiusAt = (i: number) => outerR - i * step;

  return (
    <div className={`widget deck-diag${cfg.bg ? '' : ' bg-off'}`}>
      {/* Invisible drag surface: the whole disc is a `.widget-head`, so the
          DraggableWidget wrapper can reposition from anywhere inside it. */}
      <div className="widget-head deck-diag-head" aria-hidden="true" />

      <div className="deck-diag-stage">
        {menuOpen ? (
          <RingConfigPanel cfg={cfg} onUpdate={update} onClose={() => setMenuOpen(false)} />
        ) : (
          <>
            <svg className="deck-diag-rings" viewBox="0 0 220 220" aria-hidden="true">
              <circle className="deck-diag-bezel" cx={CX} cy={CY} r={109} />
              <circle className="deck-diag-ticks" cx={CX} cy={CY} r={100} />
              {rings.map((ring, i) => (
                <RingGauge
                  key={ring.key}
                  radius={radiusAt(i)}
                  thickness={cfg.thickness}
                  sweep={cfg.sweep}
                  value={ring.value}
                  color={ring.color}
                />
              ))}
            </svg>
            <div className="deck-diag-center">
              <span className={`deck-diag-link ${linkClass}`}>LINK · {link}</span>
              <span className="deck-diag-metrics">
                {rings.length === 0 ? (
                  <span className="deck-diag-none">NO RINGS</span>
                ) : (
                  rings.map((r) => (
                    <span key={r.key} className="deck-diag-metric">
                      <em>{r.label}</em>
                      <b>{r.digit}</b>
                    </span>
                  ))
                )}
              </span>
              <span className="deck-diag-up">UP {formatUptime(uptime)}</span>
            </div>
          </>
        )}

        <div className="deck-diag-top">
          <span className="widget-title deck-diag-title">DECK DIAGNOSTICS</span>
          <button
            type="button"
            className={`deck-diag-menu${menuOpen ? ' is-open' : ''}`}
            aria-label="Configure rings"
            aria-expanded={menuOpen}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <GearIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
