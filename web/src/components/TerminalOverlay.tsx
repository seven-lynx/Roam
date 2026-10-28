/**
 * Decorative CRT overlay: scanlines, analog grain and a vignette, scoped to
 * the screen. Pointer events are disabled so it never blocks input, and the
 * FX switch hides it via the `.crt-layer` class.
 */
export function TerminalOverlay() {
  return (
    <div aria-hidden="true" className="crt-layer pointer-events-none absolute inset-0 z-[45] overflow-hidden">
      <div className="crt-scanlines absolute inset-0" />
      <div className="crt-grain absolute inset-0" />
      <div className="crt-vignette absolute inset-0" />
    </div>
  );
}
