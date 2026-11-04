'use client';

import { useRef, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkstation, THEME_PRESETS, BRIGHTNESS_MIN, BRIGHTNESS_MAX, type DisplayFx } from '@/components/WorkstationContext';
import { useAuth } from '@/components/AuthProvider';
import { Window } from '@/components/Window';
import { click, type SoundEffect } from '@/lib/sfx';
import {
  WALLPAPERS,
  useWallpaper,
  selectWallpaper,
  setCustomWallpaper,
  removeCustomWallpaper,
  setWallpaperMode,
} from '@/lib/wallpaper';

/**
 * Diegetic ROAM-OS settings panel. A floating window (not a route) that exposes
 * the workstation preferences — CRT, audio, deck framing — with hardware-style
 * labels. The account/site settings remain on the `/settings` route.
 */

function Toggle({
  on,
  onChange,
  label,
  hint,
}: {
  on: boolean;
  onChange: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button type="button" className="set-row" role="switch" aria-checked={on} onClick={() => { click(); onChange(); }}>
      <span className="set-info">
        <span className="set-label">{label}</span>
        <span className="set-hint">{hint}</span>
      </span>
      <span className={`set-toggle${on ? ' is-on' : ''}`} aria-hidden="true">
        <span />
      </span>
    </button>
  );
}

function Slider({
  value,
  min,
  max,
  step,
  onChange,
  label,
  fmt,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  label: string;
  fmt: (v: number) => string;
}) {
  return (
    <div className="set-row set-row--block">
      <div className="set-info">
        <span className="set-label">{label}</span>
        <span className="set-hint">{fmt(value)}</span>
      </div>
      <input
        type="range"
        className="set-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
    </div>
  );
}

const DISPLAY_FX_ITEMS: { name: keyof DisplayFx; label: string; hint: string }[] = [
  { name: 'scanlines', label: 'Scanlines', hint: 'horizontal raster lines' },
  { name: 'grille', label: 'Aperture grille', hint: 'RGB phosphor stripes' },
  { name: 'grain', label: 'Grain', hint: 'analog noise' },
  { name: 'static', label: 'Static', hint: 'animated snow' },
  { name: 'fringe', label: 'Chromatic fringe', hint: 'red/cyan edge split' },
  { name: 'vignette', label: 'Vignette', hint: 'corner falloff' },
  { name: 'flicker', label: 'Flicker', hint: 'tube brightness flutter' },
  { name: 'curvature', label: 'Curvature', hint: 'dark corners + glare' },
  { name: 'barrel', label: 'Barrel warp', hint: 'geometric screen curvature' },
];

const SOUND_GROUPS: { label: string; items: { name: SoundEffect; label: string; hint: string }[] }[] = [
  {
    label: 'CLICKS',
    items: [
      { name: 'click', label: 'UI click', hint: 'the mechanical tick on every button' },
      { name: 'clickHeavy', label: 'Heavy click', hint: 'window close / confirm chunk' },
      { name: 'clickNav', label: 'Nav click', hint: 'launcher + dock navigation' },
    ],
  },
  {
    label: 'LOADING',
    items: [
      { name: 'loadStart', label: 'Load start', hint: 'boot chime' },
      { name: 'loadComplete', label: 'Load complete', hint: 'mount fanfare' },
    ],
  },
  {
    label: 'ALERTS',
    items: [
      { name: 'beep', label: 'Game beep', hint: 'snake / tetris / botfield blips' },
      { name: 'success', label: 'Success', hint: 'task complete jingle' },
      { name: 'badgeEarn', label: 'Badge earned', hint: 'achievement chime' },
      { name: 'levelUp', label: 'Level up', hint: 'rank-up fanfare' },
      { name: 'mountComplete', label: 'Mount complete', hint: 'deck mounted' },
    ],
  },
  {
    label: 'AMBIENCE',
    items: [
      { name: 'ambient', label: 'Mains hum', hint: 'the 50Hz deck ambience' },
      { name: 'serverHum', label: 'Server hum', hint: 'distant data-flow' },
      { name: 'blip', label: 'Radar blip', hint: 'soft instrument blip' },
    ],
  },
  {
    label: 'FEED',
    items: [
      { name: 'scanBlip', label: 'Scan blip', hint: 'scanner ping' },
      { name: 'modemBlip', label: 'Modem blip', hint: 'handshake tone' },
      { name: 'relayTick', label: 'Relay tick', hint: 'packet relay' },
      { name: 'like', label: 'Like', hint: 'upvote tone' },
      { name: 'skip', label: 'Skip', hint: 'downvote tone' },
      { name: 'saveUrl', label: 'Save URL', hint: 'bookmark chime' },
    ],
  },
];

export function SettingsApp() {
  const {
    isOpen,
    fx, setFx,
    warp, setWarp,
    brightness, setBrightness,
    displayFx, setDisplayFx,
    theme, setTheme,
    sound, setSound,
    soundFx, setSoundFx,
    muted, toggleMute,
    volume, setVolume,
    inspect, toggleInspect,
    deckMode, setDeckMode,
    taskbarAutoHide, setTaskbarAutoHide,
    uiMode, setUiMode, handheld,
    showAlert,
    resetCamera,
    resetOsSettings,
    widgets, toggleWidget,
  } = useWorkstation();
  const { session } = useAuth();
  const router = useRouter();
  const wallpaper = useWallpaper();
  const fileRef = useRef<HTMLInputElement>(null);

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

  const open = isOpen('settings');
  if (!open) return null;

  return (
    <Window id="settings" icon={<span aria-hidden="true">⚙</span>}>
      <div className="window-scroll">
        <div className="p-4 flex flex-col gap-4">
          <section className="panel">
            <div className="panel-head"><span className="led" />DISPLAY</div>
            <div className="p-2">
              <Toggle on={fx} onChange={() => setFx(!fx)} label="CRT effects" hint="master switch for the whole overlay set" />
              {DISPLAY_FX_ITEMS.map((item) => (
                <Toggle
                  key={item.name}
                  on={displayFx[item.name]}
                  onChange={() => setDisplayFx({ [item.name]: !displayFx[item.name] })}
                  label={item.label}
                  hint={item.hint}
                />
              ))}
              <Slider value={warp} min={0} max={1} step={0.05} onChange={setWarp} label="Barrel curvature" fmt={(v) => `${Math.round(v * 100)}%`} />
              <Slider value={brightness} min={BRIGHTNESS_MIN} max={BRIGHTNESS_MAX} step={0.05} onChange={setBrightness} label="Brightness" fmt={(v) => `${Math.round(v * 100)}%`} />
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><span className="led" />WALLPAPER</div>
            <div className="p-2">
              <button
                type="button"
                className={`desktop-wallpaper-cycle${wallpaper.mode === 'cycle' ? ' is-on' : ''}`}
                onClick={() => { click(); setWallpaperMode(wallpaper.mode === 'cycle' ? 'fixed' : 'cycle'); }}
              >
                <span className="dot" />
                {wallpaper.mode === 'cycle' ? 'Auto-cycle: on' : 'Auto-cycle: off'}
              </button>
              <div className="desktop-wallpaper-grid settings-wallpaper-grid" style={{ marginTop: 8 }}>
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
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button type="button" className="desktop-wallpaper-upload" onClick={() => fileRef.current?.click()}>
                  Upload image
                </button>
                {wallpaper.custom && (
                  <button type="button" className="desktop-wallpaper-upload" onClick={() => { click(); removeCustomWallpaper(); }}>
                    Remove custom
                  </button>
                )}
              </div>
              <p className="desktop-wallpaper-note" style={{ marginTop: 6 }}>
                Uploads stay on this device and are saved with your preferences.
              </p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><span className="led" />SHELL</div>
            <div className="p-2">
              <Toggle
                on={handheld}
                onChange={() => setUiMode(handheld ? 'desktop' : 'handheld')}
                label="Handheld mode"
                hint="palm-top shell · full-screen programs · thumb deck (off = desk rig)"
              />
              <Toggle on={taskbarAutoHide} onChange={() => setTaskbarAutoHide(!taskbarAutoHide)} label="Auto-hide dock" hint="slides away until you hover the bottom edge" />
              {uiMode !== 'auto' && (
                <button type="button" className="set-btn" onClick={() => { click(); setUiMode('auto'); }}>
                  Reset to auto-detect
                </button>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><span className="led" />WIDGETS</div>
            <div className="p-2">
              <Toggle on={widgets.showcase} onChange={() => toggleWidget('showcase')} label="This month's picks" hint="showcase slideshow" />
              <Toggle on={widgets.rankings} onChange={() => toggleWidget('rankings')} label="Rankings" hint="top explorers" />
              <Toggle on={widgets.telemetry} onChange={() => toggleWidget('telemetry')} label="Sys telemetry" hint="network counters" />
              <Toggle on={widgets.deckdiag} onChange={() => toggleWidget('deckdiag')} label="Deck diagnostics" hint="load / hot / warm rings" />
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><span className="led" />THEME</div>
            <div className="p-2">
              <div className="ctl-swatches" role="radiogroup" aria-label="Color theme">
                {THEME_PRESETS.map((p) => (
                  <button key={p.id} type="button" role="radio" aria-checked={theme === p.id}
                    className={`ctl-swatch${theme === p.id ? ' is-on' : ''}`}
                    style={{ background: `linear-gradient(135deg, ${p.phosphor} 0% 50%, ${p.accent} 50% 100%)` }}
                    onClick={() => { click(); setTheme(p.id); }}
                    title={p.label} aria-label={p.label} />
                ))}
              </div>
              <p className="set-hint">Color theme — recolors the entire OS.</p>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><span className="led" />AUDIO</div>
            <div className="p-2">
              <Toggle on={sound} onChange={() => setSound(!sound)} label="Master sound" hint="turns the whole deck silent" />
              <Toggle on={muted} onChange={toggleMute} label="Muted" hint="soft-mute without losing volume" />
              <Slider value={volume} min={0} max={1} step={0.05} onChange={setVolume} label="Volume" fmt={(v) => `${Math.round(v * 100)}%`} />
              <div className="set-hint" style={{ margin: '0.5rem 0 0.25rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Individual sound effects
              </div>
              {SOUND_GROUPS.map((group) => (
                <div key={group.label} className="set-sub">
                  <div className="set-subhead">{group.label}</div>
                  {group.items.map((item) => (
                    <Toggle
                      key={item.name}
                      on={soundFx[item.name]}
                      onChange={() => setSoundFx(item.name, !soundFx[item.name])}
                      label={item.label}
                      hint={item.hint}
                    />
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><span className="led" />DECK</div>
            <div className="p-2">
              <Toggle on={inspect} onChange={toggleInspect} label="Inspect (orbit) mode" hint="unlocks the deck camera" />
              <Toggle on={deckMode} onChange={() => setDeckMode(!deckMode)} label="Cyberdeck view" hint="show the 3D cyberdeck" />
              <button type="button" className="set-btn" onClick={() => { click(); resetCamera(); }}>Reset camera framing</button>
              <button type="button" className="set-btn set-btn--danger" onClick={() => { click(); resetOsSettings(); }}>Factory reset OS settings</button>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><span className="led" />ACCOUNT</div>
            <div className="p-2">
              {session ? (
                <button type="button" className="set-btn" onClick={() => { click(); router.push('/settings'); }}>
                  Account &amp; site settings →
                </button>
              ) : (
                <button
                  type="button"
                  className="set-btn"
                  onClick={() => {
                    click();
                    showAlert('ACCESS DENIED', 'Account settings require a signed-in operator.\n\nRedirecting to sign-in…');
                    router.push('/signup?mode=signin');
                  }}
                >
                  Log in for account settings →
                </button>
              )}
            </div>
          </section>

          <p className="text-center font-mono text-[10px] tracking-widest text-muted">~/.roamrc · ROAM-OS v2.6</p>
        </div>
      </div>
    </Window>
  );
}
