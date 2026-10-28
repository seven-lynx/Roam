import { offsetFor, rotationFor, unit } from '@/lib/desk-layout';

describe('desk layout', () => {
  it('is deterministic: the same id always yields the same value', () => {
    expect(unit('l-crt')).toBe(unit('l-crt'));
    expect(rotationFor('r-cam', 6)).toBe(rotationFor('r-cam', 6));
    expect(offsetFor('r-cam', 10)).toBe(offsetFor('r-cam', 10));
  });

  it('keeps unit values within [-1, 1]', () => {
    for (const id of ['a', 'b', 'l-note1', 'r-floppy', 'x'.repeat(40)]) {
      const v = unit(id);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('keeps rotation and offset within the requested bounds', () => {
    for (const id of ['l-crt', 'l-hand', 'r-cass', 'r-radar', 'r-polaroid']) {
      expect(Math.abs(rotationFor(id, 5))).toBeLessThanOrEqual(5);
      expect(Math.abs(offsetFor(id, 12))).toBeLessThanOrEqual(12);
    }
  });

  it('scatters: different ids do not all get the same rotation', () => {
    const rotations = new Set(['l-crt', 'l-hand', 'r-cass', 'r-radar', 'r-polaroid', 'r-cam'].map((id) => rotationFor(id, 6)));
    expect(rotations.size).toBeGreaterThan(3);
  });

  it('uses different values for rotation and offset of the same id', () => {
    expect(unit('r-cam', ':r')).not.toBe(unit('r-cam', ':x'));
  });
});
