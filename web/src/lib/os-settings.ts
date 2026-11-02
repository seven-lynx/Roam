/**
 * ROAM-OS settings registry.
 *
 * The terminal's `set` / `get` commands and `help <cmd>` read from this single
 * list. It describes each OS preference (local, workstation-level settings only),
 * its CLI aliases, its type/range/options, and a one-line help string. The actual
 * React state lives in `WorkstationContext`; `Terminal` is the adapter between
 * this metadata and those accessors.
 */

export type OsSettingKind = 'boolean' | 'number' | 'enum';

export interface OsSettingDef {
  /** Canonical key (also the `set`/`get` name). */
  key: string;
  /** Additional CLI names accepted for this setting. */
  aliases: string[];
  kind: OsSettingKind;
  /** Inclusive numeric range for `number` settings. */
  range?: [number, number];
  /** Allowed values for `enum` settings. */
  options?: readonly string[];
  /** Suffix shown when printing the value (e.g. "%"). */
  unit?: string;
  help: string;
}

export const OS_SETTINGS: OsSettingDef[] = [
  { key: 'fx', aliases: ['effects', 'crt'], kind: 'boolean', help: 'CRT effects (scanlines, grain, vignette, flicker)' },
  { key: 'sound', aliases: ['audio'], kind: 'boolean', help: 'master sound toggle' },
  { key: 'muted', aliases: ['mute'], kind: 'boolean', help: 'mute all sound' },
  { key: 'volume', aliases: ['vol'], kind: 'number', range: [0, 100], unit: '%', help: 'master volume' },
  { key: 'brightness', aliases: ['brt'], kind: 'number', range: [35, 130], unit: '%', help: 'CRT brightness' },
  { key: 'warp', aliases: [], kind: 'number', range: [0, 100], unit: '%', help: 'CRT barrel curvature' },
  { key: 'art', aliases: [], kind: 'enum', options: ['a', 'b'], help: 'desk art asset pack (a|b)' },
  { key: 'theme', aliases: ['color', 'phosphor'], kind: 'enum', options: ['green', 'amber', 'magenta', 'blue', 'ice'], help: 'OS color theme (green|amber|magenta|blue|ice)' },
  { key: 'inspect', aliases: ['orbit'], kind: 'boolean', help: 'inspect (orbit) mode' },
  { key: 'zoom', aliases: [], kind: 'number', range: [0.2, 6], help: 'deck camera zoom' },
  { key: 'panx', aliases: ['pan-x'], kind: 'number', range: [-2000, 2000], unit: 'px', help: 'deck camera pan (horizontal)' },
  { key: 'pany', aliases: ['pan-y'], kind: 'number', range: [-2000, 2000], unit: 'px', help: 'deck camera pan (vertical)' },
  { key: 'deck', aliases: ['fs', 'deckview'], kind: 'boolean', help: 'deck view (show the 3D cyberdeck)' },
];

/** Resolve a CLI token (canonical key or alias) to a setting definition. */
export function findSetting(name: string): OsSettingDef | undefined {
  const n = name.trim().toLowerCase();
  return OS_SETTINGS.find((s) => s.key === n || s.aliases.includes(n));
}

/** Coerce a raw CLI string into a valid value for the setting, or null if invalid. */
export function parseSettingValue(def: OsSettingDef, raw: string): string | number | boolean | null {
  switch (def.kind) {
    case 'boolean': {
      const v = raw.trim().toLowerCase();
      if (v === 'on' || v === 'true' || v === '1' || v === 'yes') return true;
      if (v === 'off' || v === 'false' || v === '0' || v === 'no') return false;
      return null;
    }
    case 'number': {
      const n = Number(raw);
      if (raw.trim() === '' || !Number.isFinite(n)) return null;
      if (def.range && (n < def.range[0] || n > def.range[1])) return null;
      return n;
    }
    case 'enum': {
      const v = raw.trim().toLowerCase();
      return def.options && def.options.includes(v) ? v : null;
    }
  }
}

/** Human-friendly "current value" text for a setting, used by `get` / `sysinfo`. */
export function formatSettingValue(def: OsSettingDef, value: string | number | boolean): string {
  if (def.kind === 'boolean') return value ? 'on' : 'off';
  if (def.kind === 'number') return `${value}${def.unit ?? ''}`;
  return String(value);
}
