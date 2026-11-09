jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }));

import { createClient } from '@/lib/supabase/client';
import { COMPILE_LOG, STAGE_MS, fetchScanTarget, hexLine, pickRandom } from '@/lib/scan';

const mockedCreateClient = createClient as unknown as jest.Mock;

function mockCatalogue(...results: Array<{ data: unknown; error: unknown } | Error>) {
  let call = 0;
  const limit = jest.fn(() => {
    const result = results[Math.min(call, results.length - 1)];
    call += 1;
    return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
  });
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.limit = limit;
  mockedCreateClient.mockReturnValue({ from: jest.fn(() => chain) });
  return chain;
}

describe('scan helpers', () => {
  it('picks using the injected random source and stays in bounds', () => {
    const items = ['a', 'b', 'c', 'd'];
    expect(pickRandom(items, () => 0)).toBe('a');
    expect(pickRandom(items, () => 0.5)).toBe('c');
    expect(pickRandom(items, () => 0.9999999)).toBe('d');
    expect(pickRandom(items, () => 1)).toBe('d');
  });

  it('returns null when there is nothing to pick', () => {
    expect(pickRandom([])).toBeNull();
  });

  it('builds hex lines of the requested width', () => {
    const line = hexLine(() => 0.5, 6);
    expect(line.split(' ')).toHaveLength(6);
    expect(line).toMatch(/^([0-9a-f]{2} ?)+$/);
  });

  it('has a log and stage timings for the animation', () => {
    expect(COMPILE_LOG.length).toBeGreaterThan(0);
    expect(STAGE_MS.scan + STAGE_MS.triangulate + STAGE_MS.compile).toBeLessThan(2500);
  });
});

describe('fetchScanTarget', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns a catalog entry and only queries approved, active sites', async () => {
    const chain = mockCatalogue({
      data: [
        {
          id: '1',
          title: 'Old Web',
          original_url: 'https://example.org',
          upvotes: 9,
          downvotes: 2,
          wilson_score: 0.8,
          category_id: 'c1',
          subcategory_id: 's1',
          categories: { name: 'Tech' },
          subcategories: { name: 'Hacking' },
        },
      ],
      error: null,
    });
    const outcome = await fetchScanTarget();
    expect(outcome.error).toBeNull();
    expect(outcome.target).toEqual({
      id: '1',
      title: 'Old Web',
      original_url: 'https://example.org',
      upvotes: 9,
      downvotes: 2,
      wilson_score: 0.8,
      category_id: 'c1',
      subcategory_id: 's1',
      category: 'Tech',
      subcategory: 'Hacking',
    });
    expect(chain.eq).toHaveBeenCalledWith('approved', true);
    expect(chain.eq).toHaveBeenCalledWith('inactive', false);
  });

  it('uses disambiguated relationship hints for the category/subcategory embeds', async () => {
    // The tag-graph migration added a `url_categories` junction table, which made
    // the bare `categories(name)` / `subcategories(name)` embeds return PGRST201
    // "Multiple Choices". This guards the explicit-FK hint fix.
    const chain = mockCatalogue({ data: [], error: null });
    await fetchScanTarget();
    const selectArg = chain.select.mock.calls[0]?.[0] as string | undefined;
    expect(selectArg).toContain('categories!urls_category_id_fkey(name)');
    expect(selectArg).toContain('subcategories!urls_subcategory_id_fkey(name)');
  });

  it('surfaces the error message on a query error', async () => {
    mockCatalogue({ data: null, error: { message: 'boom' } });
    const outcome = await fetchScanTarget();
    expect(outcome.target).toBeNull();
    expect(outcome.error).toBe('boom');
  });

  it('reports an empty catalog', async () => {
    mockCatalogue({ data: [], error: null });
    const outcome = await fetchScanTarget();
    expect(outcome.target).toBeNull();
    expect(outcome.error).toBe('catalog is empty');
  });

  it('surfaces the network error instead of throwing', async () => {
    mockCatalogue(new Error('network down'));
    const outcome = await fetchScanTarget();
    expect(outcome.target).toBeNull();
    expect(outcome.error).toBe('network down');
  });

  it('retries without the inactive filter when the active pool is empty', async () => {
    const row = {
      id: '2',
      title: 'Fallback',
      original_url: 'https://fallback.example',
      upvotes: 1,
      downvotes: 0,
      wilson_score: 0.5,
      category_id: null,
      subcategory_id: null,
      categories: null,
      subcategories: null,
    };
    const chain = mockCatalogue(
      { data: [], error: null },
      { data: [row], error: null },
    );
    const outcome = await fetchScanTarget();
    expect(outcome.error).toBeNull();
    expect(outcome.target?.original_url).toBe('https://fallback.example');
    // approved + inactive on pass 1, then approved only on pass 2.
    expect(chain.eq).toHaveBeenCalledTimes(3);
  });

  describe('edge function path', () => {
    const OLD_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const OLD_FETCH = global.fetch;

    beforeEach(() => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test.co';
    });

    afterEach(() => {
      if (OLD_URL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = OLD_URL;
      global.fetch = OLD_FETCH;
      jest.clearAllMocks();
    });

    function mockEdgePath(
      session: { access_token: string } | null,
      edgeResponse: { ok: boolean; status: number; json: () => Promise<unknown> },
      enrichRow: Record<string, unknown> | null,
    ) {
      const maybeSingle = jest.fn().mockResolvedValue({ data: enrichRow ?? null, error: null });
      const limit = jest.fn(() => ({ maybeSingle }));
      const chain: Record<string, jest.Mock> = {};
      chain.select = jest.fn(() => chain);
      chain.eq = jest.fn(() => chain);
      chain.order = jest.fn(() => chain);
      chain.limit = limit;
      const client = {
        auth: { getSession: jest.fn().mockResolvedValue({ data: { session } }) },
        from: jest.fn(() => chain),
      };
      mockedCreateClient.mockReturnValue(client);
      global.fetch = jest.fn().mockResolvedValue(edgeResponse) as unknown as typeof fetch;
      return { chain, client };
    }

    it('uses the roam edge function when signed in (records gamification)', async () => {
      const row = {
        id: 'e1',
        title: 'Edge',
        original_url: 'https://edge.example',
        upvotes: 3,
        downvotes: 1,
        wilson_score: 0.7,
        category_id: 'c1',
        subcategory_id: 's1',
        categories: { name: 'Tech' },
        subcategories: { name: 'Web' },
      };
      mockEdgePath(
        { access_token: 'tok' },
        { ok: true, status: 200, json: async () => ({ url: 'https://edge.example' }) },
        row,
      );

      const outcome = await fetchScanTarget();

      expect(outcome.error).toBeNull();
      expect(outcome.target?.id).toBe('e1');
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://supabase.test.co/functions/v1/roam',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
        }),
      );
    });

    it('falls back to the direct query when the edge function is exhausted (404)', async () => {
      const directRow = {
        id: 'd1',
        title: 'Direct',
        original_url: 'https://direct.example',
        upvotes: 0,
        downvotes: 0,
        wilson_score: 0.2,
        category_id: null,
        subcategory_id: null,
        categories: null,
        subcategories: null,
      };
      const chain = mockCatalogue({ data: [directRow], error: null });
      mockedCreateClient.mockReturnValue({
        auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }) },
        from: jest.fn(() => chain),
      });
      global.fetch = jest
        .fn()
        .mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: 'exhausted' }) }) as unknown as typeof fetch;

      const outcome = await fetchScanTarget();

      expect(outcome.error).toBeNull();
      expect(outcome.target?.id).toBe('d1');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // Issue #120: a 404 is the one failure worth explaining. When the direct
    // fallback also finds nothing, the reason has to reach the card.
    it('keeps the reason from a 404 so the card can explain the gap', async () => {
      const chain = mockCatalogue({ data: [], error: null });
      mockedCreateClient.mockReturnValue({
        auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }) },
        from: jest.fn(() => chain),
      });
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

      const outcome = await fetchScanTarget();

      expect(outcome.target).toBeNull();
      expect(outcome.error).toBe('catalog is empty');
      expect(outcome.exhaustion).toEqual({
        reason: 'cooldown',
        scope: 'global',
        available_later: '2026-11-10T00:56:40Z',
      });
    });

    it('reports no reason when the 404 body predates v39', async () => {
      const chain = mockCatalogue({ data: [], error: null });
      mockedCreateClient.mockReturnValue({
        auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }) },
        from: jest.fn(() => chain),
      });
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'No more URLs to discover', exhausted: true }),
      }) as unknown as typeof fetch;

      const outcome = await fetchScanTarget();

      expect(outcome.exhaustion).toEqual({ reason: null, scope: null, available_later: null });
    });
  });
});
