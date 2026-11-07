import { LEVEL_XP, WIN_XP, WIN_LEVEL, XP_LEVEL_CAP, gameOverXp, makeRunId, type GameId } from '@/lib/game-xp';

describe('game-xp economy', () => {
  it('awards a flat 10 XP per level', () => {
    expect(LEVEL_XP).toBe(10);
  });

  it('awards a flat 100 XP for winning a game', () => {
    expect(WIN_XP).toBe(100);
  });

  it('defines an arcade "win" as clearing level 10', () => {
    expect(WIN_LEVEL).toBe(10);
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

  it('accepts every shipped program as an awardable game id', () => {
    // Must stay in sync with the GAMES allow-list in
    // supabase/functions/game-action/index.ts — an id missing there is a 400.
    const ids: GameId[] = [
      'snake',
      'minesweeper',
      'tetris',
      'asteroids',
      'frogger',
      'underweb',
      'substrate',
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('minesweeper');
  });
});
