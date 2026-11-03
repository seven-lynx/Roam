'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useWorkstation, type WindowId } from '@/components/WorkstationContext';
import { Window } from '@/components/Window';
import { ROLL_ALBUMS, ROLL_PHOTOS, type RollAlbum } from '@/lib/camera-roll';
import { setCustomWallpaper } from '@/lib/wallpaper';
import { recordWallpaperAction, recordRollRateAction } from '@/lib/roll-actions';
import { click } from '@/lib/sfx';

/**
 * "Gallery" — the diegetic camera-roll / photo-gallery program. Browsing
 * is local; two actions surface to the badge system (set a photo as the desktop
 * wallpaper, and "like" photos). Both are fire-and-forget and simply no-op when
 * the operator is signed out.
 */
export function CameraRollProgram() {
  const { isOpen, windows, showAlert } = useWorkstation();
  const [album, setAlbum] = useState<RollAlbum>('roll');
  const [selected, setSelected] = useState<string | null>(null);
  const [faves, setFaves] = useState<Set<string>>(() => new Set());
  const [onDeck, setOnDeck] = useState<Set<string>>(() => new Set());
  const swipeRef = useRef<{ x: number; y: number } | null>(null);

  const current = ROLL_PHOTOS.find((p) => p.id === selected) ?? null;

  // Only cycle with the keyboard while the roll window is the top-most visible one.
  const roll = windows['roll'];
  const visibleIds = (Object.keys(windows) as WindowId[]).filter((id) => windows[id] && !windows[id]!.minimized);
  const topZ = visibleIds.reduce((m, id) => Math.max(m, windows[id]!.z), 0);
  const rollFocused = roll ? !roll.minimized && roll.z === topZ : false;

  const step = (dir: 1 | -1) => {
    if (!current) return;
    const list = ROLL_PHOTOS.filter((p) => p.album === current.album);
    const i = list.findIndex((p) => p.id === current.id);
    if (i < 0) return;
    click();
    setSelected(list[(i + dir + list.length) % list.length].id);
  };

  useEffect(() => {
    if (!current || !rollFocused) return;
    const list = ROLL_PHOTOS.filter((p) => p.album === current.album);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const i = list.findIndex((p) => p.id === current.id);
      if (i < 0) return;
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      click();
      setSelected(list[(i + dir + list.length) % list.length].id);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [current, rollFocused]);

  const onSwipeDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    swipeRef.current = { x: e.clientX, y: e.clientY };
  };
  const onSwipeUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
  };

  if (!isOpen('roll')) return null;

  const toggleFave = (id: string) => {
    click();
    const wasFaved = faves.has(id);
    const next = new Set(faves);
    if (wasFaved) next.delete(id);
    else next.add(id);
    setFaves(next);
    if (!wasFaved) recordRollRateAction(id);
  };

  const applyWallpaper = (id: string, src: string) => {
    click();
    setCustomWallpaper(`url("${src}") center / cover no-repeat, #07100f`);
    const next = new Set(onDeck);
    next.add(id);
    setOnDeck(next);
    recordWallpaperAction(id);
    showAlert('DECK UPDATED', 'Wallpaper set. The desktop now shows this frame.');
  };

  return (
    <Window id="roll" icon={<span aria-hidden="true">◳</span>}>
      {current ? (
        <div className="roll-detail">
          <div className="roll-detail-toolbar">
            <button type="button" className="roll-btn" style={{ flex: '0 0 auto' }} onClick={() => { click(); setSelected(null); }}>
              ← BACK
            </button>
            <span className="roll-caption">{current.label}</span>
            <button type="button" className="roll-btn roll-nav" aria-label="Previous photo" onClick={() => step(-1)}>
              ◀
            </button>
            <button type="button" className="roll-btn roll-nav" aria-label="Next photo" onClick={() => step(1)}>
              ▶
            </button>
          </div>
          <div
            className="roll-detail-img"
            onPointerDown={onSwipeDown}
            onPointerUp={onSwipeUp}
            onPointerCancel={() => (swipeRef.current = null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.src} alt={current.label} draggable={false} />
          </div>
          <div className="roll-actions">
            <button
              type="button"
              className="roll-btn"
              aria-pressed={faves.has(current.id)}
              onClick={() => toggleFave(current.id)}
            >
              {faves.has(current.id) ? '♥ LIKED' : '♡ LIKE'}
            </button>
            <button
              type="button"
              className="roll-btn"
              aria-pressed={onDeck.has(current.id)}
              onClick={() => applyWallpaper(current.id, current.src)}
            >
              {onDeck.has(current.id) ? '✓ ON DECK' : '◳ SET WALLPAPER'}
            </button>
          </div>
        </div>
      ) : (
        <div className="roll-body">
          <div className="roll-tabs">
            {ROLL_ALBUMS.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`roll-tab${album === a.id ? ' is-on' : ''}`}
                onClick={() => { click(); setAlbum(a.id); }}
              >
                {a.label}
              </button>
            ))}
          </div>
          <div className="roll-grid">
            {ROLL_PHOTOS.filter((p) => p.album === album).map((p) => (
              <button
                key={p.id}
                type="button"
                className={`roll-thumb${faves.has(p.id) ? ' is-fav' : ''}`}
                aria-label={p.label}
                onClick={() => { click(); setSelected(p.id); }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt={p.label} loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}
    </Window>
  );
}
