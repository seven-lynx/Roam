'use client';

import { useEffect, useRef, type CSSProperties, type PointerEvent } from 'react';
import { resolveSteer, type Steer } from '@/lib/steer';

export interface AnalogStickProps {
  /**
   * Discrete 4-way emit on direction change (D-pad-like). Used by RELAY, where
   * a direction change is a single steering intent.
   */
  onSteer?: (s: Steer) => void;
  /**
   * Continuous held-direction state, `null` when released or centered. Used by
   * DEBRIS, which holds a direction (thrust / rotate) for as long as the stick
   * is tilted.
   */
  onHold?: (s: Steer | null) => void;
  /** Overall stick diameter in px. */
  size?: number;
  /** Accessible label. */
  label?: string;
}

/**
 * A virtual analog stick for the in-OS games: a thumb-drag knob over a four-way
 * base. Resolves deflection through `resolveSteer` (the same axis logic as
 * swipes), emits discrete direction changes via `onSteer`, and mirrors the
 * held direction via `onHold` until release.
 */
export function AnalogStick({ onSteer, onHold, size = 96, label = 'Analog stick' }: AnalogStickProps) {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const center = useRef({ x: 0, y: 0 });
  const active = useRef(false);
  const current = useRef<Steer | null>(null);
  const onSteerRef = useRef(onSteer);
  const onHoldRef = useRef(onHold);

  useEffect(() => {
    onSteerRef.current = onSteer;
  }, [onSteer]);
  useEffect(() => {
    onHoldRef.current = onHold;
  }, [onHold]);

  const radius = size / 2;
  const knobSize = Math.round(size * 0.42);

  const placeKnob = (dx: number, dy: number) => {
    const el = knobRef.current;
    if (!el) return;
    const max = radius - knobSize / 2;
    const d = Math.hypot(dx, dy);
    const kx = d > max ? (dx / d) * max : dx;
    const ky = d > max ? (dy / d) * max : dy;
    el.style.transform = `translate(${kx}px, ${ky}px)`;
  };

  const update = (clientX: number, clientY: number) => {
    const dx = clientX - center.current.x;
    const dy = clientY - center.current.y;
    const dir = resolveSteer(dx, dy, radius * 0.28);
    placeKnob(dx, dy);
    if (dir !== current.current) {
      if (dir) onSteerRef.current?.(dir);
      current.current = dir;
      onHoldRef.current?.(dir);
    }
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const rect = baseRef.current?.getBoundingClientRect();
    if (!rect) return;
    center.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    active.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    update(e.clientX, e.clientY);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!active.current) return;
    update(e.clientX, e.clientY);
  };

  const release = () => {
    if (!active.current) return;
    active.current = false;
    placeKnob(0, 0);
    if (current.current) {
      current.current = null;
      onHoldRef.current?.(null);
    }
  };

  const baseStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    position: 'relative',
    background: 'var(--panel-3)',
    border: '1px solid var(--line)',
    touchAction: 'none',
    cursor: 'pointer',
  };

  const hintStyle: CSSProperties = {
    position: 'absolute',
    color: 'var(--muted)',
    fontSize: 12,
    lineHeight: 1,
    pointerEvents: 'none',
  };

  const knobStyle: CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: knobSize,
    height: knobSize,
    marginLeft: -knobSize / 2,
    marginTop: -knobSize / 2,
    borderRadius: '50%',
    background: 'var(--phosphor)',
    boxShadow: '0 0 8px var(--phosphor-glow)',
  };

  return (
    <div
      ref={baseRef}
      role="group"
      aria-label={label}
      style={baseStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <span style={{ ...hintStyle, left: '50%', top: 4, transform: 'translateX(-50%)' }}>▲</span>
      <span style={{ ...hintStyle, left: '50%', bottom: 4, transform: 'translateX(-50%)' }}>▼</span>
      <span style={{ ...hintStyle, left: 6, top: '50%', transform: 'translateY(-50%)' }}>◀</span>
      <span style={{ ...hintStyle, right: 6, top: '50%', transform: 'translateY(-50%)' }}>▶</span>
      <div ref={knobRef} style={knobStyle} />
    </div>
  );
}