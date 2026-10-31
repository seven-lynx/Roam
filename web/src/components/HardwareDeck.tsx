'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PRIMARY_KEYS, isActivePath } from '@/lib/os-nav';
import { KeyIcon } from '@/components/KeyIcon';
import { useWorkstation, BRIGHTNESS_MIN, BRIGHTNESS_MAX } from '@/components/WorkstationContext';
import { RotaryKnob } from '@/components/RotaryKnob';
import { click, clickHeavy, clickNav } from '@/lib/sfx';

const SCROLL_STEP = 220;

const DIODES = [
  { id: 'power', label: 'PWR' },
  { id: 'net', label: 'NET' },
  { id: 'disk', label: 'DSK' },
  { id: 'sig', label: 'SIG' },
  { id: 'sound', label: 'SND' },
  { id: 'scan', label: 'SCN' },
] as const;
type DiodeId = (typeof DIODES)[number]['id'];

/**
 * Physical controls under the screen: route keys (real links), the ROAM/MENU/COMMS
 * keys, a status diode strip wired to live state, and two functional rotary knobs
 * (master volume + CRT brightness).
 */
export function HardwareDeck() {
  const pathname = usePathname();
  const {
    scrollRef,
    fx,
    setFx,
    sound,
    muted,
    volume,
    setVolume,
    toggleMute,
    brightness,
    setBrightness,
    windows,
    openWindow,
    closeWindow,
  } = useWorkstation();

  const scanOpen = !!windows.scan;
  const launcherOpen = !!windows.launcher;

  // DISK diode blinks on every route change.
  const [disk, setDisk] = useState(false);
  useEffect(() => {
    setDisk(true);
    const t = setTimeout(() => setDisk(false), 350);
    return () => clearTimeout(t);
  }, [pathname]);

  // SIG diode tracks real connectivity.
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const scrollBy = (top: number, left = 0) => scrollRef.current?.scrollBy({ top, left, behavior: 'smooth' });

  const diodeOn: Record<DiodeId, boolean> = {
    power: true,
    net: scanOpen,
    disk,
    sig: online,
    sound: sound && !muted,
    scan: scanOpen,
  };

  return (
    <div className="deck" role="group" aria-label="Hardware controls">
      <div className="deck-brand" aria-hidden="true">
        <span className="plate">
          <span className="power-led" /> ROAM-OS
        </span>
        <img src="/7lynx-logo.png" alt="" className="lynx-mark" />
      </div>

      <nav className="deck-keys" aria-label="Main">
        {PRIMARY_KEYS.map((k) => {
          const active = isActivePath(pathname, k.href);
          return (
            <Link
              key={k.href}
              href={k.href}
              className="keycap"
              aria-current={active ? 'page' : undefined}
              title={k.file}
              onClick={() => click()}
            >
              <KeyIcon name={k.icon} />
              <span className="keycap-label">{k.label}</span>
              <span className="key-led" aria-hidden="true" />
            </Link>
          );
        })}
        <button
          type="button"
          className="keycap"
          aria-expanded={launcherOpen}
          aria-haspopup="dialog"
          onClick={() => (launcherOpen ? closeWindow('launcher') : openWindow('launcher'))}
          title="menu"
        >
          <KeyIcon name="menu" />
          <span className="keycap-label">Menu</span>
          <span className="key-led" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="keycap keycap--roam"
          onClick={() => {
            clickHeavy();
            openWindow('scan');
          }}
          title="roam scan"
        >
          <KeyIcon name="roam" />
          <span className="keycap-label">Roam</span>
          <span className="key-led" aria-hidden="true" />
        </button>
      </nav>

      <div className="deck-instruments" aria-label="Status and controls">
        <div className="diode-strip" aria-hidden="true">
          {DIODES.map((d) => (
            <span key={d.id} className="diode" data-on={diodeOn[d.id]}>
              <span className="diode-dot" />
              <span className="diode-label">{d.label}</span>
            </span>
          ))}
        </div>
        <RotaryKnob label="VOL" value={volume} onChange={setVolume} onPress={toggleMute} pressed={muted} />
        <RotaryKnob
          label="BRT"
          value={(brightness - BRIGHTNESS_MIN) / (BRIGHTNESS_MAX - BRIGHTNESS_MIN)}
          onChange={(v) => setBrightness(BRIGHTNESS_MIN + v * (BRIGHTNESS_MAX - BRIGHTNESS_MIN))}
        />
      </div>

      <div className="deck-side">
        <div className="dpad" role="group" aria-label="Scroll the screen">
          <button type="button" className="up" aria-label="Scroll up" onClick={() => scrollBy(-SCROLL_STEP)}>▲</button>
          <button type="button" className="down" aria-label="Scroll down" onClick={() => scrollBy(SCROLL_STEP)}>▼</button>
          <button type="button" className="left" aria-label="Scroll left" onClick={() => scrollBy(0, -SCROLL_STEP)}>◀</button>
          <button type="button" className="right" aria-label="Scroll right" onClick={() => scrollBy(0, SCROLL_STEP)}>▶</button>
        </div>
        <div className="flex flex-col gap-2 items-center">
          <button
            type="button"
            className="keycap !flex-none !px-3"
            onClick={() => {
              clickNav();
              openWindow('feedback');
            }}
            title="roam comms"
          >
            <KeyIcon name="comms" className="w-3.5 h-3.5" />
            <span className="keycap-label">Comms</span>
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={fx}
            aria-label="CRT effects"
            className="switch"
            onClick={() => {
              clickNav();
              setFx(!fx);
            }}
          >
            <span className="switch-track"><span className="switch-thumb" /></span>
            FX
          </button>
        </div>
      </div>
    </div>
  );
}