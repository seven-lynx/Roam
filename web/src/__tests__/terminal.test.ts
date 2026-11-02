import { parseCommand } from '@/lib/terminal';
import { findSetting, parseSettingValue } from '@/lib/os-settings';

describe('terminal.parseCommand', () => {
  it('parses legacy setting commands', () => {
    expect(parseCommand('fx on')).toEqual({ type: 'action', action: 'fx', arg: 'on' });
    expect(parseCommand('sound off')).toEqual({ type: 'action', action: 'sound', arg: 'off' });
    expect(parseCommand('vol 50')).toEqual({ type: 'action', action: 'vol', arg: '50' });
    expect(parseCommand('brt 100')).toEqual({ type: 'action', action: 'brt', arg: '100' });
  });

  it('parses the new settings commands', () => {
    expect(parseCommand('warp 50')).toEqual({ type: 'action', action: 'warp', arg: '50' });
    expect(parseCommand('art b')).toEqual({ type: 'action', action: 'art', arg: 'b' });
    expect(parseCommand('mute')).toEqual({ type: 'action', action: 'mute', arg: '' });
    expect(parseCommand('mute off')).toEqual({ type: 'action', action: 'mute', arg: 'off' });
  });

  it('parses inspect + zoom commands', () => {
    expect(parseCommand('inspect')).toEqual({ type: 'action', action: 'inspect', arg: '' });
    expect(parseCommand('inspect on')).toEqual({ type: 'action', action: 'inspect', arg: 'on' });
    expect(parseCommand('zoom in')).toEqual({ type: 'action', action: 'zoom', arg: 'in' });
    expect(parseCommand('zoom 2.5')).toEqual({ type: 'action', action: 'zoom', arg: '2.5' });
    expect(parseCommand('zoom 99')).toEqual({
      type: 'output',
      lines: ['usage: zoom <0.2-6> | zoom in | zoom out | zoom reset'],
    });
  });

  it('parses pan + deck commands', () => {
    expect(parseCommand('pan 24 0')).toEqual({ type: 'action', action: 'pan', arg: '24 0' });
    expect(parseCommand('pan -12 8')).toEqual({ type: 'action', action: 'pan', arg: '-12 8' });
    expect(parseCommand('pan 1')).toEqual({ type: 'output', lines: ['usage: pan <x> <y>'] });
    expect(parseCommand('deck')).toEqual({ type: 'action', action: 'deck', arg: '' });
    expect(parseCommand('deck on')).toEqual({ type: 'action', action: 'deck', arg: 'on' });
    expect(parseCommand('deck off')).toEqual({ type: 'action', action: 'deck', arg: 'off' });
    expect(parseCommand('deck maybe')).toEqual({ type: 'output', lines: ['usage: deck [on|off]'] });
  });

  it('parses open/close/set/get and rejects unknown settings', () => {
    expect(parseCommand('open programs')).toEqual({ type: 'action', action: 'open', arg: 'programs' });
    expect(parseCommand('close scan')).toEqual({ type: 'action', action: 'close', arg: 'scan' });
    expect(parseCommand('get warp')).toEqual({ type: 'action', action: 'get', arg: 'warp' });
    expect(parseCommand('set warp 50')).toEqual({ type: 'action', action: 'set', arg: 'warp 50' });
    expect(parseCommand('set bogus 1')).toEqual({
      type: 'output',
      lines: ['roam: unknown setting: bogus', 'type "help set" for available keys'],
    });
  });

  it('parses reset/reboot/logout/sysinfo/whoami', () => {
    expect(parseCommand('reboot')).toEqual({ type: 'action', action: 'reset', arg: '' });
    expect(parseCommand('logout')).toEqual({ type: 'action', action: 'logout', arg: '' });
    expect(parseCommand('sysinfo')).toEqual({ type: 'action', action: 'sysinfo', arg: '' });
    expect(parseCommand('whoami')).toEqual({ type: 'action', action: 'whoami', arg: '' });
  });

  it('still reports unknown commands', () => {
    expect(parseCommand('frobnicate')).toEqual({
      type: 'output',
      lines: ['roam: command not found: frobnicate', 'type "help" for available commands'],
    });
  });
});

describe('os-settings registry', () => {
  it('coerces boolean and numeric values with range checks', () => {
    const warp = findSetting('warp')!;
    expect(parseSettingValue(warp, '50')).toBe(50);
    expect(parseSettingValue(warp, '101')).toBeNull();

    const fx = findSetting('fx')!;
    expect(parseSettingValue(fx, 'on')).toBe(true);
    expect(parseSettingValue(fx, 'OFF')).toBe(false);
    expect(parseSettingValue(fx, 'maybe')).toBeNull();
  });

  it('resolves aliases to the same setting', () => {
    expect(findSetting('vol')).toBe(findSetting('volume'));
    expect(findSetting('orbit')).toBe(findSetting('inspect'));
    expect(findSetting('fs')).toBe(findSetting('deck'));
    expect(findSetting('pan-x')).toBe(findSetting('panx'));
  });

  it('exposes the camera pan + deck settings', () => {
    const panx = findSetting('panx')!;
    expect(parseSettingValue(panx, '24')).toBe(24);
    expect(parseSettingValue(panx, '999999')).toBeNull();

    const deck = findSetting('deck')!;
    expect(parseSettingValue(deck, 'on')).toBe(true);
    expect(parseSettingValue(deck, 'off')).toBe(false);
  });
});
