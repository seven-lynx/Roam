'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useWorkstation, type WindowId } from '@/components/WorkstationContext';
import { LAUNCHER_GROUPS, PRIMARY_KEYS, type LauncherItem } from '@/lib/os-nav';
import { LynxMark } from '@/components/LynxMark';
import { click } from '@/lib/sfx';

const RECENT_KEY = 'roam-recent';

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string').slice(0, 6) : [];
  } catch {
    return [];
  }
}

function rememberRecent(href: string): void {
  try {
    const next = [href, ...readRecent().filter((h) => h !== href)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
}

interface Category {
  id: string;
  title: string;
  glyph: string;
  items: LauncherItem[];
}

/** START-MENU key menu: cascading category list with a flyout panel. */
export function Launcher() {
  const {
    launcherOpen, setLauncherOpen, openWindow, setInspect, openDeckLauncher, showAlert, showConfirm, handheld,
  } = useWorkstation();
  const { session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const signedIn = !!session;
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setRecent(readRecent()), []);

  useEffect(() => {
    if (!launcherOpen) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setLauncherOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLauncherOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [launcherOpen, setLauncherOpen]);

  if (!launcherOpen) return null;

  const allItems: LauncherItem[] = [
    ...PRIMARY_KEYS.map((k) => ({ href: k.href, label: k.label, file: k.file, glyph: '▪' })),
    ...LAUNCHER_GROUPS.flatMap((g) => g.items),
  ];

  const glyph = (item: LauncherItem) => item.glyph ?? '▪';

  const gate = (item: LauncherItem): boolean => {
    if (item.auth === true && !signedIn) {
      showAlert('ACCESS DENIED', `${item.label} requires a signed-in operator.\n\nRedirecting to sign-in…`);
      router.push('/signup?mode=signin');
      return true;
    }
    return false;
  };

  const runAction = (item: LauncherItem) => {
    setLauncherOpen(false);
    if (item.action === 'inspect') setInspect(true);
    if (item.action === 'roam') openWindow('scan');
    if (item.action === 'deckview') openDeckLauncher();
    if (item.action === 'desktop' && pathname !== '/' && pathname !== '/desktop') router.push('/');
    if (item.action === 'settings') openWindow('settings');
    if (item.action === 'program' && item.program) openWindow(item.program as WindowId);
    if (item.action === 'report') {
      showConfirm('REPORT BROKEN LINK', 'Flag this page as broken? It will be hidden after review.', {
        danger: true,
        confirmLabel: 'Report',
        onConfirm: () => openWindow('feedback'),
      });
    }
  };

  const onRoute = (href: string) => {
    rememberRecent(href);
    setRecent(readRecent());
    setLauncherOpen(false);
  };

  const recentItems = recent
    .map((href) => allItems.find((i) => i.href === href))
    .filter((i): i is LauncherItem => !!i);

  const categories: Category[] = [
    { id: 'roam', title: 'Roam', glyph: '◎', items: LAUNCHER_GROUPS.find((g) => g.title === 'Roam')?.items ?? [] },
    { id: 'routes', title: 'Routes', glyph: '▤', items: PRIMARY_KEYS.map((k) => ({ href: k.href, label: k.label, file: k.file, glyph: '▪' })) },
    { id: 'explore', title: 'Explore', glyph: '≡', items: LAUNCHER_GROUPS.find((g) => g.title === 'Explore')?.items ?? [] },
    { id: 'community', title: 'Community', glyph: '▣', items: LAUNCHER_GROUPS.find((g) => g.title === 'Community')?.items ?? [] },
    { id: 'programs', title: 'Programs', glyph: '▧', items: LAUNCHER_GROUPS.find((g) => g.title === 'Programs')?.items ?? [] },
    { id: 'system', title: 'System', glyph: '⚙', items: LAUNCHER_GROUPS.find((g) => g.title === 'System')?.items ?? [] },
  ];

  const renderItem = (item: LauncherItem) => {
    if (item.auth === false && signedIn) return null;
    if (item.action) {
      return (
        <button key={item.label} type="button" className="launcher-item" onClick={() => { click(); runAction(item); }}>
          <span className="launcher-item-glyph">{glyph(item)}</span>
          <span>{item.label}</span>
          <span className="launcher-item-file">{item.file}</span>
        </button>
      );
    }
    if (item.external) {
      return (
        <a key={item.label} href={item.external} target="_blank" rel="noopener noreferrer" className="launcher-item">
          <span className="launcher-item-glyph">{glyph(item)}</span>
          <span>{item.label}</span>
          <span className="launcher-item-file">{item.file} ↗</span>
        </a>
      );
    }
    return (
      <Link
        key={item.label}
        href={item.href ?? '/'}
        className="launcher-item"
        onClick={(e) => { if (gate(item)) e.preventDefault(); else onRoute(item.href ?? '/'); }}
        aria-disabled={item.auth === true && !signedIn}
      >
        <span className="launcher-item-glyph">{glyph(item)}{item.auth === true && !signedIn ? ' 🔒' : ''}</span>
        <span>{item.label}</span>
        <span className="launcher-item-file">{item.auth === true && !signedIn ? 'log in' : item.file}</span>
      </Link>
    );
  };

  const activeCategory = categories.find((c) => c.id === active);

  return (
    <div className={`launcher-dropdown${handheld ? ' launcher-dropdown--handheld' : ''}`} ref={ref} role="menu" aria-label="Programs">
      <div className="launcher-dropdown-head">
        <LynxMark size={20} />
        <span className="launcher-head-title">Launcher</span>
        <span className="launcher-head-hint">Esc to close</span>
      </div>

      {recentItems.length > 0 && (
        <div className="launcher-recent">
          {recentItems.map((item) => (
            <button key={item.href} type="button" className="launcher-recent-chip" onClick={() => onRoute(item.href ?? '/')}>
              {glyph(item)} {item.label}
            </button>
          ))}
        </div>
      )}

      <div className="launcher-list" aria-label="All programs">
        {categories.map((c) => (
          <div key={c.id} className="launcher-list-group">
            <div className="launcher-list-head">
              <span className="launcher-cat-glyph">{c.glyph}</span>
              {c.title}
            </div>
            <div className="launcher-list-items">
              {c.items.map((item) => renderItem(item))}
            </div>
          </div>
        ))}
      </div>

      <div className="launcher-cascade" onMouseLeave={() => setActive(null)}>
        <div className="launcher-cats">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`launcher-cat${active === c.id ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(c.id)}
              onClick={() => { click(); setActive(c.id); }}
            >
              <span className="launcher-cat-glyph">{c.glyph}</span>
              <span>{c.title}</span>
              <span className="launcher-cat-arrow">▸</span>
            </button>
          ))}
        </div>

        {activeCategory && (
          <div className="launcher-flyout">
            <div className="launcher-col-title">{activeCategory.title}</div>
            {activeCategory.items.map((item) => renderItem(item))}
          </div>
        )}
      </div>

      <div className="launcher-flavor">
        {allItems.length} programs · {signedIn ? 'operator online' : 'guest mode'}
      </div>

      <div className="launcher-footer">
        <button type="button" className="launcher-footer-btn" data-tip="Config" aria-label="Config" onClick={() => { click(); openWindow('settings'); setLauncherOpen(false); }}>⚙</button>
        {signedIn ? (
          <Link href="/profile" className="launcher-footer-btn" data-tip="Account" aria-label="Account" onClick={() => setLauncherOpen(false)}>◉</Link>
        ) : (
          <Link href="/signup?mode=signin" className="launcher-footer-btn" data-tip="Log in" aria-label="Log in" onClick={() => setLauncherOpen(false)}>→</Link>
        )}
        <button type="button" className="launcher-footer-btn" data-tip="Cyberdeck view" aria-label="Cyberdeck view" onClick={() => { click(); openDeckLauncher(); setLauncherOpen(false); }}>⛶</button>
        <button type="button" className="launcher-footer-btn" data-tip="Inspect" aria-label="Inspect" onClick={() => { click(); setInspect(true); setLauncherOpen(false); }}>⟳</button>
        <a href="mailto:support@roamtheweb.app" className="launcher-footer-btn" data-tip="Support" aria-label="Support">✉</a>
      </div>
    </div>
  );
}