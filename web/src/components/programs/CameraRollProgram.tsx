'use client';

import { useState } from 'react';
import { useWorkstation } from '@/components/WorkstationContext';
import { Window } from '@/components/Window';
import { ROLL_ALBUMS, ROLL_PHOTOS, type RollAlbum } from '@/lib/camera-roll';
import { setCustomWallpaper } from '@/lib/wallpaper';
import { recordWallpaperAction, recordRollRateAction } from '@/lib/roll-actions';
import { click } from '@/lib/sfx';

/**
 * "Cyberdeck Roll" — the diegetic camera-roll / photo-gallery program. Browsing
 * is local; two actions surface to the badge system (set a photo as the desktop
 * wallpaper, and "like" photos). Both are fire-and-forget and simply no-op when
 * the operator is signed out.
 */
export function CameraRollProgram() {
  const { isOpen, showAlert } = useWorkstation();
  const [album, setAlbum] = useState<RollAlbum>('roll');
  const [selected, setSelected] = useState<string | null>(null);
  const [faves, setFaves] = useState<Set<string>>(() => new Set());
  const [onDeck, setOnDeck] = useState<Set<string>>(() => new Set());

  if (!isOpen('roll')) return null;

  const current = ROLL_PHOTOS.find((p) => p.id === selected) ?? null;

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
          </div>
          <div className="roll-detail-img">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.src} alt={current.label} />
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
