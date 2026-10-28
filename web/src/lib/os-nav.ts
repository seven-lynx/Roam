/**
 * Navigation data for the ROAM-OS workstation: the hardware keys under the
 * screen, the on-screen launcher, and helpers for the DOS-style path readout.
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
  { href: '/', label: 'Home', file: 'ROAM.EXE', icon: 'home' },
  { href: '/collections', label: 'Collections', file: 'COLLECTIONS.DIR', icon: 'collections' },
  { href: '/badges', label: 'Badges', file: 'BADGES.SYS', icon: 'badges' },
  { href: '/challenges', label: 'Challenges', file: 'CHALLENGES.DAT', icon: 'challenges' },
  { href: '/leaderboard', label: 'Leaderboard', file: 'RANKS.LOG', icon: 'leaderboard' },
  { href: '/profile', label: 'Profile', file: 'PROFILE.ID', icon: 'profile' },
];

/** Everything else, reachable from the MENU key. */
export const LAUNCHER_GROUPS: LauncherGroup[] = [
  {
    title: 'Explore',
    items: [
      { href: '/how-it-works', label: 'How It Works', file: 'MANUAL.TXT' },
      { href: '/stats', label: 'Stats', file: 'STATS.LOG' },
      { href: '/changelog', label: 'Changelog', file: 'CHANGES.LOG' },
    ],
  },
  {
    title: 'Community',
    items: [
      { href: '/following', label: 'Following', file: 'FOLLOWING.DAT', auth: true },
      { href: '/people', label: 'People', file: 'PEOPLE.DIR', auth: true },
      { href: '/submit', label: 'Submit a URL', file: 'SUBMIT.EXE', auth: true },
    ],
  },
  {
    title: 'Get the app',
    items: [
      { href: '/extensions', label: 'Browser Extension', file: 'EXT.PKG' },
      { href: '/android', label: 'Android App', file: 'ANDROID.APK' },
    ],
  },
  {
    title: 'System',
    items: [
      { href: '/settings', label: 'Settings', file: 'SYSCONFIG.INI', auth: true },
      { href: '/signup?mode=signin', label: 'Sign in', file: 'LOGIN.EXE', auth: false },
      { href: '/signup', label: 'Get started', file: 'SETUP.EXE', auth: false },
      { href: '/support-roam', label: 'Support Roam', file: 'DONATE.TXT' },
      { href: '/privacy', label: 'Privacy Policy', file: 'PRIVACY.TXT' },
      { href: '/terms', label: 'Terms of Service', file: 'TERMS.TXT' },
    ],
  },
];

/** Whether `pathname` belongs to the key/route at `href`. */
export function isActivePath(pathname: string, href: string): boolean {
  const clean = href.split('?')[0];
  if (clean === '/') return pathname === '/';
  return pathname === clean || pathname.startsWith(clean + '/');
}

/** `/badges` -> `C:\ROAM\BADGES` for the status bar. */
export function toDosPath(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean).map((p) => decodeURIComponent(p).toUpperCase());
  return ['C:', 'ROAM', ...parts].join('\\');
}
