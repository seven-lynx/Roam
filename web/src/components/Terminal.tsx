'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useWorkstation, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX, type WindowId, type Theme } from '@/components/WorkstationContext';
import { Window } from '@/components/Window';
import { parseCommand, formatSetting, COMMANDS } from '@/lib/terminal';
import { findSetting, parseSettingValue } from '@/lib/os-settings';
import { createClient } from '@/lib/supabase/client';
import { clickHeavy, clickNav } from '@/lib/sfx';

interface Line {
  text: string;
  kind: 'input' | 'output';
}

const APP_ALIASES: Record<string, WindowId> = {
  scan: 'scan',
  programs: 'launcher',
  launcher: 'launcher',
  terminal: 'terminal',
  comms: 'feedback',
  feedback: 'feedback',
  snake: 'snake',
  relay: 'snake',
  minesweeper: 'minesweeper',
  botfield: 'minesweeper',
  tetris: 'tetris',
  compiler: 'tetris',
  asteroids: 'asteroids',
  debris: 'asteroids',
};

/** In-screen command terminal — the desktop-terminal centrepiece of ROAM-OS. */
export function Terminal() {
  const {
    isOpen, openWindow, closeWindow, setLauncherOpen, fx, setFx, sound, setSound, volume, setVolume, brightness, setBrightness,
    warp, setWarp, artVariant, setArtVariant, muted, setMuted, toggleMute, inspect, setInspect,
    camera, setCamera, resetCamera, fitDeck, resetOsSettings, deckMode, setDeckMode, theme, setTheme,
  } = useWorkstation();
  const { session } = useAuth();
  const router = useRouter();
  const open = isOpen('terminal');
  const [lines, setLines] = useState<Line[]>([{ text: 'ROAM-OS terminal v2.7 — type "help"', kind: 'output' }]);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<string[]>([]);
  const histIndexRef = useRef(-1);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines, open]);

  // Read an OS setting (canonical key) into its printable value, or null.
  const readSetting = (key: string): string | number | boolean | null => {
    switch (key) {
      case 'fx': return fx;
      case 'sound': return sound;
      case 'muted': return muted;
      case 'volume': return Math.round(volume * 100);
      case 'brightness': return Math.round(brightness * 100);
      case 'warp': return Math.round(warp * 100);
      case 'art': return artVariant;
      case 'theme': return theme;
      case 'inspect': return inspect;
      case 'zoom': return Math.round(camera.zoom * 100) / 100;
      case 'panx': return Math.round(camera.panX);
      case 'pany': return Math.round(camera.panY);
      case 'deck': return deckMode;
      default: return null;
    }
  };

  // Apply a coerced value to an OS setting (canonical key). Returns false if unknown.
  const applySetting = (key: string, value: string | number | boolean): boolean => {
    switch (key) {
      case 'fx': setFx(value === true); return true;
      case 'sound': setSound(value === true); return true;
      case 'muted': setMuted(value === true); return true;
      case 'volume': setVolume(Number(value) / 100); return true;
      case 'brightness': setBrightness(Number(value) / 100); return true;
      case 'warp': setWarp(Number(value) / 100); return true;
      case 'art': setArtVariant(value === 'b' ? 'b' : 'a'); return true;
      case 'theme': setTheme(String(value) as Theme); return true;
      case 'inspect': setInspect(value === true); return true;
      case 'zoom': setCamera({ ...camera, zoom: Math.min(CAMERA_ZOOM_MAX, Math.max(CAMERA_ZOOM_MIN, Number(value))) }); return true;
      case 'panx': setCamera({ ...camera, panX: Number(value) }); return true;
      case 'pany': setCamera({ ...camera, panY: Number(value) }); return true;
      case 'deck': setDeckMode(value === true); return true;
      default: return false;
    }
  };

  const append = (output: string[]) => {
    setLines((prev) => prev.concat(output.map((t) => ({ text: t, kind: 'output' as const }))));
  };

  const run = (raw: string) => {
    const result = parseCommand(raw);
    historyRef.current.push(raw);
    histIndexRef.current = -1;

    setLines((prev) => {
      const next = [...prev, { text: `> ${raw}`, kind: 'input' as const }];
      if (result.type === 'output') return next.concat(result.lines.map((t) => ({ text: t, kind: 'output' as const })));
      if (result.type === 'clear') return [];
      return next;
    });

    if (result.type !== 'action') return;

    switch (result.action) {
      case 'roam':
        clickHeavy();
        openWindow('scan');
        break;
      case 'goto':
        router.push(result.arg.startsWith('/') ? result.arg : `/${result.arg}`);
        break;
      case 'open': {
        if (result.arg === 'launcher' || result.arg === 'programs') { clickNav(); setLauncherOpen(true); break; }
        const id = APP_ALIASES[result.arg];
        if (id) { clickNav(); openWindow(id); }
        break;
      }
      case 'close': {
        if (result.arg === 'launcher' || result.arg === 'programs') { clickNav(); setLauncherOpen(false); break; }
        const id = APP_ALIASES[result.arg];
        if (id) { clickNav(); closeWindow(id); }
        break;
      }
      case 'fx':
        clickNav();
        setFx(result.arg === 'on');
        break;
      case 'sound':
        clickNav();
        setSound(result.arg === 'on');
        break;
      case 'mute':
        clickNav();
        if (result.arg === 'on') setMuted(true);
        else if (result.arg === 'off') setMuted(false);
        else toggleMute();
        break;
      case 'vol':
        setVolume(Number(result.arg) / 100);
        break;
      case 'brt':
        setBrightness(Number(result.arg) / 100);
        break;
      case 'warp':
        setWarp(Number(result.arg) / 100);
        break;
      case 'art':
        clickNav();
        setArtVariant(result.arg === 'b' ? 'b' : 'a');
        break;
      case 'inspect':
        clickNav();
        if (result.arg === 'on') setInspect(true);
        else if (result.arg === 'off') setInspect(false);
        else setInspect(!inspect);
        break;
      case 'zoom': {
        const v = result.arg;
        if (v === 'in') setCamera({ ...camera, zoom: Math.min(CAMERA_ZOOM_MAX, camera.zoom + 0.1) });
        else if (v === 'out') setCamera({ ...camera, zoom: Math.max(CAMERA_ZOOM_MIN, camera.zoom - 0.1) });
        else if (v === 'reset') resetCamera();
        else setCamera({ ...camera, zoom: Number(v) });
        break;
      }
      case 'fit':
        fitDeck();
        break;
      case 'pan': {
        const [x, y] = result.arg.split(/\s+/).map(Number);
        setCamera({ ...camera, panX: x, panY: y });
        break;
      }
      case 'deck':
        clickNav();
        if (result.arg === 'on') setDeckMode(true);
        else if (result.arg === 'off') setDeckMode(false);
        else setDeckMode(!deckMode);
        break;
      case 'theme':
        clickNav();
        setTheme(result.arg as Theme);
        break;
      case 'history':
        append(historyRef.current.map((h, i) => `  ${String(i + 1).padStart(3, ' ')}  ${h}`));
        break;
      case 'reset':
        resetOsSettings();
        append(['system reset to factory defaults']);
        break;
      case 'logout':
        void createClient().auth.signOut();
        router.push('/');
        break;
      case 'set': {
        const [key, ...rest] = result.arg.split(/\s+/);
        const def = findSetting(key);
        if (!def) { append([`roam: unknown setting: ${key}`]); break; }
        const val = parseSettingValue(def, rest.join(' ').trim());
        if (val === null) { append([`roam: invalid value for ${def.key}`]); break; }
        if (!applySetting(def.key, val)) { append([`roam: cannot set ${def.key}`]); break; }
        append([`${def.key} → ${formatSetting(def.key, val)}`]);
        break;
      }
      case 'get': {
        const def = findSetting(result.arg);
        const val = readSetting(result.arg);
        if (!def || val === null) { append([`roam: unknown setting: ${result.arg}`]); break; }
        append([`${def.key} = ${formatSetting(def.key, val)}`]);
        break;
      }
      case 'whoami': {
        const name = (session?.user?.user_metadata?.display_name as string | undefined) || session?.user?.email;
        append([name ? `${name}@roam` : 'guest@roam']);
        break;
      }
      case 'sysinfo': {
        const operator = (session?.user?.user_metadata?.display_name as string | undefined) || session?.user?.email || 'guest';
        append([
          'ROAM-OS v2.7.0',
          `operator   ${operator}`,
          `fx         ${fx ? 'on' : 'off'}`,
          `sound      ${sound ? 'on' : 'off'}`,
          `muted      ${muted ? 'on' : 'off'}`,
          `volume     ${Math.round(volume * 100)}%`,
          `brightness ${Math.round(brightness * 100)}%`,
          `warp       ${Math.round(warp * 100)}%`,
          `art        ${artVariant}`,
          `inspect    ${inspect ? 'on' : 'off'}`,
          `zoom       ${camera.zoom.toFixed(2)}×`,
          `pan        ${camera.panX}, ${camera.panY}`,
          `deck       ${deckMode ? 'on' : 'off'}`,
        ]);
        break;
      }
      default:
        break;
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    setValue('');
    run(v);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const h = historyRef.current;
      if (h.length === 0) return;
      histIndexRef.current = histIndexRef.current === -1 ? h.length - 1 : Math.max(0, histIndexRef.current - 1);
      setValue(h[histIndexRef.current] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const h = historyRef.current;
      if (histIndexRef.current === -1) return;
      if (histIndexRef.current < h.length - 1) histIndexRef.current += 1;
      else histIndexRef.current = -1;
      setValue(histIndexRef.current === -1 ? '' : h[histIndexRef.current] ?? '');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const v = value.trim().toLowerCase();
      if (!v) return;
      const match = COMMANDS.find((c) => c.startsWith(v));
      if (match) setValue(`${match} `);
    }
  };

  if (!open) return null;

  return (
    <Window id="terminal" icon={<span aria-hidden="true">&gt;_</span>}>
      <div ref={scrollRef} className="window-scroll font-mono text-sm leading-relaxed">
        <div className="p-3">
          {lines.map((l, i) => (
            <div key={i} className={l.kind === 'input' ? 'text-ink' : 'text-muted'}>
              {l.text || '\u00A0'}
            </div>
          ))}
        </div>
      </div>
      <form onSubmit={onSubmit} className="terminal-input">
        <span className="text-ink" aria-hidden="true">&gt;</span>
        <div className="terminal-prompt" onClick={() => inputRef.current?.focus()}>
          <span className="terminal-mirror" aria-hidden="true">{value || '\u00A0'}</span>
          <span className="terminal-cursor" aria-hidden="true">▮</span>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            autoComplete="off"
            spellCheck={false}
            aria-label="Terminal command"
            className="terminal-input-hidden"
          />
        </div>
      </form>
    </Window>
  );
}