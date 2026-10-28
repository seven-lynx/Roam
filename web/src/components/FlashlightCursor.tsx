'use client';

/**
 * Ambient glow fixed at the center of the screen. It no longer follows the
 * pointer — the centered bloom reads better against the CRT.
 */
export function FlashlightCursor() {
  return (
    <div
      aria-hidden="true"
      className="crt-layer pointer-events-none absolute inset-0 z-[44] mix-blend-screen"
      style={{
        background:
          'radial-gradient(380px 380px at 50% 50%, var(--phosphor-glow), transparent 70%)',
      }}
    />
  );
}
