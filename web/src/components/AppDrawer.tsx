'use client';

import { useEffect, useState } from 'react';
import { useWorkstation } from '@/components/WorkstationContext';
import { useAppLauncher } from '@/lib/use-app-launcher';
import { ALL_APPS, filterApps, type AppEntry } from '@/lib/os-apps';
import { LynxMark } from '@/components/LynxMark';
import { click } from '@/lib/sfx';

/**
 * Android-style all-apps drawer: a full-screen (handheld) overlay with a search
 * box and a tile grid of every launchable surface. Sectioned by group until the
 * operator types, then a flat filtered result set.
 */
export function AppDrawer() {
  const { appDrawerOpen, setAppDrawerOpen } = useWorkstation();
  const { launch, signedIn } = useAppLauncher();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (appDrawerOpen) setQuery('');
  }, [appDrawerOpen]);

  useEffect(() => {
    if (!appDrawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAppDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [appDrawerOpen, setAppDrawerOpen]);

  if (!appDrawerOpen) return null;

  const q = query.trim().toLowerCase();
  const results = (q ? filterApps(query) : ALL_APPS).filter((a) => a.auth !== false || !signedIn);

  const groups = q
    ? null
    : Array.from(
        results.reduce((map, a) => {
          const list = map.get(a.group) ?? [];
          list.push(a);
          map.set(a.group, list);
          return map;
        }, new Map<string, AppEntry[]>()),
      ).map(([title, items]) => ({ title, items }));

  const renderTile = (app: AppEntry) => (
    <button
      key={app.id}
      type="button"
      className="app-tile"
      onClick={() => {
        click();
        setAppDrawerOpen(false);
        launch(app);
      }}
      aria-disabled={app.auth === true && !signedIn}
    >
      <span className="app-tile-glyph" aria-hidden="true">
        {app.glyph}
        {app.auth === true && !signedIn ? ' 🔒' : ''}
      </span>
      <span className="app-tile-label">{app.label}</span>
    </button>
  );

  return (
    <div className="app-drawer" role="dialog" aria-label="All apps">
      <div className="app-drawer-head">
        <LynxMark size={18} />
        <span className="app-drawer-title">All Apps</span>
        <button
          type="button"
          className="app-drawer-close"
          aria-label="Close all apps"
          onClick={() => {
            click();
            setAppDrawerOpen(false);
          }}
        >
          ✕
        </button>
      </div>

      <div className="app-drawer-search">
        <span className="app-drawer-search-icon" aria-hidden="true">
          ⌕
        </span>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search apps…"
          aria-label="Search apps"
          inputMode="search"
          enterKeyHint="search"
        />
        {query && (
          <button type="button" className="app-drawer-clear" aria-label="Clear search" onClick={() => setQuery('')}>
            ✕
          </button>
        )}
      </div>

      <div className="app-drawer-scroll">
        {groups
          ? groups.map((g) => (
              <div key={g.title} className="app-drawer-group">
                <div className="app-drawer-group-title">{g.title}</div>
                <div className="app-drawer-grid">{g.items.map(renderTile)}</div>
              </div>
            ))
          : results.length > 0
            ? <div className="app-drawer-grid">{results.map(renderTile)}</div>
            : <div className="app-drawer-empty">No apps match “{query}”</div>}
      </div>
    </div>
  );
}
