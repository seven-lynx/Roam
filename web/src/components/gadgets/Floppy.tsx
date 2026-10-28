import Link from 'next/link';

/** A stack of floppy disks with scribbled labels. Clicking opens the changelog. */
export function Floppy() {
  const disk = (y: number, color: string, label: string, rot: number) => (
    <g transform={`rotate(${rot} 50 ${y + 30})`} key={label}>
      <path d={`M6 ${y}h72l16 16v62a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z`} fill={color} stroke="#0e0e0b" strokeWidth="1.5" />
      <rect x="26" y={y} width="44" height="20" fill="#bdbdb0" stroke="#0e0e0b" strokeWidth="1" />
      <rect x="54" y={y + 3} width="9" height="14" fill="#2b2a20" />
      <rect x="16" y={y + 38} width="68" height="28" rx="2" fill="#efe9cf" />
      <text x="50" y={y + 56} textAnchor="middle" fontSize="11" fontFamily="var(--font-hand), cursive" fontWeight="700" fill="#2b2a1d">{label}</text>
    </g>
  );

  return (
    <Link href="/changelog" className="gadget" aria-label="Floppy disks. Open the changelog.">
      <svg viewBox="0 0 110 150" aria-hidden="true">
        {disk(56, '#2d4f5c', 'backup_final', 7)}
        {disk(28, '#7a3b52', 'DO NOT ERASE', -5)}
        {disk(4, '#3b3a30', 'geo_archive', 3)}
      </svg>
    </Link>
  );
}
