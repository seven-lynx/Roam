jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }));

import { createClient } from '@/lib/supabase/client';
import { COMPILE_LOG, STAGE_MS, fetchScanTarget, hexLine, pickRandom } from '@/lib/scan';

const mockedCreateClient = createClient as unknown as jest.Mock;

function mockCatalogue(result: { data: unknown; error: unknown } | Error) {
  const limit = result instanceof Error ? jest.fn().mockRejectedValue(result) : jest.fn().mockResolvedValue(result);
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

  it('returns a catalogue entry and only queries approved, active sites', async () => {
    const chain = mockCatalogue({
      data: [{ id: '1', title: 'Old Web', original_url: 'https://example.org', upvotes: 9 }],
      error: null,
    });
    const target = await fetchScanTarget();
    expect(target).toEqual({ id: '1', title: 'Old Web', original_url: 'https://example.org', upvotes: 9 });
    expect(chain.eq).toHaveBeenCalledWith('approved', true);
    expect(chain.eq).toHaveBeenCalledWith('inactive', false);
  });

  it('returns null on a query error', async () => {
    mockCatalogue({ data: null, error: { message: 'boom' } });
    expect(await fetchScanTarget()).toBeNull();
  });

  it('returns null when the catalogue is empty', async () => {
    mockCatalogue({ data: [], error: null });
    expect(await fetchScanTarget()).toBeNull();
  });

  it('returns null instead of throwing when the request fails', async () => {
    mockCatalogue(new Error('network down'));
    expect(await fetchScanTarget()).toBeNull();
  });
});
