import { rotationFor } from '@/lib/desk-layout';

type Scene = 'grid' | 'skyline' | 'signal';

/** Polaroid with a small abstract scene drawn in SVG (no photos). Decorative. */
export function Polaroid({ id, caption, scene = 'grid', maxTilt = 8 }: { id: string; caption: string; scene?: Scene; maxTilt?: number }) {
  return (
    <figure
      aria-hidden="true"
      className="w-full bg-[#ece7d0] p-[6%] pb-[2%] shadow-[0_6px_10px_rgba(0,0,0,0.55)]"
      style={{ transform: `rotate(${rotationFor(id, maxTilt)}deg)` }}
    >
      <svg viewBox="0 0 100 80" className="block w-full">
        <rect width="100" height="80" fill="#0e1a1c" />
        {scene === 'grid' && (
          <g stroke="#3f7f7d" strokeWidth=".8" fill="none">
            {[0, 1, 2, 3, 4, 5].map((n) => <line key={`h${n}`} x1="0" y1={40 + n * n * 1.5 + n * 3} x2="100" y2={40 + n * n * 1.5 + n * 3} />)}
            {[-4, -2, 0, 2, 4].map((n) => <line key={`v${n}`} x1={50 + n * 4} y1="40" x2={50 + n * 18} y2="80" />)}
            <circle cx="50" cy="30" r="14" fill="#ff2e88" stroke="none" opacity=".85" />
          </g>
        )}
        {scene === 'skyline' && (
          <g>
            <rect width="100" height="80" fill="#1b2a38" />
            {[[6, 30, 12], [20, 18, 14], [37, 36, 10], [50, 12, 16], [68, 26, 12], [83, 34, 11]].map(([x, y, w]) => (
              <rect key={x} x={x} y={y + 14} width={w} height={80 - y - 14} fill="#0a1214" />
            ))}
            {[[24, 36], [54, 30], [54, 44], [72, 44], [10, 50]].map(([x, y]) => <rect key={`${x}${y}`} x={x} y={y} width="2.4" height="2.4" fill="#c9a24b" />)}
          </g>
        )}
        {scene === 'signal' && (
          <g fill="none" stroke="#59b3ae" strokeWidth="1.2">
            {[10, 20, 30].map((r) => <path key={r} d={`M${50 - r} 52a${r} ${r} 0 0 1 ${r * 2} 0`} opacity={1 - r / 45} />)}
            <circle cx="50" cy="56" r="3" fill="#ff2e88" stroke="none" />
          </g>
        )}
      </svg>
      <figcaption className="px-1 pb-1 pt-[6%] text-center font-hand text-[clamp(0.7rem,1vw,0.95rem)] leading-none text-[#2b2a1d]">{caption}</figcaption>
    </figure>
  );
}
