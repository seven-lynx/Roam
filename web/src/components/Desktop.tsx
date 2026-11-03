'use client';

import { useEffect, useRef, useState, type PointerEvent, type ReactNode, type UIEvent } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useWorkstation, type WindowId } from '@/components/WorkstationContext';
import { click } from '@/lib/sfx';
import { SiteShowcase } from '@/components/SiteShowcase';
import { RankingsWidget } from '@/components/RankingsWidget';
import { TelemetryWidget } from '@/components/TelemetryWidget';
import { DeckDiagnosticsWidget } from '@/components/DeckDiagnosticsWidget';
import { DraggableWidget } from '@/components/DraggableWidget';
import { useWallpaper, applyRandomWallpaper, WALLPAPER_CYCLE_MS } from '@/lib/wallpaper';
import { HOME_APPS, HOME_FOLDERS, type HomeFolder } from '@/lib/os-apps';
import { useAppLauncher } from '@/lib/use-app-launcher';

/**
 * The ROAM-OS desktop: its own page with a selectable wallpaper and a strip of
 * draggable app icons. Single-tap/click opens the app (HOME navigates); drag
 * repositions the icon. Icon positions and the wallpaper autosave to
 * localStorage so a revisit restores the layout.
 */

const DESKTOP_KEY = 'roam-desktop-icons';

type DesktopAppId = string;

interface DesktopApp {
  id: DesktopAppId;
  label: string;
  glyph: string;
  file: string;
  /** Navigate to this internal route instead of opening a window. */
  href?: string;
  /** Open this external URL in a new tab instead of opening a window. */
  external?: string;
}

const DESKTOP_APPS: DesktopApp[] = [
  { id: 'home', label: 'HOME', glyph: '⌂', file: '~/roam' },
  { id: 'scan', label: 'ROAM', glyph: '◎', file: 'roam scan' },
  { id: 'launcher', label: 'PROGRAMS', glyph: '▤', file: 'roam menu' },
  { id: 'terminal', label: 'TERMINAL', glyph: '>_', file: 'roam shell' },
  { id: 'feedback', label: 'COMMS', glyph: '☰', file: 'roam comms' },
  { id: 'settings', label: 'CONFIG', glyph: '⚙', file: '~/.roamrc' },
  { id: 'info', label: 'ROAM INFO', glyph: '◎', file: 'roam info' },
  { id: 'coffee', label: 'REFUEL', glyph: '☕', file: 'roam refuel' },
  { id: 'cyberdeck', label: 'CYBERDECK', glyph: '⛶', file: 'roam deck' },
  { id: '7lynx', label: '7 LYNX', glyph: '7', file: 'github.com/seven-lynx', external: 'https://github.com/seven-lynx/roam' },
  { id: 'collections', label: 'COLLECTIONS', glyph: '▤', file: '~/collections/', href: '/collections' },
  { id: 'badges', label: 'BADGES', glyph: '◈', file: '~/.roam/badges/', href: '/badges' },
  { id: 'challenges', label: 'CHALLENGES', glyph: '⚑', file: '~/.roam/challenges/', href: '/challenges' },
  { id: 'rankings', label: 'RANKINGS', glyph: '≡', file: '~/.roam/ranks.log', href: '/leaderboard' },
  { id: 'extensions', label: 'EXTENSIONS', glyph: '⇣', file: 'roam-ext.tar.gz', href: '/extensions' },
  { id: 'support', label: 'SUPPORT', glyph: '♥', file: 'support.txt', href: '/support-roam' },
];

const ICON_W = 76;
const ICON_H = 86;

/** Desktop widgets, pinned to corners: showcase + rankings form the top-right
 *  cluster, sys telemetry sits bottom-left, and deck diagnostics bottom-right. */
const WIDGETS: Record<string, ReactNode> = {
  showcase: <SiteShowcase />,
  rankings: <RankingsWidget limit={5} />,
  telemetry: <TelemetryWidget />,
  deckdiag: <DeckDiagnosticsWidget />,
};

/** Handheld pager: one widget per screen, in this order. */
const HANDHELD_WIDGET_ORDER = ['showcase', 'rankings', 'telemetry', 'deckdiag'] as const;

interface IconPos {
  x: number;
  y: number;
}

type IconMap = Record<string, IconPos>;

function defaultPositions(): IconMap {
  const out: IconMap = {};
  const PER_COL = 6;
  DESKTOP_APPS.forEach((a, i) => {
    const col = Math.floor(i / PER_COL);
    const row = i % PER_COL;
    out[a.id] = { x: 12 + col * (ICON_W + 10), y: 44 + row * (ICON_H + 6) };
  });
  return out;
}

function loadPositions(): IconMap {
  try {
    const raw = localStorage.getItem(DESKTOP_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as IconMap | null;
      if (parsed && typeof parsed === 'object') return { ...defaultPositions(), ...parsed };
    }
  } catch {
    /* storage unavailable: keep defaults */
  }
  return defaultPositions();
}

export function Desktop() {
  const router = useRouter();
  const pathname = usePathname();
  const { openWindow, toggleLauncher, handheld, toggleAppDrawer } = useWorkstation();
  const { launch } = useAppLauncher();
  const [positions, setPositions] = useState<IconMap>(loadPositions);
  const [folderOpen, setFolderOpen] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pagerRef = useRef<HTMLDivElement>(null);
  const wallpaper = useWallpaper();

  // Shuffle the wallpaper folder while in cycle mode (the default).
  useEffect(() => {
    if (wallpaper.mode !== 'cycle') return;
    applyRandomWallpaper();
    const id = setInterval(applyRandomWallpaper, WALLPAPER_CYCLE_MS);
    return () => clearInterval(id);
  }, [wallpaper.mode]);
  const dragRef = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  // The desktop is the homepage + its own dedicated route.
  if (pathname !== '/' && pathname !== '/desktop') return null;

  const clamp = (x: number, y: number): IconPos => {
    const maxX = Math.max(0, window.innerWidth - ICON_W);
    const maxY = Math.max(0, window.innerHeight - ICON_H - 44); // clear the dock
    return { x: Math.min(Math.max(0, x), maxX), y: Math.min(Math.max(0, y), maxY) };
  };

  const onDown = (e: PointerEvent<HTMLButtonElement>, app: DesktopApp) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = positions[app.id] ?? { x: 0, y: 0 };
    dragRef.current = { id: app.id, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, moved: false };
  };

  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) > 5) d.moved = true;
    if (!d.moved) return;
    setPositions((prev) => ({ ...prev, [d.id]: clamp(d.ox + dx, d.oy + dy) }));
  };

  const onUp = (e: PointerEvent<HTMLButtonElement>, app: DesktopApp) => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);

    if (d.moved) {
      setPositions((prev) => {
        const next = { ...prev, [d.id]: clamp(d.ox + (e.clientX - d.sx), d.oy + (e.clientY - d.sy)) };
        try {
          localStorage.setItem(DESKTOP_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
      return;
    }

    // A clean tap/click: launch.
    click();
    if (app.external) window.open(app.external, '_blank', 'noopener,noreferrer');
    else if (app.href) router.push(app.href);
    else if (app.id === 'home') router.push('/');
    else if (app.id === 'launcher') toggleLauncher();
    else openWindow(app.id as WindowId);
  };

  const onPagerScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const idx = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    setPage(Math.min(Math.max(0, idx), HANDHELD_WIDGET_ORDER.length));
  };

  const scrollToPage = (i: number) => {
    const el = pagerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  if (handheld) {
    const openFolder = HOME_FOLDERS.find((f) => f.id === folderOpen) ?? null;
    return (
      <div className="desktop desktop--handheld" aria-label="Desktop" style={{ background: wallpaper.current.css }}>
        <div className="home-pager" ref={pagerRef} onScroll={onPagerScroll}>
          <section className="home-page home-page--apps" aria-label="Apps">
            <div className="desktop-icons">
              {HOME_APPS.map((app) => (
                <button key={app.id} type="button" className="desktop-icon" onClick={() => { click(); launch(app); }}>
                  <span className="desktop-glyph" aria-hidden="true">{app.glyph}</span>
                  <span className="desktop-label">{app.label}</span>
                </button>
              ))}
              {HOME_FOLDERS.map((f) => (
                <button key={f.id} type="button" className="desktop-icon" onClick={() => { click(); setFolderOpen(f.id); }}>
                  <span className="desktop-glyph" aria-hidden="true">{f.glyph}</span>
                  <span className="desktop-label">{f.label}</span>
                </button>
              ))}
              <button type="button" className="desktop-icon" onClick={() => { click(); toggleAppDrawer(); }}>
                <span className="desktop-glyph" aria-hidden="true">⊞</span>
                <span className="desktop-label">ALL APPS</span>
              </button>
            </div>
          </section>

          {HANDHELD_WIDGET_ORDER.map((id) => (
            <section key={id} className="home-page home-page--widget" aria-label={id}>
              <div className="home-widget">{WIDGETS[id]}</div>
            </section>
          ))}
        </div>

        <div className="home-page-dots" aria-label="Pages">
          {Array.from({ length: HANDHELD_WIDGET_ORDER.length + 1 }).map((_, i) => (
            <button key={i} type="button" className={`home-dot${page === i ? ' is-active' : ''}`} aria-label={`Page ${i + 1}`} onClick={() => scrollToPage(i)} />
          ))}
        </div>

        {openFolder && <FolderOverlay folder={openFolder} onClose={() => setFolderOpen(null)} />}
      </div>
    );
  }

  return (
    <div className={`desktop${handheld ? ' desktop--handheld' : ''}`} aria-label="Desktop" style={{ background: wallpaper.current.css }}>
      <div className="desktop-icons">
        {DESKTOP_APPS.map((app) => {
          const p = positions[app.id] ?? { x: 0, y: 0 };
          return (
            <button
              key={app.id}
              type="button"
              className="desktop-icon"
              style={{ left: p.x, top: p.y }}
              onPointerDown={(e) => onDown(e, app)}
              onPointerMove={onMove}
              onPointerUp={(e) => onUp(e, app)}
              onPointerCancel={() => (dragRef.current = null)}
            >
              <span className="desktop-glyph" aria-hidden="true">
                {app.glyph}
              </span>
              <span className="desktop-label">{app.label}</span>
              <span className="desktop-file">{app.file}</span>
            </button>
          );
        })}
      </div>

      <div className="desktop-widgets desktop-widgets--top" aria-label="Desktop widgets (top right)">
        <DraggableWidget id="showcase" width={510}>
          {WIDGETS.showcase}
        </DraggableWidget>
        <div className="dw-wrap" style={{ width: 320 }}>
          {WIDGETS.rankings}
        </div>
      </div>

      <div className="desktop-widgets desktop-widgets--bottomleft" aria-label="Desktop widgets (bottom left)">
        <div className="dw-wrap" style={{ width: 210 }}>
          {WIDGETS.telemetry}
        </div>
      </div>

      <div className="desktop-widgets desktop-widgets--bottom" aria-label="Desktop widgets (bottom right)">
        <div className="dw-wrap" style={{ width: 200 }}>
          {WIDGETS.deckdiag}
        </div>
      </div>
    </div>
  );
}

function FolderOverlay({ folder, onClose }: { folder: HomeFolder; onClose: () => void }) {
  const { launch } = useAppLauncher();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="folder-overlay" role="dialog" aria-label={folder.label}>
      <div className="folder-overlay-head">
        <span className="folder-overlay-glyph" aria-hidden="true">{folder.glyph}</span>
        <span className="folder-overlay-title">{folder.label}</span>
        <button type="button" className="folder-overlay-close" aria-label={`Close ${folder.label}`} onClick={() => { click(); onClose(); }}>
          ✕
        </button>
      </div>
      <div className="desktop-icons">
        {folder.items.map((app) => (
          <button key={app.id} type="button" className="desktop-icon" onClick={() => { click(); onClose(); launch(app); }}>
            <span className="desktop-glyph" aria-hidden="true">{app.glyph}</span>
            <span className="desktop-label">{app.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
