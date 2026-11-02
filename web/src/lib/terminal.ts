import { findSetting, formatSettingValue } from '@/lib/os-settings';

export type TerminalCommand =
  | { type: 'output'; lines: string[] }
  | { type: 'clear' }
  | {
      type: 'action';
      action:
        | 'roam'
        | 'goto'
        | 'open'
        | 'close'
        | 'fx'
        | 'sound'
        | 'mute'
        | 'vol'
        | 'brt'
        | 'warp'
        | 'art'
        | 'inspect'
        | 'zoom'
        | 'fit'
        | 'pan'
        | 'deck'
        | 'reset'
        | 'logout'
        | 'set'
        | 'get'
        | 'whoami'
        | 'sysinfo'
        | 'theme'
        | 'history';
      arg: string;
    };

export const COMMANDS = [
  'help', 'clear', 'roam', 'goto', 'open', 'close', 'ls', 'status', 'sysinfo',
  'fx', 'sound', 'mute', 'vol', 'brt', 'warp', 'art', 'inspect', 'zoom', 'fit',
  'pan', 'deck', 'set', 'get', 'reset', 'reboot', 'logout', 'date', 'whoami', 'man',
  'theme', 'uptime', 'fortune', 'echo', 'history',
];

const BOOT_TIME = Date.now();

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ${s % 60}s`;
}

const FORTUNES = [
  'The web is not a feed. It is a place.',
  'One press. One random page. No rabbit holes.',
  'You are not lost. You are roaming.',
  'Signal found. Continue.',
  'The forgotten web remembers you.',
  'Keep the antenna raised.',
];

const HELP: string[] = [
  'ROAM-OS terminal v2.7 — available commands',
  '',
  '  roam                 run a roam scan',
  '  goto <path>          navigate to a route',
  '  open <app>           open a window (scan|programs|terminal|comms)',
  '  close <app>          close a window',
  '  ls                   list ~/roam',
  '  status               quick system readout',
  '  sysinfo              full settings + operator readout',
  '',
  '  fx on|off            toggle CRT effects',
  '  sound on|off         toggle sound',
  '  mute [on|off]        mute sound (no arg toggles)',
  '  vol <0-100>          set volume',
  '  brt <35-130>         set CRT brightness',
  '  warp <0-100>         set CRT barrel curvature',
  '  art a|b              choose desk art pack',
  '',
  '  inspect [on|off]     enter/leave orbit mode (no arg toggles)',
  '  zoom <n>|in|out      set the deck camera zoom (reset to centre)',
  '  pan <x> <y>          set the deck camera pan offset (screen px)',
  '  fit                  snap to the saved framing',
  '  deck [on|off]        deck view — show the 3D cyberdeck (no arg toggles)',
  '',
  '  set <key> <value>    write an OS setting',
  '  get <key>            read an OS setting',
  '  reset                restore all OS settings to factory defaults',
  '  logout               end this session',
  '',
  '  theme <color>        set the OS color theme (green|amber|magenta|blue|ice)',
  '  echo <text>          print text back',
  '  fortune              print a random roam transmission',
  '  uptime               print session uptime',
  '  history              print this session\'s commands',
  '',
  '  date                 print the time',
  '  whoami               print the operator',
  '  man [cmd]            read the manual',
  '  help [cmd]           show help',
  '  clear                clear the screen',
];

const COMMAND_HELP: Record<string, string[]> = {
  roam: ['roam — run a roam scan', 'usage: roam'],
  goto: ['goto — navigate to a route', 'usage: goto <path>   e.g. goto badges'],
  open: ['open — open an OS window', 'usage: open <app>   apps: scan, programs, terminal, comms'],
  close: ['close — close an OS window', 'usage: close <app>   apps: scan, programs, terminal, comms'],
  ls: ['ls — list the roam home directory', 'usage: ls'],
  status: ['status — quick system readout', 'usage: status'],
  sysinfo: ['sysinfo — full settings + operator readout', 'usage: sysinfo'],
  fx: ['fx — toggle CRT effects', 'usage: fx on|off'],
  sound: ['sound — toggle master sound', 'usage: sound on|off'],
  mute: ['mute — mute sound', 'usage: mute [on|off]   no arg toggles'],
  vol: ['vol — set master volume', 'usage: vol <0-100>'],
  brt: ['brt — set CRT brightness', 'usage: brt <35-130>'],
  warp: ['warp — set CRT barrel curvature', 'usage: warp <0-100>'],
  art: ['art — choose desk art pack', 'usage: art a|b'],
  inspect: ['inspect — enter/leave orbit mode', 'usage: inspect [on|off]   no arg toggles'],
  zoom: ['zoom — set the deck camera zoom', 'usage: zoom <0.2-6> | zoom in | zoom out | zoom reset'],
  pan: ['pan — set the deck camera pan offset', 'usage: pan <x> <y>   screen-pixel offsets'],
  fit: ['fit — snap the camera to the saved framing', 'usage: fit'],
  deck: ['deck — deck view (show the 3D cyberdeck)', 'usage: deck [on|off]   no arg toggles'],
  set: ['set — write an OS setting', 'usage: set <key> <value>   keys: fx, sound, mute, vol, brt, warp, art, inspect, zoom, panx, pany, deck'],
  get: ['get — read an OS setting', 'usage: get <key>'],
  reset: ['reset — restore all OS settings to factory defaults', 'usage: reset   (alias: reboot)'],
  logout: ['logout — end this session', 'usage: logout'],
  date: ['date — print the time', 'usage: date'],
  whoami: ['whoami — print the operator', 'usage: whoami'],
  man: ['man — read the manual', 'usage: man [cmd]'],
  help: ['help — show help', 'usage: help [cmd]'],
  clear: ['clear — clear the screen', 'usage: clear'],
  theme: ['theme — set the OS color theme', 'usage: theme <green|amber|magenta|blue|ice>'],
  echo: ['echo — print text back', 'usage: echo <text>'],
  fortune: ['fortune — print a random roam transmission', 'usage: fortune'],
  uptime: ['uptime — print session uptime', 'usage: uptime'],
  history: ['history — print this session\'s commands', 'usage: history'],
};

/** Validate a simple on/off argument, returning 'on'|'off' or null. */
function onOff(arg: string): 'on' | 'off' | null {
  const v = arg.trim().toLowerCase();
  if (v === 'on' || v === 'off') return v;
  return null;
}

/**
 * Parses a line of terminal input. Pure and unit-testable: informational
 * commands return output text, while commands that change workstation state
 * return an `action` the Terminal component executes.
 */
export function parseCommand(input: string): TerminalCommand {
  const raw = input.trim();
  if (!raw) return { type: 'output', lines: [] };
  const [cmd, ...rest] = raw.split(/\s+/);
  const arg = rest.join(' ').trim();
  const c = cmd.toLowerCase();

  switch (c) {
    case 'help':
      if (arg) {
        const h = COMMAND_HELP[arg.toLowerCase()];
        return h ? { type: 'output', lines: h } : { type: 'output', lines: [`roam: no help for: ${arg}`] };
      }
      return { type: 'output', lines: HELP };
    case 'clear':
      return { type: 'clear' };
    case 'roam':
      return { type: 'action', action: 'roam', arg: '' };
    case 'goto':
      return arg ? { type: 'action', action: 'goto', arg } : { type: 'output', lines: ['usage: goto <path>'] };
    case 'open': {
      const id = arg.trim().toLowerCase();
      if (['scan', 'programs', 'launcher', 'terminal', 'comms', 'feedback'].includes(id)) {
        return { type: 'action', action: 'open', arg: id };
      }
      return { type: 'output', lines: ['usage: open <scan|programs|terminal|comms>'] };
    }
    case 'close': {
      const id = arg.trim().toLowerCase();
      if (['scan', 'programs', 'launcher', 'terminal', 'comms', 'feedback'].includes(id)) {
        return { type: 'action', action: 'close', arg: id };
      }
      return { type: 'output', lines: ['usage: close <scan|programs|terminal|comms>'] };
    }
    case 'ls':
      return { type: 'output', lines: ['collections/  badges/  challenges/  ranks.log  profile  roaming.log'] };
    case 'status':
      return {
        type: 'output',
        lines: [
          'cpu    ████████░░ 82%  (simulated)',
          'mem    ██████░░░░ 61%  (simulated)',
          'net    █████████░ 91%',
          'sig    ██████████ strong',
          'link   encrypted',
          'roam   v2.7.0',
        ],
      };
    case 'sysinfo':
      return { type: 'action', action: 'sysinfo', arg: '' };
    case 'fx': {
      const v = onOff(arg);
      return v ? { type: 'action', action: 'fx', arg: v } : { type: 'output', lines: ['usage: fx on|off'] };
    }
    case 'sound': {
      const v = onOff(arg);
      return v ? { type: 'action', action: 'sound', arg: v } : { type: 'output', lines: ['usage: sound on|off'] };
    }
    case 'mute': {
      if (!arg) return { type: 'action', action: 'mute', arg: '' };
      const v = onOff(arg);
      return v ? { type: 'action', action: 'mute', arg: v } : { type: 'output', lines: ['usage: mute [on|off]'] };
    }
    case 'vol': {
      const n = Number(arg);
      if (arg !== '' && Number.isFinite(n) && n >= 0 && n <= 100) return { type: 'action', action: 'vol', arg: String(n) };
      return { type: 'output', lines: ['usage: vol <0-100>'] };
    }
    case 'brt': {
      const n = Number(arg);
      if (arg !== '' && Number.isFinite(n) && n >= 35 && n <= 130) return { type: 'action', action: 'brt', arg: String(n) };
      return { type: 'output', lines: ['usage: brt <35-130>'] };
    }
    case 'warp': {
      const n = Number(arg);
      if (arg !== '' && Number.isFinite(n) && n >= 0 && n <= 100) return { type: 'action', action: 'warp', arg: String(n) };
      return { type: 'output', lines: ['usage: warp <0-100>'] };
    }
    case 'art': {
      const v = arg.trim().toLowerCase();
      if (v === 'a' || v === 'b') return { type: 'action', action: 'art', arg: v };
      return { type: 'output', lines: ['usage: art a|b'] };
    }
    case 'inspect': {
      if (!arg) return { type: 'action', action: 'inspect', arg: '' };
      const v = onOff(arg);
      return v ? { type: 'action', action: 'inspect', arg: v } : { type: 'output', lines: ['usage: inspect [on|off]'] };
    }
    case 'zoom': {
      const v = arg.trim().toLowerCase();
      if (v === '') return { type: 'output', lines: ['usage: zoom <0.2-6> | zoom in | zoom out | zoom reset'] };
      if (v === 'in' || v === 'out' || v === 'reset') return { type: 'action', action: 'zoom', arg: v };
      const n = Number(arg);
      if (Number.isFinite(n) && n >= 0.2 && n <= 6) return { type: 'action', action: 'zoom', arg: String(n) };
      return { type: 'output', lines: ['usage: zoom <0.2-6> | zoom in | zoom out | zoom reset'] };
    }
    case 'fit':
      return { type: 'action', action: 'fit', arg: '' };
    case 'pan': {
      const parts = arg.split(/\s+/).filter(Boolean);
      if (parts.length === 2) {
        const x = Number(parts[0]);
        const y = Number(parts[1]);
        if (Number.isFinite(x) && Number.isFinite(y)) return { type: 'action', action: 'pan', arg: `${x} ${y}` };
      }
      return { type: 'output', lines: ['usage: pan <x> <y>'] };
    }
    case 'deck': {
      if (!arg) return { type: 'action', action: 'deck', arg: '' };
      const v = onOff(arg);
      return v ? { type: 'action', action: 'deck', arg: v } : { type: 'output', lines: ['usage: deck [on|off]'] };
    }
    case 'reset':
    case 'reboot':
      return { type: 'action', action: 'reset', arg: '' };
    case 'logout':
      return { type: 'action', action: 'logout', arg: '' };
    case 'set': {
      const parts = arg.split(/\s+/);
      const key = (parts[0] ?? '').toLowerCase();
      const value = parts.slice(1).join(' ').trim();
      const def = findSetting(key);
      if (!def) return { type: 'output', lines: [`roam: unknown setting: ${key}`, 'type "help set" for available keys'] };
      if (value === '') return { type: 'output', lines: [`usage: set ${key} <value>`] };
      return { type: 'action', action: 'set', arg: `${key} ${value}` };
    }
    case 'get': {
      const key = arg.trim().toLowerCase();
      const def = findSetting(key);
      if (!def) return { type: 'output', lines: [`roam: unknown setting: ${key}`] };
      return { type: 'action', action: 'get', arg: key };
    }
    case 'echo':
      return { type: 'output', lines: [arg] };
    case 'fortune':
      return { type: 'output', lines: [FORTUNES[Math.floor(Math.random() * FORTUNES.length)]] };
    case 'uptime':
      return { type: 'output', lines: [formatUptime(Date.now() - BOOT_TIME)] };
    case 'history':
      return { type: 'action', action: 'history', arg: '' };
    case 'theme': {
      const v = arg.trim().toLowerCase();
      if (['green', 'amber', 'magenta', 'blue', 'ice'].includes(v)) return { type: 'action', action: 'theme', arg: v };
      return { type: 'output', lines: ['usage: theme <green|amber|magenta|blue|ice>'] };
    }
    case 'date':
      return { type: 'output', lines: [new Date().toLocaleString()] };
    case 'whoami':
      return { type: 'action', action: 'whoami', arg: '' };
    case 'man':
      if (arg) {
        const h = COMMAND_HELP[arg.toLowerCase()];
        if (h) return { type: 'output', lines: h };
        const def = findSetting(arg);
        if (def) return { type: 'output', lines: [`${def.key} — ${def.help}`, `usage: set ${def.key} <value>`] };
      }
      return {
        type: 'output',
        lines: [
          'ROAM(1)  Roam the forgotten web',
          '',
          'One press pulls up a random corner of the internet, rated by real',
          'people. No feeds, no rabbit holes, no notifications.',
          '',
          'see also: roam(1) goto(1) sysinfo(1)',
        ],
      };
    default:
      return { type: 'output', lines: [`roam: command not found: ${cmd}`, 'type "help" for available commands'] };
  }
}

/** Format a resolved setting value using the registry metadata. */
export function formatSetting(key: string, value: string | number | boolean): string {
  const def = findSetting(key);
  return def ? formatSettingValue(def, value) : String(value);
}