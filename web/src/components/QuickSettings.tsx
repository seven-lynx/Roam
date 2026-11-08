'use client';

import { useEffect, useState } from 'react';
import { useWorkstation, THEME_PRESETS, BRIGHTNESS_MIN, BRIGHTNESS_MAX } from '@/components/WorkstationContext';
import { click } from '@/lib/sfx';

function QuickTile({
  on,
  label,
  glyph,
  onToggle,
}: {
  on: boolean;
  label: string;
  glyph: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`quick-tile${on ? ' is-on' : ''}`}
      onClick={() => {
        click();
        onToggle();
      }}
    >
      <span className="quick-tile-glyph" aria-hidden="true">
        {glyph}
      </span>
      <span className="quick-tile-label">{label}</span>
    </button>
  );
}

function QuickRow({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="quick-row">
      <span className="quick-row-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
      <span className="quick-row-value">{value}</span>
    </label>
  );
}

/**
 * Swipe-down quick settings: an Android notification-shade style sheet with the
 * most-used hardware toggles and sliders, plus a shortcut into full Settings.
 */
export function QuickSettings() {
  const {
    quickSettingsOpen,
    setQuickSettingsOpen,
    fx,
    setFx,
    sound,
    setSound,
    muted,
    toggleMute,
    setMuted,
    volume,
    setVolume,
    brightness,
    setBrightness,
    warp,
    setWarp,
    theme,
    setTheme,
    inspect,
    toggleInspect,
    deckMode,
    setDeckMode,
    openWindow,
  } = useWorkstation();
  const [isFull, setIsFull] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined' || !document.fullscreenEnabled) return;
    const on = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  useEffect(() => {
    if (!quickSettingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setQuickSettingsOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [quickSettingsOpen, setQuickSettingsOpen]);

  if (!quickSettingsOpen) return null;

  const toggleFullscreen = () => {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    } catch {
      /* fullscreen unsupported */
    }
  };

  const setVolumeAndUnmute = (v: number) => {
    setVolume(v / 100);
    if (v > 0) setMuted(false);
  };

  return (
    <div className="quick-settings" role="dialog" aria-label="Quick settings">
      <div className="quick-settings-handle" aria-hidden="true" />

      <div className="quick-settings-head">
        <span className="quick-settings-title">Quick Settings</span>
        <button
          type="button"
          className="quick-settings-close"
          aria-label="Close quick settings"
          onClick={() => {
            click();
            setQuickSettingsOpen(false);
          }}
        >
          ✕
        </button>
      </div>

      <div className="quick-settings-scroll">
        <div className="quick-tiles">
          <QuickTile on={fx} label="FX" glyph="◐" onToggle={() => setFx(!fx)} />
          <QuickTile on={sound} label="Sound" glyph="♪" onToggle={() => setSound(!sound)} />
          <QuickTile on={muted} label="Mute" glyph="⊘" onToggle={toggleMute} />
          <QuickTile on={inspect} label="Orbit" glyph="⟳" onToggle={toggleInspect} />
          <QuickTile on={deckMode} label="Deck" glyph="⛶" onToggle={() => setDeckMode(!deckMode)} />
          <QuickTile on={isFull} label="Full" glyph="⛶" onToggle={toggleFullscreen} />
        </div>

        <div className="quick-rows">
          <QuickRow label="BRT" min={Math.round(BRIGHTNESS_MIN * 100)} max={Math.round(BRIGHTNESS_MAX * 100)} value={Math.round(brightness * 100)} onChange={(v) => setBrightness(v / 100)} />
          <QuickRow label="WARP" min={0} max={100} value={Math.round(warp * 100)} onChange={(v) => setWarp(v / 100)} />
          <QuickRow label="VOL" min={0} max={100} value={Math.round(volume * 100)} onChange={setVolumeAndUnmute} />
        </div>

        <div className="quick-themes">
          {THEME_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`quick-theme${theme === p.id ? ' is-active' : ''}`}
              style={{ background: p.phosphor }}
              aria-label={`Theme ${p.label}`}
              title={p.label}
              onClick={() => {
                click();
                setTheme(p.id);
              }}
            />
          ))}
        </div>

        <div className="quick-footer">
          <button
            type="button"
            className="quick-btn"
            onClick={() => {
              click();
              setQuickSettingsOpen(false);
              openWindow('settings');
            }}
          >
            More settings
          </button>
          <button
            type="button"
            className="quick-btn"
            onClick={() => {
              click();
              setQuickSettingsOpen(false);
              openWindow('terminal');
            }}
          >
            Terminal
          </button>
        </div>
      </div>
    </div>
  );
}
