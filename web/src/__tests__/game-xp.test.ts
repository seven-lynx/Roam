import { LEVEL_XP, XP_LEVEL_CAP, gameOverXp, makeRunId } from '@/lib/game-xp';

describe('game-xp economy', () => {
  it('awards a flat 10 XP per level', () => {
    expect(LEVEL_XP).toBe(10);
  });

  it('stops per-level XP after level 100', () => {
    expect(XP_LEVEL_CAP).toBe(100);
  });

  it('derives game-over XP as min(500, floor(score / 10))', () => {
    expect(gameOverXp(0)).toBe(0);
    expect(gameOverXp(9)).toBe(0);
    expect(gameOverXp(10)).toBe(1);
    expect(gameOverXp(100)).toBe(10);
    expect(gameOverXp(5000)).toBe(500);
    expect(gameOverXp(99999)).toBe(500);
  });

  it('clamps negative scores to zero', () => {
    expect(gameOverXp(-5)).toBe(0);
    expect(gameOverXp(-0.5)).toBe(0);
  });

  it('floors fractional scores before dividing', () => {
    expect(gameOverXp(1234.9)).toBe(123);
  });

  it('generates a non-empty run id', () => {
    expect(makeRunId().length).toBeGreaterThan(0);
  });
});
