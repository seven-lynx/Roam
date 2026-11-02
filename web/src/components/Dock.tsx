'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { click, like } from '@/lib/sfx';
import { useAuth } from '@/components/AuthProvider';
import { useWorkstation, type WindowId } from '@/components/WorkstationContext';
import { fetchUrlMeta } from '@/lib/scan';
import { setRating } from '@/lib/ratings';

/**
 * In-screen taskbar. The main controls sit centered (downvote · launcher · ROAM ·
 * settings · upvote, mirroring the Android control deck), with open windows on
 * the left and the system tray (terminal, comms, display/sound dropdowns,
 * inspect) on the right.
 */
export function Dock() {
  const {
    windows,
    openWindow,
    toggleLauncher,
    minimizeWindow,
    focusWindow,
    fx,
    setFx,
    volume,
    setVolume,
    muted,
    toggleMute,
    setMuted,
    brightness,
    setBrightness,
    warp,
    setWarp,
    inspect,
    toggleInspect,
    browse,
    updateBrowse,
    showAlert,
    minimizeAll,
    restoreAll,
    taskbarAutoHide,
  } = useWorkstation();
  const { session } = useAuth();
  const router = useRouter();
  const [menu, setMenu] = useState<'display' | 'sound' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const ids = (Object.keys(windows) as WindowId[]).filter((id) => windows[id]);
  const topZ = ids.reduce((m, id) => Math.max(m, windows[id]!.z), 0);
  const anyVisible = ids.some((id) => !windows[id]!.minimized);

  const onTile = (id: WindowId) => {
    const w = windows[id];
    if (!w) return;
    if (w.minimized) focusWindow(id);
    else if (w.z === topZ) minimizeWindow(id);
    else focusWindow(id);
  };

  // Close any open dropdown on outside click.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const rate = async (value: 1 | -1) => {
    if (!browse) return;
    if (!session?.user?.id) {
      showAlert('ACCESS DENIED', 'Log in to rate pages.\n\nRedirecting…');
      router.push('/signup?mode=signin');
      return;
    }
    if (!browse.urlId || browse.rated === value) return;

    like();
    const prev = { rated: browse.rated, upvotes: browse.upvotes ?? 0, downvotes: browse.downvotes ?? 0 };
    updateBrowse({ ...browse, rated: value, upvotes: prev.upvotes, downvotes: prev.downvotes });

    const ok = await setRating(browse.urlId, session.user.id, value);
    const fresh = ok ? await fetchUrlMeta(browse.url) : null;
    if (ok && fresh) {
      updateBrowse({
        ...browse,
        rated: value,
        upvotes: fresh.upvotes,
        downvotes: fresh.downvotes,
        wilsonScore: fresh.wilsonScore,
      });
    } else if (!ok) {
      updateBrowse({ ...browse, ...prev });
    }
  };

  return (
    <div className="dock" role="toolbar" aria-label="Taskbar" data-autohide={taskbarAutoHide ? 'on' : 'off'}>
      <div className="dock-windows">
        {ids.map((id) => {
          const w = windows[id]!;
          return (
            <button
              key={id}
              type="button"
              className={`dock-tile${w.z === topZ ? ' is-focused' : ''}${w.minimized ? ' is-minimized' : ''}`}
              onClick={() => {
                click();
                onTile(id);
              }}
            >
              <span className="dock-led" aria-hidden="true" />
              <span className="dock-tile-label">{w.title}</span>
            </button>
          );
        })}
      </div>

      <div className="dock-main">
        <button
          type="button"
          className={`dock-btn${browse?.rated === -1 ? ' is-on' : ''}`}
          onClick={() => rate(-1)}
          disabled={!browse}
          data-tip="Downvote current page"
          aria-label="Downvote current page"
        >
          ▼
        </button>
        <button type="button" className="dock-btn" onClick={() => { click(); toggleLauncher(); }} data-tip="Programs" aria-label="Programs">
          ▤
        </button>
        <button type="button" className="dock-btn dock-roam" onClick={() => { click(); openWindow('scan'); }} data-tip="Roam" aria-label="Roam">
          ◎
        </button>
        <button type="button" className="dock-btn" onClick={() => { click(); openWindow('settings'); }} data-tip="Settings" aria-label="Settings">
          ⚙
        </button>
        <button
          type="button"
          className={`dock-btn${browse?.rated === 1 ? ' is-on' : ''}`}
          onClick={() => rate(1)}
          disabled={!browse}
          data-tip="Upvote current page"
          aria-label="Upvote current page"
        >
          ▲
        </button>
      </div>

      <div className="dock-tray" ref={menuRef}>
        <button type="button" className="dock-btn" onClick={() => { click(); openWindow('terminal'); }} data-tip="Terminal" aria-label="Terminal">
          &gt;_
        </button>
        <button type="button" className="dock-btn" onClick={() => { click(); openWindow('feedback'); }} data-tip="Comms" aria-label="Comms">
          ☰
        </button>
        <button type="button" className="dock-btn" onClick={() => { click(); openWindow('cyberdeck'); }} data-tip="Cyberdeck controls" aria-label="Cyberdeck controls">
          ▣
        </button>

        <div className="dock-menu">
          <button
            type="button"
            className="dock-btn"
            aria-expanded={menu === 'display'}
            onClick={() => { click(); setMenu(menu === 'display' ? null : 'display'); }}
            data-tip="Display"
            aria-label="Display settings"
          >
            ◐
          </button>
          {menu === 'display' && (
            <div className="dock-menu-panel">
              <div className="dock-menu-row">
                <span className="dock-menu-label">FX</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={fx}
                  className={`dock-switch${fx ? ' is-on' : ''}`}
                  onClick={() => { click(); setFx(!fx); }}
                >
                  {fx ? 'ON' : 'OFF'}
                </button>
              </div>
              <label className="dock-menu-row">
                <span className="dock-menu-label">BRT</span>
                <input
                  type="range"
                  min={35}
                  max={130}
                  value={Math.round(brightness * 100)}
                  onChange={(e) => setBrightness(Number(e.target.value) / 100)}
                  className="tray-slider"
                />
              </label>
              <label className="dock-menu-row">
                <span className="dock-menu-label">WARP</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(warp * 100)}
                  onChange={(e) => setWarp(Number(e.target.value) / 100)}
                  className="tray-slider"
                />
              </label>
            </div>
          )}
        </div>

        <div className="dock-menu">
          <button
            type="button"
            className="dock-btn"
            aria-expanded={menu === 'sound'}
            onClick={() => { click(); setMenu(menu === 'sound' ? null : 'sound'); }}
            data-tip="Sound"
            aria-label="Sound settings"
          >
            {muted ? '♪̶' : '♪'}
          </button>
          {menu === 'sound' && (
            <div className="dock-menu-panel">
              <div className="dock-menu-row">
                <span className="dock-menu-label">MUTE</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={muted}
                  className={`dock-switch${muted ? ' is-on' : ''}`}
                  onClick={() => { click(); toggleMute(); }}
                >
                  {muted ? 'ON' : 'OFF'}
                </button>
              </div>
              <label className="dock-menu-row">
                <span className="dock-menu-label">VOL</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(volume * 100)}
                  onChange={(e) => {
                    const v = Number(e.target.value) / 100;
                    setVolume(v);
                    if (v > 0) setMuted(false);
                  }}
                  className="tray-slider"
                />
              </label>
            </div>
          )}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={inspect}
          onClick={() => { click(); toggleInspect(); }}
          className="dock-btn"
          data-tip="Inspect the deck"
          aria-label="Inspect the deck (orbit mode)"
        >
          ⟳
        </button>

        <button
          type="button"
          className="dock-btn"
          data-tip="Show desktop"
          aria-label={anyVisible ? 'Show desktop (minimize all)' : 'Restore windows'}
          onClick={() => { click(); if (anyVisible) minimizeAll(); else restoreAll(); }}
        >
          ⧉
        </button>
      </div>
    </div>
  );
}