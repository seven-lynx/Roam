import { DEFAULT_SOUND_FX, SOUND_EFFECTS } from '@/lib/sfx';

describe('sound effect defaults', () => {
  it('covers every named sound exactly once', () => {
    expect(Object.keys(DEFAULT_SOUND_FX).sort()).toEqual([...SOUND_EFFECTS].sort());
  });

  it('defaults every action/feed sound on, leaving only the bed layers silent', () => {
    const OFF_BY_DEFAULT = ['serverHum', 'ambient'];
    for (const name of SOUND_EFFECTS) {
      expect(DEFAULT_SOUND_FX[name]).toBe(!OFF_BY_DEFAULT.includes(name));
    }
  });
});
