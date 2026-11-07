import { act, renderHook } from '@testing-library/react';
import { useGameLevel, type UseGameLevelOptions } from '@/components/programs/useGameLevel';

// Guest (userId null) so no XP/network is involved — the level loop is what we test.
function opts(overrides: Partial<UseGameLevelOptions> = {}): UseGameLevelOptions {
  return { game: 'snake', userId: null, runId: 'run-1', winLevel: 10, ...overrides };
}

describe('useGameLevel', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('runs a 3-2-1 countdown before level 1 when begun', () => {
    const { result } = renderHook(() => useGameLevel(opts()));
    expect(result.current.phase).toBe('ready');

    act(() => result.current.begin());
    expect(result.current.phase).toBe('start');
    expect(result.current.countdown).toBe(3);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.countdown).toBe(2);

    // Two more steps reach GO, and the loop resumes play.
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.phase).toBe('playing');
  });

  it('arms a per-level clock that ends the run at zero', () => {
    const getScore = jest.fn(() => 7);
    const { result } = renderHook(() => useGameLevel(opts({ timeLimitFor: () => 3, getScore })));

    act(() => result.current.begin());
    // Run the countdown into play; the clock arms on the playing transition.
    for (let i = 0; i < 4; i++) {
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    }
    expect(result.current.phase).toBe('playing');
    // Armed to the level budget (may already have ticked once this window).
    expect(result.current.timeLeft).toBeGreaterThan(0);
    expect(result.current.timeLeft).toBeLessThanOrEqual(3);

    // Tick the clock down to zero; the run ends.
    let guard = 0;
    while (result.current.phase === 'playing' && guard < 10) {
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      guard += 1;
    }
    expect(result.current.phase).toBe('over');
    expect(getScore).toHaveBeenCalled();
  });

  it('never auto-ends a run with no time limit', () => {
    const { result } = renderHook(() => useGameLevel(opts()));
    act(() => result.current.begin());
    for (let i = 0; i < 4; i++) {
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    }
    expect(result.current.phase).toBe('playing');
    expect(result.current.timeLeft).toBe(0);

    act(() => {
      jest.advanceTimersByTime(600_000);
    });
    expect(result.current.phase).toBe('playing');
  });
});
