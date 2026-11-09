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
    // Needed by markSeen() — roamBufferNext records the serve (issue #122).
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
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

  // Issue #122: prefetch no longer records a serve, so the hot path must. Without
  // this call a buffered-then-shown URL would never get a seen_urls row at all
  // (and the 24 h domain cooldown would never fire).
  it('records the serve via mark_url_seen when it hands out a buffered URL', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: null });
    mockedCreateClient.mockReturnValue({
      auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'token' } } }) },
      rpc,
    });

    const candidates = [1, 2, 3, 4].map(mockCandidate);
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => candidates })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: candidates.map((c) => ({ url: c.url, status: 'reachable' })),
        }),
      }) as unknown as typeof fetch;

    await roamBufferTick();
    const served = roamBufferNext();
    expect(served?.id).toBe('id-1');

    // Fire-and-forget: let the queued task settle before asserting.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('mark_url_seen', { p_url_id: 'id-1' });
  });

  // Issue #122: prefetch now records nothing, so a second call can return URLs the
  // buffer already holds. The tick therefore has to tell the server which domains
  // it is sitting on, or a whole batch can come back redundant.
  it('tells the server which domains it already holds when prefetching', async () => {
    mockSession({ access_token: 'token' });
    const candidates = [1, 2, 3, 4, 5].map(mockCandidate);
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => candidates })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: candidates.slice(0, 4).map((c) => ({ url: c.url, status: 'reachable' })),
        }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] });
    global.fetch = fetchMock as unknown as typeof fetch;

    await roamBufferTick();
    await roamBufferTick();

    // Call 0 was the first fill (buffer empty, nothing to exclude); call 2 is the
    // second fill, which must carry the 4 hot + 1 warm domains.
    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const secondBody = JSON.parse(fetchMock.mock.calls[2][1].body as string);
    expect(firstBody.exclude_domains).toBeUndefined();
    expect(secondBody.exclude_domains).toHaveLength(5);
    expect(secondBody.exclude_domains).toContain('site1.example.com');
    expect(secondBody.prefetch).toBe(true);
  });
});
