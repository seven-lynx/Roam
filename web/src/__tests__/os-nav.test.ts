import { LAUNCHER_GROUPS, PRIMARY_KEYS, isActivePath, toUnixPath } from '@/lib/os-nav';

describe('os-nav', () => {
  it('keeps the site\'s real route names (nothing is renamed)', () => {
    const labels = PRIMARY_KEYS.map((k) => k.label);
    expect(labels).toEqual(['Home', 'Collections', 'Badges', 'Challenges', 'Leaderboard', 'Profile']);
  });

  it('gives every primary key a unique, absolute href', () => {
    const hrefs = PRIMARY_KEYS.map((k) => k.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    hrefs.forEach((h) => expect(h.startsWith('/')).toBe(true));
  });

  it('does not duplicate a primary key inside the launcher', () => {
    const primary = new Set(PRIMARY_KEYS.map((k) => k.href));
    const launcher = LAUNCHER_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    launcher.forEach((h) => expect(primary.has(h)).toBe(false));
  });

  it('matches the home key only on the exact root path', () => {
    expect(isActivePath('/', '/')).toBe(true);
    expect(isActivePath('/badges', '/')).toBe(false);
  });

  it('matches nested routes and ignores query strings in the href', () => {
    expect(isActivePath('/collections/my-list', '/collections')).toBe(true);
    expect(isActivePath('/collectionsX', '/collections')).toBe(false);
    expect(isActivePath('/signup', '/signup?mode=signin')).toBe(true);
  });

  it('renders Unix-style paths for the status bar', () => {
    expect(toUnixPath('/')).toBe('~/roam');
    expect(toUnixPath('/badges')).toBe('~/roam/badges');
    expect(toUnixPath('/collections/my%20list')).toBe('~/roam/collections/my list');
  });
});
