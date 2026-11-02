import { resolveSteer, STEER_SWIPE_THRESHOLD_PX } from '@/lib/steer';

describe('resolveSteer', () => {
  it('resolves a right swipe', () => {
    expect(resolveSteer(STEER_SWIPE_THRESHOLD_PX + 1, 0)).toBe('right');
  });

  it('resolves a left swipe', () => {
    expect(resolveSteer(-(STEER_SWIPE_THRESHOLD_PX + 1), 0)).toBe('left');
  });

  it('resolves a down swipe', () => {
    expect(resolveSteer(0, STEER_SWIPE_THRESHOLD_PX + 1)).toBe('down');
  });

  it('resolves an up swipe', () => {
    expect(resolveSteer(0, -(STEER_SWIPE_THRESHOLD_PX + 1))).toBe('up');
  });

  it('returns null below the threshold', () => {
    expect(resolveSteer(STEER_SWIPE_THRESHOLD_PX, 0)).toBeNull();
    expect(resolveSteer(0, STEER_SWIPE_THRESHOLD_PX)).toBeNull();
    expect(resolveSteer(0, 0)).toBeNull();
  });

  it('lets the dominant axis win on diagonals', () => {
    expect(resolveSteer(200, 50)).toBe('right');
    expect(resolveSteer(50, 200)).toBe('down');
    expect(resolveSteer(-200, 50)).toBe('left');
    expect(resolveSteer(50, -200)).toBe('up');
  });

  it('returns null on a perfect diagonal', () => {
    expect(resolveSteer(200, 200)).toBeNull();
    expect(resolveSteer(-200, -200)).toBeNull();
  });
});