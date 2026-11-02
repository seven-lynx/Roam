'use client';

import { useRouter } from 'next/navigation';
import { useWorkstation, THEME_PRESETS, BRIGHTNESS_MIN, BRIGHTNESS_MAX } from '@/components/WorkstationContext';
import { useAuth } from '@/components/AuthProvider';
import { Window } from '@/components/Window';
import { click } from '@/lib/sfx';

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

export function SettingsApp() {
  const {
    isOpen,
    fx, setFx,
    warp, setWarp,
    brightness, setBrightness,
    theme, setTheme,
    sound, setSound,
    muted, toggleMute,
    volume, setVolume,
    inspect, toggleInspect,
    deckMode, setDeckMode,
    taskbarAutoHide, setTaskbarAutoHide,
    uiMode, setUiMode, handheld,
    showAlert,
    resetCamera,
    resetOsSettings,
  } = useWorkstation();
  const { session } = useAuth();
  const router = useRouter();

  const open = isOpen('settings');
  if (!open) return null;

  return (
    <Window id="settings" icon={<span aria-hidden="true">⚙</span>}>
      <div className="window-scroll">
        <div className="p-4 flex flex-col gap-4">
          <section className="panel">
            <div className="panel-head"><span className="led" />DISPLAY</div>
            <div className="p-2">
              <Toggle on={fx} onChange={() => setFx(!fx)} label="CRT effects" hint="scanlines · grain · vignette · barrel warp" />
              <Slider value={warp} min={0} max={1} step={0.05} onChange={setWarp} label="Barrel curvature" fmt={(v) => `${Math.round(v * 100)}%`} />
              <Slider value={brightness} min={BRIGHTNESS_MIN} max={BRIGHTNESS_MAX} step={0.05} onChange={setBrightness} label="Brightness" fmt={(v) => `${Math.round(v * 100)}%`} />
              <Toggle on={taskbarAutoHide} onChange={() => setTaskbarAutoHide(!taskbarAutoHide)} label="Auto-hide taskbar" hint="slides away until you hover the bottom edge" />
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
              {uiMode !== 'auto' && (
                <button type="button" className="set-btn" onClick={() => { click(); setUiMode('auto'); }}>
                  Reset to auto-detect
                </button>
              )}
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
