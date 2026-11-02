jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }));

import { createClient } from '@/lib/supabase/client';
import {
  NIXIE_MAX,
  getRoamBufferSnapshot,
  resetRoamBuffer,
  roamBufferNext,
  roamBufferTick,
  subscribeRoamBuffer,
} from '@/lib/roam-buffer';

const mockedCreateClient = createClient as unknown as jest.Mock;

function mockSession(session: { access_token: string } | null) {
  mockedCreateClient.mockReturnValue({
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session } }) },
  });
}

function mockCandidate(i: number) {
  return { id: `id-${i}`, url: `https://site${i}.example.com/page`, title: `Site ${i}` };
}

describe('roam-buffer', () => {
  const OLD_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

  beforeEach(() => {
    resetRoamBuffer();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test.co';
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetRoamBuffer();
    if (OLD_URL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = OLD_URL;
    jest.restoreAllMocks();
  });

  it('saturates the nixie display at 9', () => {
    expect(NIXIE_MAX).toBe(9);
  });

  it('starts empty and next() returns null when nothing is hot', () => {
    expect(getRoamBufferSnapshot()).toEqual({ hot: 0, warm: 0 });
    expect(roamBufferNext()).toBeNull();
  });

  it('does nothing when signed out', async () => {
    mockSession(null);
    global.fetch = jest.fn() as unknown as typeof fetch;
    await roamBufferTick();
    expect(getRoamBufferSnapshot()).toEqual({ hot: 0, warm: 0 });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fills warm, promotes a validated batch to hot, then serves hot first', async () => {
    mockSession({ access_token: 'token' });
    const candidates = [1, 2, 3, 4, 5].map(mockCandidate);
    global.fetch = jest
      .fn()
      // 1st call: warm fill via the roam edge function.
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => candidates })
      // 2nd call: /api/check-urls validation (4 candidates → all reachable).
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: candidates.slice(0, 4).map((c) => ({ url: c.url, status: 'reachable' })),
        }),
      }) as unknown as typeof fetch;

    await roamBufferTick();

    // 5 filled warm, 4 validated into hot, 1 left warm.
    expect(getRoamBufferSnapshot()).toEqual({ hot: 4, warm: 1 });
    // Serving pops the head of the hot queue.
    expect(roamBufferNext()?.url).toBe('https://site1.example.com/page');
    expect(getRoamBufferSnapshot().hot).toBe(3);
  });

  it('treats HEAD-blocked (405/403/501) as servable and drops unreachable', async () => {
    mockSession({ access_token: 'token' });
    const candidates = [1, 2, 3, 4].map(mockCandidate);
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => candidates })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            { url: candidates[0].url, status: 'reachable' },
            { url: candidates[1].url, status: 'blocked' },
            { url: candidates[2].url, status: 'unreachable' },
            { url: candidates[3].url, status: 'unreachable' },
          ],
        }),
      }) as unknown as typeof fetch;

    await roamBufferTick();

    // reachable + blocked are hot; unreachable are dropped entirely.
    expect(getRoamBufferSnapshot()).toEqual({ hot: 2, warm: 0 });
  });

  it('subscribes to buffer changes and returns an unsubscribe function', () => {
    const cb = jest.fn();
    const unsub = subscribeRoamBuffer(cb);
    expect(typeof unsub).toBe('function');
    unsub();
  });
});
