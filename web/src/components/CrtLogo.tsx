'use client';

import type { CSSProperties } from 'react';

export interface CrtLogoProps {
  /** Rendered size in px (the logo is square). */
  size?: number;
  /** Accessible name. */
  label?: string;
  /** Enable the draw-in + refresh animation (defaults to true). */
  animate?: boolean;
  /** Extra class names for the wrapper. */
  className?: string;
}

/**
 * The 7Lynx mark drawn like a vector-monitor logo: a phosphor silhouette that
 * draws in top-to-bottom like a CRT raster, with a periodic refresh sweep and a
 * subtle phosphor flicker. Colors follow `--phosphor`/`--phosphor-glow`, so it
 * recolors automatically with the OS theme.
 */
export function CrtLogo({ size = 180, label = '7Lynx', animate = true, className = '' }: CrtLogoProps) {
  return (
    <span
      className={`crt-logo${animate ? ' crt-logo--animate' : ''}${className ? ` ${className}` : ''}`}
      style={{ '--crt-logo-size': `${size}px` } as CSSProperties}
      role="img"
      aria-label={label}
    >
      <span className="crt-logo-core" aria-hidden="true" />
      <span className="crt-logo-refresh" aria-hidden="true" />
      <span className="crt-logo-grille" aria-hidden="true" />
    </span>
  );
}
