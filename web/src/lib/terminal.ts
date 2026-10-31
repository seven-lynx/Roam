export type TerminalCommand =
  | { type: 'output'; lines: string[] }
  | { type: 'clear' }
  | { type: 'action'; action: 'roam' | 'goto' | 'fx' | 'sound' | 'vol' | 'brt'; arg: string };

export const COMMANDS = [
  'help', 'clear', 'roam', 'goto', 'ls', 'status', 'fx', 'sound', 'vol', 'brt', 'date', 'whoami', 'man',
];

const HELP: string[] = [
  'ROAM-OS terminal — available commands',
  '  help          show this help',
  '  roam          run a roam scan',
  '  goto <path>   navigate to a route',
  '  ls            list ~/roam',
  '  status        system readout',
  '  fx on|off     toggle CRT effects',
  '  sound on|off  toggle sound',
  '  vol <0-100>   set volume',
  '  brt <35-130>  set CRT brightness',
  '  date          print the time',
  '  whoami        print the operator',
  '  man roam      read the manual',
  '  clear         clear the screen',
];

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
      return { type: 'output', lines: HELP };
    case 'clear':
      return { type: 'clear' };
    case 'roam':
      return { type: 'action', action: 'roam', arg: '' };
    case 'goto':
      return arg ? { type: 'action', action: 'goto', arg } : { type: 'output', lines: ['usage: goto <path>'] };
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
          'roam   v2.6.0',
        ],
      };
    case 'fx':
      if (arg === 'on' || arg === 'off') return { type: 'action', action: 'fx', arg };
      return { type: 'output', lines: ['usage: fx on|off'] };
    case 'sound':
      if (arg === 'on' || arg === 'off') return { type: 'action', action: 'sound', arg };
      return { type: 'output', lines: ['usage: sound on|off'] };
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
    case 'date':
      return { type: 'output', lines: [new Date().toLocaleString()] };
    case 'whoami':
      return { type: 'output', lines: ['guest@roam'] };
    case 'man':
      return {
        type: 'output',
        lines: [
          'ROAM(1)  Roam the forgotten web',
          '',
          'One press pulls up a random corner of the internet, rated by real',
          'people. No feeds, no rabbit holes, no notifications.',
          '',
          'see also: roam(1) goto(1)',
        ],
      };
    default:
      return { type: 'output', lines: [`roam: command not found: ${cmd}`, 'type "help" for available commands'] };
  }
}