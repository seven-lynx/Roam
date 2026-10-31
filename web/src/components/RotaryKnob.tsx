'use client';

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useWorkstation } from '@/components/WorkstationContext';
import { deskArt } from '@/lib/art';

const SWEEP = 270;
const MIN_ANGLE = -135;

interface RotaryKnobProps {
  label: string;
  /** Current value in 0..1. */
  value: number;
  onChange: (v: number) => void;
  /** Fired on a click (no drag) - e.g. toggling mute. */
  onPress?: () => void;
  /** Visual "pushed" state (e.g. muted). */
  pressed?: boolean;
  detents?: number;
}

/**
 * A functional rotary control: drag in a circle to change the value (with
 * detents), arrow keys / Home / End to step, and click (or Enter/Space) to
 * press. Pointer-captured so the gesture keeps working outside the knob.
 */
export function RotaryKnob({ label, value, onChange, onPress, pressed = false, detents = 40 }: RotaryKnobProps) {
  const [dragging, setDragging] = useState(false);
  const { artVariant } = useWorkstation();
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ start: number; last: number; moved: boolean }>({ start: 0, last: 0, moved: false });

  const clamped = Math.min(1, Math.max(0, value));
  const angle = MIN_ANGLE + clamped * SWEEP;

  const angleAt = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { start: clamped, last: angleAt(e), moved: false };
    setDragging(true);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const a = angleAt(e);
    let delta = a - drag.current.last;
    if (delta > 180) delta -= 360;
    else if (delta < -180) delta += 360;
    drag.current.last = a;
    if (Math.abs(delta) > 1.5) drag.current.moved = true;
    const next = Math.min(1, Math.max(0, drag.current.start + delta / SWEEP));
    drag.current.start = next;
    onChange(next);
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
    if (!drag.current.moved && onPress) onPress();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = 1 / detents;
    let next: number | null = null;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(0, clamped - step);
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(1, clamped + step);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = 1;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPress?.();
      return;
    }
    if (next !== null) {
      e.preventDefault();
      onChange(next);
    }
  };

  return (
    <div className="knob-control">
      <div
        ref={ref}
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
        aria-valuetext={`${Math.round(clamped * 100)}%`}
        tabIndex={0}
        className={`knob${dragging ? ' is-dragging' : ''}${pressed ? ' is-pressed' : ''}`}
        style={{ transform: `rotate(${angle}deg)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <img src={deskArt('knob', artVariant)} alt="" className="knob-img" draggable={false} />
      </div>
      <span className="knob-label">{label}</span>
    </div>
  );
}