'use client';

import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useWorkstation, type WindowId } from '@/components/WorkstationContext';
import { click } from '@/lib/sfx';
import { SiteShowcase } from '@/components/SiteShowcase';
import { RankingsWidget } from '@/components/RankingsWidget';
import { TelemetryWidget } from '@/components/TelemetryWidget';
import { DeckDiagnosticsWidget } from '@/components/DeckDiagnosticsWidget';
import { DraggableWidget } from '@/components/DraggableWidget';
import {
  WALLPAPERS,
  useWallpaper,
  selectWallpaper,
  setCustomWallpaper,
  setWallpaperMode,
  applyRandomWallpaper,
  WALLPAPER_CYCLE_MS,
} from '@/lib/wallpaper';

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

interface IconPos {
  x: number;
  y: number;
}

type IconMap = Record<string, IconPos>;

function defaultPositions(): IconMap {
  const out: IconMap = {};
  const PER_COL = 9;
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
  const { openWindow, toggleLauncher } = useWorkstation();
  const [positions, setPositions] = useState<IconMap>(loadPositions);
  const wallpaper = useWallpaper();
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const onUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      setCustomWallpaper(`url("${reader.result}") center / cover no-repeat, #07100f`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
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

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const widgetSpecs = [
    { id: 'showcase', x: Math.max(12, vw - 380), y: 56, w: 360, node: <SiteShowcase /> },
    { id: 'rankings', x: Math.max(12, vw - 380), y: 504, w: 320, node: <RankingsWidget limit={5} /> },
    { id: 'telemetry', x: Math.max(12, vw - 700), y: 470, w: 260, node: <TelemetryWidget /> },
    { id: 'deckdiag', x: Math.max(12, vw - 700), y: 56, w: 300, node: <DeckDiagnosticsWidget /> },
  ];

  return (
    <div className="desktop" aria-label="Desktop" style={{ background: wallpaper.current.css }}>
      <div className="desktop-toolbar">
        <button
          type="button"
          className="desktop-wallpaper-btn"
          onClick={() => { click(); setPickerOpen((v) => !v); }}
          aria-expanded={pickerOpen}
        >
          🖼 Wallpaper
        </button>
        {pickerOpen && (
          <div className="desktop-wallpaper-panel">
            <button
              type="button"
              className={`desktop-wallpaper-cycle${wallpaper.mode === 'cycle' ? ' is-on' : ''}`}
              onClick={() => { click(); setWallpaperMode(wallpaper.mode === 'cycle' ? 'fixed' : 'cycle'); }}
            >
              <span className="dot" />
              {wallpaper.mode === 'cycle' ? 'Auto-cycle: on' : 'Auto-cycle: off'}
            </button>
            <div className="desktop-wallpaper-grid">
              {WALLPAPERS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className={`desktop-wallpaper-swatch${wallpaper.current.id === w.id && wallpaper.mode === 'fixed' ? ' is-on' : ''}`}
                  style={{ background: w.css }}
                  onClick={() => { click(); selectWallpaper(w.id); }}
                  aria-label={w.label}
                  title={w.label}
                />
              ))}
              {wallpaper.custom && (
                <button
                  type="button"
                  className={`desktop-wallpaper-swatch${wallpaper.current.id === 'custom' ? ' is-on' : ''}`}
                  style={{ background: wallpaper.custom.css }}
                  onClick={() => { click(); selectWallpaper('custom'); }}
                  aria-label="Custom"
                  title="Custom"
                />
              )}
            </div>
            <button type="button" className="desktop-wallpaper-upload" onClick={() => fileRef.current?.click()}>
              Upload image
            </button>
            <p className="desktop-wallpaper-note">Uploads stay on this device and are saved with your preferences.</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />
          </div>
        )}
      </div>

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

      <div className="desktop-widgets" aria-label="Desktop widgets">
        {widgetSpecs.map((w) => (
          <DraggableWidget key={w.id} id={w.id} defaultX={w.x} defaultY={w.y} width={w.w}>
            {w.node}
          </DraggableWidget>
        ))}
      </div>
    </div>
  );
}
