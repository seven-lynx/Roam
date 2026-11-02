import { DEFAULT_SOUND_FX, SOUND_EFFECTS } from '@/lib/sfx';

describe('sound effect defaults', () => {
  it('covers every named sound exactly once', () => {
    expect(Object.keys(DEFAULT_SOUND_FX).sort()).toEqual([...SOUND_EFFECTS].sort());
  });

  it('defaults to clicks + loading on, everything else off', () => {
    const ON_BY_DEFAULT = ['click', 'clickHeavy', 'clickNav', 'loadStart', 'loadComplete'];
    for (const name of SOUND_EFFECTS) {
      expect(DEFAULT_SOUND_FX[name]).toBe(ON_BY_DEFAULT.includes(name));
    }
  });
});
