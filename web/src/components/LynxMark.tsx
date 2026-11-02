'use client';

import type { CSSProperties } from 'react';

/**
 * The 7Lynx mark as a vector-monitor line drawing: the numeral "7" built from
 * angular strokes with a lynx ear-tuft and slanted eye. Rendered `stroke`-only
 * (no fill) and animated like a slowly-refreshing CRT — a dashoffset redraw
 * loop plus a traveling scanline sweep. Follows `--phosphor` / `--phosphor-glow`.
 */
export function LynxMark({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`lynx-mark${className ? ` ${className}` : ''}`}
      style={{ '--lynx-size': `${size}px` } as CSSProperties}
      role="img"
      aria-label="7Lynx"
    >
      <svg viewBox="0 0 48 48" className="lynx-mark-svg" aria-hidden="true">
        <path className="lynx-stroke" pathLength={1} d="M10 9 H38 L22 39" />
        <path className="lynx-stroke" pathLength={1} d="M10 39 H26" />
        <path className="lynx-stroke" pathLength={1} d="M10 9 L6 3 L14 6 Z" />
        <path className="lynx-stroke" pathLength={1} d="M29 26 L36 24 L33 31 Z" />
      </svg>
      <span className="lynx-scan" aria-hidden="true" />
    </span>
  );
}
