import type { KeyIconName } from '@/lib/os-nav';

/** Tiny pixel-ish pictograms for the hardware keycaps. Decorative: the key's label carries the meaning. */
export function KeyIcon({ name, className = 'w-4 h-4' }: { name: KeyIconName | 'roam' | 'comms'; className?: string }) {
  const common = { className, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'square' as const, 'aria-hidden': true };
  switch (name) {
    case 'home':
      return <svg {...common}><path d="M2 8 8 2l6 6M4 7v7h3v-4h2v4h3V7" /></svg>;
    case 'collections':
      return <svg {...common}><path d="M2 5h12v9H2zM2 5l2-2h4l1 2" /></svg>;
    case 'badges':
      return <svg {...common}><path d="M8 1.5 10 6l4.5.5-3.3 3 1 4.5L8 11.8 3.8 14l1-4.5-3.3-3L6 6z" /></svg>;
    case 'challenges':
      return <svg {...common}><path d="M3 14V2m0 1h9l-2 3 2 3H3" /></svg>;
    case 'leaderboard':
      return <svg {...common}><path d="M2 14V9h3v5M6.5 14V4h3v10M11 14V7h3v7" /></svg>;
    case 'profile':
      return <svg {...common}><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6M2.5 14.5c.5-3 2.7-4.5 5.5-4.5s5 1.5 5.5 4.5" /></svg>;
    case 'menu':
      return <svg {...common}><path d="M2 4h12M2 8h12M2 12h12" /></svg>;
    case 'roam':
      return <svg {...common}><circle cx="8" cy="8" r="6" /><path d="m10.5 5.5-1.5 4-4 1.5 1.5-4z" /></svg>;
    case 'comms':
      return <svg {...common}><path d="M2 3h12v8H7l-3 3v-3H2z" /></svg>;
  }
}
