/**
 * ROAM-OS "all apps" registry: every launchable surface in the OS, flattened
 * into one searchable list. This powers the Android-style app drawer and the
 * handheld home screen (singles + folders). Data-only, like `os-programs`, so
 * it can be shared by the drawer, the desktop and tests without pulling React.
 */

import { PRIMARY_KEYS, LAUNCHER_GROUPS, type LauncherItem } from './os-nav';
import { PROGRAMS, PROGRAM_IDS, type ProgramId } from './os-programs';

export type AppKind = 'route' | 'action' | 'program' | 'external' | 'window';

export interface AppEntry {
  /** Stable key for React lists + tests. */
  id: string;
  label: string;
  /** UNIX-style flavor path. */
  file: string;
  glyph: string;
  kind: AppKind;
  /** Section heading in the all-apps drawer. */
  group: string;
  /** Internal route (navigates). */
  href?: string;
  /** In-OS action. */
  action?: LauncherItem['action'];
  /** In-OS program (for the `program` action). */
  program?: ProgramId;
  /** External URL (opens in a new tab). */
  external?: string;
  /** A Roam-OS window id to open (terminal / feedback / info / coffee). */
  window?: string;
  /** true = requires sign-in; false = hidden while signed in. */
  auth?: boolean;
}

export interface HomeFolder {
  id: string;
  label: string;
  glyph: string;
  file: string;
  items: AppEntry[];
}

const ROUTE_GLYPHS: Record<string, string> = {
  '/': '⌂',
  '/collections': '▣',
  '/badges': '◈',
  '/challenges': '⚑',
  '/leaderboard': '≡',
  '/profile': '◉',
};

function slug(...parts: string[]): string {
  return parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toAppEntry(item: LauncherItem, group: string): AppEntry {
  const kind: AppKind = item.external
    ? 'external'
    : item.action === 'program' && item.program
      ? 'program'
      : item.action
        ? 'action'
        : 'route';
  return {
    id: slug(group, item.label),
    label: item.label,
    file: item.file,
    glyph: item.glyph ?? '▪',
    kind,
    group,
    href: item.href,
    action: item.action,
    program: item.program,
    external: item.external,
    auth: item.auth,
  };
}

/** The six on-deck route keys (uppercased for the diegetic tile style). */
const ROUTE_APPS: AppEntry[] = PRIMARY_KEYS.map((k) => ({
  id: slug('route', k.href),
  label: k.label.toUpperCase(),
  file: k.file,
  glyph: ROUTE_GLYPHS[k.href] ?? '▪',
  kind: 'route' as const,
  group: 'Routes',
  href: k.href,
}));

/** Everything reachable from the MENU key, grouped by launcher category. */
const GROUP_APPS: AppEntry[] = LAUNCHER_GROUPS.flatMap((g) => g.items.map((i) => toAppEntry(i, g.title)));

/** Windows reachable from the dock tray (no route / launcher entry). */
const SYSTEM_WINDOWS: AppEntry[] = [
  { id: 'win-terminal', label: 'TERMINAL', file: 'roam shell', glyph: '>_', kind: 'window', group: 'System', window: 'terminal' },
  { id: 'win-comms', label: 'COMMS', file: 'roam comms', glyph: '☰', kind: 'window', group: 'System', window: 'feedback' },
  { id: 'win-info', label: 'ROAM INFO', file: 'roam info', glyph: '◎', kind: 'window', group: 'System', window: 'info' },
  { id: 'win-refuel', label: 'REFUEL', file: 'roam refuel', glyph: '☕', kind: 'window', group: 'System', window: 'coffee' },
  { id: 'win-roll', label: 'GALLERY', file: 'roam roll', glyph: '◳', kind: 'window', group: 'System', window: 'roll' },
];

/** Every launchable surface, flattened for the searchable app drawer. */
export const ALL_APPS: AppEntry[] = [...ROUTE_APPS, ...GROUP_APPS, ...SYSTEM_WINDOWS];

/** Case-insensitive search across label, flavor path and glyph. */
export function filterApps(query: string): AppEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...ALL_APPS];
  return ALL_APPS.filter((a) => [a.label, a.file, a.glyph].some((s) => s.toLowerCase().includes(q)));
}

/** The six programs, as home-screen "Games" folder tiles. */
const GAMES: AppEntry[] = PROGRAM_IDS.map((id) => ({
  id: `home-game-${id}`,
  label: PROGRAMS[id].title,
  file: PROGRAMS[id].file,
  glyph: PROGRAMS[id].glyph,
  kind: 'program' as const,
  group: 'Games',
  program: id,
}));

/** Curated site sections, as home-screen "Links" folder tiles. */
const LINKS: AppEntry[] = [
  { id: 'home-link-collections', label: 'COLLECTIONS', file: '~/collections/', glyph: '▤', kind: 'route', group: 'Links', href: '/collections' },
  { id: 'home-link-badges', label: 'BADGES', file: '~/.roam/badges/', glyph: '◈', kind: 'route', group: 'Links', href: '/badges' },
  { id: 'home-link-challenges', label: 'CHALLENGES', file: '~/.roam/challenges/', glyph: '⚑', kind: 'route', group: 'Links', href: '/challenges' },
  { id: 'home-link-rankings', label: 'RANKINGS', file: '~/.roam/ranks.log', glyph: '≡', kind: 'route', group: 'Links', href: '/leaderboard' },
  { id: 'home-link-extensions', label: 'EXTENSIONS', file: 'roam-ext.tar.gz', glyph: '⇣', kind: 'route', group: 'Links', href: '/extensions' },
  { id: 'home-link-support', label: 'SUPPORT', file: 'support.txt', glyph: '♥', kind: 'route', group: 'Links', href: '/support-roam' },
];

/** Top-level single icons on the handheld home screen. */
export const HOME_APPS: AppEntry[] = [
  { id: 'home-roam', label: 'ROAM', file: 'roam scan', glyph: '◎', kind: 'action', group: 'Roam', action: 'roam' },
  { id: 'home-terminal', label: 'TERMINAL', file: 'roam shell', glyph: '>_', kind: 'window', group: 'System', window: 'terminal' },
  { id: 'home-comms', label: 'COMMS', file: 'roam comms', glyph: '☰', kind: 'window', group: 'System', window: 'feedback' },
  { id: 'home-config', label: 'CONFIG', file: '~/.roamrc', glyph: '⚙', kind: 'action', group: 'System', action: 'settings' },
  { id: 'home-refuel', label: 'REFUEL', file: 'roam refuel', glyph: '☕', kind: 'window', group: 'System', window: 'coffee' },
  { id: 'home-cyberdeck', label: 'CYBERDECK', file: 'roam deck', glyph: '⛶', kind: 'action', group: 'System', action: 'deckview' },
  { id: 'home-roll', label: 'GALLERY', file: 'roam roll', glyph: '◳', kind: 'window', group: 'System', window: 'roll' },
];

/** Folders on the handheld home screen — tap to open a scoped tile grid. */
export const HOME_FOLDERS: HomeFolder[] = [
  { id: 'games', label: 'GAMES', glyph: '▤', file: '~/roam/games/', items: GAMES },
  { id: 'links', label: 'LINKS', glyph: '▣', file: '~/roam/links/', items: LINKS },
];
