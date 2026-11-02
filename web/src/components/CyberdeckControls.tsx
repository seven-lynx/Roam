'use client';

import {
  useWorkstation,
  THEME_PRESETS,
  BRIGHTNESS_MIN,
  BRIGHTNESS_MAX,
  CAMERA_ZOOM_MIN,
  CAMERA_ZOOM_MAX,
} from '@/components/WorkstationContext';
import { Window } from '@/components/Window';
import { click } from '@/lib/sfx';

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

/**
 * Friendly hardware control surface for the cyberdeck: screen phosphor color,
 * CRT/display, the physical switches (sound/fx), the camera framing, and the
 * factory reset. Opened from the dock tray (\"Cyberdeck controls\"). Account/site
 * settings stay on the `/settings` route; the lean `SETTINGS` window keeps the
 * core toggles.
 */
export function CyberdeckControls() {
  const {
    isOpen,
    fx, setFx,
    warp, setWarp,
    brightness, setBrightness,
    theme, setTheme,
    sound, setSound,
    volume, setVolume,
    muted, toggleMute,
    deckMode, setDeckMode,
    inspect, toggleInspect,
    camera, setCamera,
    resetCamera,
    saveFit,
    fitDeck,
    resetOsSettings,
  } = useWorkstation();

  const open = isOpen('cyberdeck');
  if (!open) return null;

  return (
    <Window id="cyberdeck" icon={<span aria-hidden="true">▣</span>}>
      <div className="window-scroll">
        <div className="p-4 flex flex-col gap-4">
          <section className="panel">
            <div className="panel-head"><span className="led" />THEME</div>
            <div className="p-2">
              <div className="ctl-swatches" role="radiogroup" aria-label="Color theme">
                {THEME_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={theme === p.id}
                    className={`ctl-swatch${theme === p.id ? ' is-on' : ''}`}
                    style={{ background: `linear-gradient(135deg, ${p.phosphor} 0% 50%, ${p.accent} 50% 100%)` }}
                    onClick={() => { click(); setTheme(p.id); }}
                    title={p.label}
                    aria-label={p.label}
                  />
                ))}
              </div>
              <p className="set-hint">Color theme — recolors the entire OS.</p>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><span className="led" />SCREEN</div>
            <div className="p-2">
              <Toggle on={fx} onChange={() => setFx(!fx)} label="CRT effects" hint="scanlines · grain · vignette · barrel warp" />
              <Slider value={warp} min={0} max={1} step={0.05} onChange={setWarp} label="Barrel curvature" fmt={(v) => `${Math.round(v * 100)}%`} />
              <Slider value={brightness} min={BRIGHTNESS_MIN} max={BRIGHTNESS_MAX} step={0.05} onChange={setBrightness} label="Brightness" fmt={(v) => `${Math.round(v * 100)}%`} />
              <Toggle on={deckMode} onChange={() => setDeckMode(!deckMode)} label="Cyberdeck view" hint="show the 3D cyberdeck" />
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><span className="led" />HARDWARE</div>
            <div className="p-2">
              <Toggle on={sound} onChange={() => setSound(!sound)} label="Master sound" hint="turns the whole deck silent" />
              <Toggle on={muted} onChange={toggleMute} label="Muted" hint="soft-mute without losing volume" />
              <Slider value={volume} min={0} max={1} step={0.05} onChange={setVolume} label="Volume" fmt={(v) => `${Math.round(v * 100)}%`} />
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><span className="led" />CAMERA</div>
            <div className="p-2">
              <Slider value={camera.zoom} min={CAMERA_ZOOM_MIN} max={CAMERA_ZOOM_MAX} step={0.05} onChange={(z) => setCamera({ ...camera, zoom: z })} label="Zoom" fmt={(v) => `${v.toFixed(2)}×`} />
              <div className="ctl-row">
                <button type="button" className="set-btn" onClick={() => { click(); resetCamera(); }}>Reset framing</button>
                <button type="button" className="set-btn" onClick={() => { click(); saveFit(); }}>Save fit</button>
                <button type="button" className="set-btn" onClick={() => { click(); fitDeck(); }}>Fit deck</button>
              </div>
              <button type="button" className="set-btn" onClick={() => { click(); toggleInspect(); }}>{inspect ? 'Exit inspect (orbit)' : 'Inspect (orbit) mode'}</button>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><span className="led" />DECK</div>
            <div className="p-2">
              <button type="button" className="set-btn set-btn--danger" onClick={() => { click(); resetOsSettings(); }}>Factory reset OS settings</button>
            </div>
          </section>

          <p className="text-center font-mono text-[10px] tracking-widest text-muted">~/.roamrc · ROAM-OS v2.6</p>
        </div>
      </div>
    </Window>
  );
}

