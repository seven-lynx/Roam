jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }));

import { createClient } from '@/lib/supabase/client';
import {
  NIXIE_MAX,
  getRoamBufferSnapshot,
  getRoamExhaustion,
  parseRoamExhaustion,
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

  // A blank white frame is what "none of the urls are showing" looked like: the
  // page was alive but refused framing. Those entries are parked, not promoted.
  it('keeps a page that refuses framing out of the hot queue', async () => {
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
            { url: candidates[0].url, status: 'reachable', framable: true },
            { url: candidates[1].url, status: 'reachable', framable: false },
            { url: candidates[2].url, status: 'unreachable', framable: null },
            { url: candidates[3].url, status: 'blocked', framable: false },
          ],
        }),
      }) as unknown as typeof fetch;

    await roamBufferTick();

    // Only the framable page is hot.
    expect(getRoamBufferSnapshot()).toEqual({ hot: 1, warm: 0 });
    const first = roamBufferNext();
    expect(first?.url).toBe(candidates[0].url);
    expect(first?.framable).toBe(true);

    // A refusal is only handed over when nothing else is left, flagged so the UI
    // can open it as a real tab instead of framing it.
    const fallback = roamBufferNext();
    expect(fallback?.url).toBe(candidates[1].url);
    expect(fallback?.framable).toBe(false);
    expect(roamBufferNext()?.url).toBe(candidates[3].url);
    expect(roamBufferNext()).toBeNull();
  });

  // Prefetch remembers nothing, so without this the server keeps handing back the
  // same unframable domain and the hot queue quietly stops filling.
  it('keeps a refused domain out of the next prefetch', async () => {
    mockSession({ access_token: 'token' });
    const candidates = [1, 2, 3, 4].map(mockCandidate);
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => candidates })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            { url: candidates[0].url, status: 'reachable', framable: false },
            { url: candidates[1].url, status: 'unreachable', framable: null },
            { url: candidates[2].url, status: 'unreachable', framable: null },
            { url: candidates[3].url, status: 'unreachable', framable: null },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] });
    global.fetch = fetchMock as unknown as typeof fetch;

    await roamBufferTick();
    await roamBufferTick();

    const secondBody = JSON.parse(fetchMock.mock.calls[2][1].body as string);
    expect(secondBody.exclude_domains).toContain('site1.example.com');
    expect(getRoamBufferSnapshot()).toEqual({ hot: 0, warm: 0 });
  });
});

// Issue #120: the 404 body now carries why the feed is dry. The buffer is where the
// web app hears about it, and the scan card is what reads it back out.
describe('roam-buffer exhaustion', () => {
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

  it('keeps the reason from a 404 so the UI can explain the gap', async () => {
    mockSession({ access_token: 'token' });
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        error: 'No more URLs to discover',
        exhausted: true,
        reason: 'cooldown',
        scope: 'global',
        available_later: '2026-11-10T00:56:40Z',
      }),
    }) as unknown as typeof fetch;

    await roamBufferTick();

    expect(getRoamExhaustion()).toEqual({
      reason: 'cooldown',
      scope: 'global',
      available_later: '2026-11-10T00:56:40Z',
    });
  });

  it('treats a 404 without a reason as dry but unexplained', async () => {
    mockSession({ access_token: 'token' });
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'No more URLs to discover', exhausted: true }),
    }) as unknown as typeof fetch;

    await roamBufferTick();

    expect(getRoamExhaustion()).toEqual({ reason: null, scope: null, available_later: null });
  });

  it('clears the reason once URLs are flowing again', async () => {
    mockSession({ access_token: 'token' });
    const candidates = [1, 2, 3, 4].map(mockCandidate);
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ exhausted: true, reason: 'pool_empty' }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => candidates })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: candidates.map((c) => ({ url: c.url, status: 'reachable' })) }),
      }) as unknown as typeof fetch;

    await roamBufferTick();
    expect(getRoamExhaustion()?.reason).toBe('pool_empty');

    await roamBufferTick();
    expect(getRoamExhaustion()).toBeNull();
  });

  it('drops the reason on reset', async () => {
    mockSession({ access_token: 'token' });
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ exhausted: true, reason: 'filters' }),
    }) as unknown as typeof fetch;

    await roamBufferTick();
    expect(getRoamExhaustion()?.reason).toBe('filters');

    resetRoamBuffer();
    expect(getRoamExhaustion()).toBeNull();
  });

  it('parses an exhaustion body and ignores anything else', () => {
    expect(parseRoamExhaustion(null)).toBeNull();
    expect(parseRoamExhaustion('nope')).toBeNull();
    // A plain error reply is not an exhaustion reply.
    expect(parseRoamExhaustion({ error: 'boom' })).toBeNull();
    // An unknown reason still counts as dry, it just cannot be explained.
    expect(parseRoamExhaustion({ exhausted: true, reason: 'nonsense' })).toEqual({
      reason: null,
      scope: null,
      available_later: null,
    });
    expect(parseRoamExhaustion({ exhausted: true, reason: 'filters', scope: 'category:x' })).toEqual({
      reason: 'filters',
      scope: 'category:x',
      available_later: null,
    });
  });
});
