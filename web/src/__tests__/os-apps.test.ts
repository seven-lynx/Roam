import { ALL_APPS, HOME_APPS, HOME_FOLDERS, filterApps } from '@/lib/os-apps';

describe('os-apps registry', () => {
  it('gives every app a unique id', () => {
    const ids = ALL_APPS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes the on-deck routes, the six programs and the system windows', () => {
    const labels = ALL_APPS.map((a) => a.label);
    for (const label of ['HOME', 'COLLECTIONS', 'BADGES', 'CHALLENGES', 'RANKINGS', 'PROFILE']) {
      expect(labels).toContain(label);
    }
    expect(ALL_APPS.filter((a) => a.kind === 'program')).toHaveLength(7);
    expect(ALL_APPS.filter((a) => a.kind === 'window')).toHaveLength(4);
  });

  it('filters case-insensitively across label, file and glyph', () => {
    expect(filterApps('relay').map((a) => a.label)).toContain('RELAY');
    expect(filterApps('TERMINAL').some((a) => a.label === 'TERMINAL')).toBe(true);
    expect(filterApps('nonexistent-app')).toHaveLength(0);
  });

  it('returns the full list for an empty query', () => {
    expect(filterApps('   ')).toHaveLength(ALL_APPS.length);
  });

  it('lays out the handheld home screen with six singles and two folders', () => {
    expect(HOME_APPS).toHaveLength(6);
    expect(HOME_FOLDERS.map((f) => f.id)).toEqual(['games', 'links']);
  });

  it('packs the games and links folders with their expected apps', () => {
    const games = HOME_FOLDERS.find((f) => f.id === 'games')!;
    const links = HOME_FOLDERS.find((f) => f.id === 'links')!;
    expect(games.items).toHaveLength(7);
    expect(games.items.every((a) => a.kind === 'program')).toBe(true);
    expect(links.items).toHaveLength(6);
    expect(links.items.every((a) => a.kind === 'route')).toBe(true);
  });

  it('gives every home app exactly one launch target', () => {
    const all = [...HOME_APPS, ...HOME_FOLDERS.flatMap((f) => f.items)];
    for (const app of all) {
      const targets = [app.href, app.external, app.program, app.window, app.action].filter(Boolean);
      expect(targets).toHaveLength(1);
    }
  });
});
