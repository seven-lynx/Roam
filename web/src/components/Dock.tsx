'use client';

import { useEffect, useState } from 'react';
import {
  useWorkstation,
  BRIGHTNESS_MIN,
  BRIGHTNESS_MAX,
  type WindowId,
} from '@/components/WorkstationContext';

const QUICK: { id: WindowId; label: string; glyph: string }[] = [
  { id: 'scan', label: 'Roam', glyph: '◎' },
  { id: 'launcher', label: 'Programs', glyph: '▤' },
  { id: 'terminal', label: 'Terminal', glyph: '>_' },
  { id: 'feedback', label: 'Comms', glyph: '☰' },
];

function SignalBars() {
  return (
    <span className="dock-signal" role="img" aria-label="Signal: strong">
      {[4, 7, 10, 12].map((h, i) => (
        <span key={i} style={{ height: h, opacity: 0.45 + i * 0.18 }} />
      ))}
    </span>
  );
}

/** In-screen taskbar: quick-launch, open windows, and the system tray. */
export function Dock() {
  const { windows, openWindow, minimizeWindow, focusWindow, sound, setSound, fx, setFx, volume, setVolume, brightness, setBrightness, artVariant, setArtVariant } = useWorkstation();
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, []);

  const ids = (Object.keys(windows) as WindowId[]).filter((id) => windows[id]);
  const topZ = ids.reduce((m, id) => Math.max(m, windows[id]!.z), 0);

  const onTile = (id: WindowId) => {
    const w = windows[id];
    if (!w) return;
    if (w.minimized) focusWindow(id);
    else if (w.z === topZ) minimizeWindow(id);
    else focusWindow(id);
  };

  return (
    <div className="dock" role="toolbar" aria-label="Taskbar">
      <div className="dock-quick">
        {QUICK.map((q) => (
          <button key={q.id} type="button" className="dock-btn" onClick={() => openWindow(q.id)} title={q.label} aria-label={q.label}>
            <span aria-hidden="true">{q.glyph}</span>
          </button>
        ))}
      </div>

      <div className="dock-windows">
        {ids.map((id) => {
          const w = windows[id]!;
          return (
            <button
              key={id}
              type="button"
              className={`dock-tile${w.z === topZ ? ' is-focused' : ''}${w.minimized ? ' is-minimized' : ''}`}
              onClick={() => onTile(id)}
            >
              <span className="dock-led" aria-hidden="true" />
              <span className="dock-tile-label">{w.title}</span>
            </button>
          );
        })}
      </div>

      <div className="dock-tray">
        <SignalBars />
        <span className="dock-clock" suppressHydrationWarning>{clock || '--:--'}</span>
        <button type="button" role="switch" aria-checked={sound} onClick={() => setSound(!sound)} className="tray-btn" title={sound ? 'Mute all sound' : 'Unmute sound'}>
          {sound ? '♪' : '♪̶'}
        </button>
        <button type="button" role="switch" aria-checked={fx} onClick={() => setFx(!fx)} className="tray-btn" title="CRT effects">FX</button>
        <button type="button" role="switch" aria-checked={artVariant === 'b'} onClick={() => setArtVariant(artVariant === 'a' ? 'b' : 'a')} className="tray-btn" title={`Desk art pack ${artVariant.toUpperCase()}`}>ART</button>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(e) => setVolume(Number(e.target.value) / 100)}
          className="tray-slider"
          aria-label="Volume"
        />
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(((brightness - BRIGHTNESS_MIN) / (BRIGHTNESS_MAX - BRIGHTNESS_MIN)) * 100)}
          onChange={(e) => setBrightness(BRIGHTNESS_MIN + (Number(e.target.value) / 100) * (BRIGHTNESS_MAX - BRIGHTNESS_MIN))}
          className="tray-slider"
          aria-label="Brightness"
        />
      </div>
    </div>
  );
}