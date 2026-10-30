/**
 * Navigation data for the ROAM-OS workstation: the hardware keys under the
 * screen, the on-screen launcher, and helpers for the Unix-style path readout.
 * Route labels are the site's real names; `file` is flavour text only.
 */

export type KeyIconName = 'home' | 'collections' | 'badges' | 'challenges' | 'leaderboard' | 'profile' | 'menu';

export interface NavKey {
  href: string;
  label: string;
  file: string;
  icon: KeyIconName;
}

export interface LauncherItem {
  href: string;
  label: string;
  file: string;
  /** Only show for signed-in (true) or signed-out (false) users. Omit for everyone. */
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
  { href: '/leaderboard', label: 'Leaderboard', file: '~/.roam/ranks.log', icon: 'leaderboard' },
  { href: '/profile', label: 'Profile', file: '~/.roam/profile', icon: 'profile' },
];

/** Everything else, reachable from the MENU key. */
export const LAUNCHER_GROUPS: LauncherGroup[] = [
  {
    title: 'Explore',
    items: [
      { href: '/how-it-works', label: 'How It Works', file: 'man roam' },
      { href: '/stats', label: 'Stats', file: '~/.roam/stats.log' },
      { href: '/changelog', label: 'Changelog', file: '~/.roam/CHANGELOG' },
    ],
  },
  {
    title: 'Community',
    items: [
      { href: '/following', label: 'Following', file: '~/.roam/following', auth: true },
      { href: '/people', label: 'People', file: '~/people/', auth: true },
      { href: '/submit', label: 'Submit a URL', file: 'roam submit', auth: true },
    ],
  },
  {
    title: 'Get the app',
    items: [
      { href: '/extensions', label: 'Browser Extension', file: 'roam-ext.tar.gz' },
      { href: '/android', label: 'Android App', file: 'roam-android.apk' },
    ],
  },
  {
    title: 'System',
    items: [
      { href: '/settings', label: 'Settings', file: '~/.roamrc', auth: true },
      { href: '/signup?mode=signin', label: 'Sign in', file: 'roam login', auth: false },
      { href: '/signup', label: 'Get started', file: 'roam init', auth: false },
      { href: '/support-roam', label: 'Support Roam', file: 'support.txt' },
      { href: '/privacy', label: 'Privacy Policy', file: 'privacy.txt' },
      { href: '/terms', label: 'Terms of Service', file: 'terms.txt' },
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
