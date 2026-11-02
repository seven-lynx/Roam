/**
 * Navigation data for the ROAM-OS workstation: the hardware keys under the
 * screen, the on-screen launcher, and helpers for the Unix-style path readout.
 * Route labels are the site's real names; `file` is flavor text only.
 */

import { PROGRAMS, type ProgramId } from './os-programs';

export type KeyIconName = 'home' | 'collections' | 'badges' | 'challenges' | 'rankings' | 'profile' | 'menu';

export interface NavKey {
  href: string;
  label: string;
  file: string;
  icon: KeyIconName;
}

export interface LauncherItem {
  /** Route to navigate to (internal link). */
  href?: string;
  /** In-OS action instead of navigation. */
  action?: 'inspect' | 'report' | 'roam' | 'deckview' | 'desktop' | 'settings' | 'program';
  /** Which in-OS program to open (for the `program` action). */
  program?: ProgramId;
  /** External URL (opens in a new tab). */
  external?: string;
  label: string;
  file: string;
  /** Short glyph shown on the launcher tile. */
  glyph?: string;
  /**
   * Requires sign-in (true) or sign-out (false). Gated items stay visible and,
   * when selected by a signed-out user, raise a diegetic error before redirecting
   * to sign-in.
   */
  auth?: boolean;
}

export interface LauncherGroup {
  title: string;
  items: LauncherItem[];
}

/** The six route keys on the deck. */
export const PRIMARY_KEYS: NavKey[] = [
  { href: '/', label: 'Home', file: 'roam', icon: 'home' },
  { href: '/collections', label: 'Collections', file: '~/collections/', icon: 'collections' },
  { href: '/badges', label: 'Badges', file: '~/.roam/badges/', icon: 'badges' },
  { href: '/challenges', label: 'Challenges', file: '~/.roam/challenges/', icon: 'challenges' },
  { href: '/leaderboard', label: 'Rankings', file: '~/.roam/ranks.log', icon: 'rankings' },
  { href: '/profile', label: 'Profile', file: '~/.roam/profile', icon: 'profile' },
];

/** Everything else, reachable from the MENU key. */
export const LAUNCHER_GROUPS: LauncherGroup[] = [
  {
    title: 'Explore',
    items: [
      { href: '/how-it-works', label: 'How It Works', file: 'man roam', glyph: '?' },
      { href: '/stats', label: 'Stats', file: '~/.roam/stats.log', glyph: '≡' },
      { href: '/changelog', label: 'Changelog', file: '~/.roam/CHANGELOG', glyph: 'Δ' },
    ],
  },
  {
    title: 'Community',
    items: [
      { href: '/following', label: 'Following', file: '~/.roam/following', auth: true, glyph: '▣' },
      { href: '/people', label: 'People', file: '~/people/', auth: true, glyph: '◉' },
      { href: '/submit', label: 'Upload URL', file: 'roam upload', auth: true, glyph: '↑' },
      { action: 'report', label: 'Report broken link', file: 'roam report', glyph: '!' },
    ],
  },
  {
    title: 'Roam',
    items: [
      { action: 'roam', label: 'Roam', file: 'roam scan', glyph: '◎' },
      { href: '/extensions', label: 'Browser Extension', file: 'roam-ext.tar.gz', glyph: '◈' },
      { href: '/android', label: 'Android App', file: 'roam-android.apk', glyph: '▭' },
    ],
  },
  {
    title: 'Programs',
    items: [
      { action: 'program', program: 'snake', label: 'RELAY', file: PROGRAMS.snake.file, glyph: PROGRAMS.snake.glyph },
      { action: 'program', program: 'minesweeper', label: 'BOTFIELD', file: PROGRAMS.minesweeper.file, glyph: PROGRAMS.minesweeper.glyph },
      { action: 'program', program: 'tetris', label: 'COMPILER', file: PROGRAMS.tetris.file, glyph: PROGRAMS.tetris.glyph },
      { action: 'program', program: 'asteroids', label: 'DEBRIS', file: PROGRAMS.asteroids.file, glyph: PROGRAMS.asteroids.glyph },
    ],
  },
  {
    title: 'System',
    items: [
      { action: 'settings', label: 'Config', file: '~/.roamrc', glyph: '⚙' },
      { action: 'desktop', label: 'Desktop', file: 'roam desktop', glyph: '⌂' },
      { external: 'https://github.com/seven-lynx/roam', label: '7 Lynx', file: 'github.com/seven-lynx', glyph: '7' },
      { action: 'inspect', label: 'Inspect the deck', file: 'roam inspect', glyph: '⟳' },
      { action: 'deckview', label: 'Cyberdeck view', file: 'roam deck', glyph: '⛶' },
      { href: '/signup?mode=signin', label: 'Log in', file: 'roam login', auth: false, glyph: '→' },
      { href: '/signup', label: 'Get started', file: 'roam init', auth: false, glyph: '✦' },
      { href: '/support-roam', label: 'Support Roam', file: 'support.txt', glyph: '♥' },
      { href: '/privacy', label: 'Privacy Policy', file: 'privacy.txt', glyph: '⊘' },
      { href: '/terms', label: 'Terms of Service', file: 'terms.txt', glyph: '§' },
    ],
  },
];

/** Whether `pathname` belongs to the key/route at `href`. */
export function isActivePath(pathname: string, href: string): boolean {
  const clean = href.split('?')[0];
  if (clean === '/') return pathname === '/';
  return pathname === clean || pathname.startsWith(clean + '/');
}

/** `/badges` -> `~/roam/badges` for the status bar. */
export function toUnixPath(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean).map((p) => decodeURIComponent(p));
  return ['~', 'roam', ...parts].join('/');
}
