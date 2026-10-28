/**
 * Decorative radar instrument — a sweeping scan over the excavation grid.
 */
export function RadarSweep() {
  return (
    <div aria-hidden="true" className="radar">
      <div className="radar-sweep" />
      <span className="radar-blip" style={{ top: '28%', left: '62%' }} />
      <span className="radar-blip" style={{ top: '64%', left: '34%' }} />
      <span className="radar-blip" style={{ top: '46%', left: '46%' }} />
    </div>
  );
}
