jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }));

import { createClient } from '@/lib/supabase/client';
import { fetchLeaderboard, LEADERBOARD_PERIODS, PERIOD_LABELS } from '@/lib/leaderboard';

const mockedCreateClient = createClient as unknown as jest.Mock;

function mockSession(session: { access_token: string } | null) {
  mockedCreateClient.mockReturnValue({
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session } }) },
  });
}

const entry = {
  rank: 1,
  user_id: 'u1',
  username: 'alice',
  display_name: 'Alice',
  avatar_url: null,
  xp_total: 15420,
  level: 12,
  badge_count: 15,
  streak_days: 3,
  xp_earned: 220,
};

function mockFetch(status: number, body: unknown, jsonThrows = false) {
  const fn = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: jsonThrows ? jest.fn().mockRejectedValue(new SyntaxError('Unexpected token <')) : jest.fn().mockResolvedValue(body),
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

function sentHeaders(fn: jest.Mock): Record<string, string> {
  return fn.mock.calls[0][1].headers as Record<string, string>;
}

describe('fetchLeaderboard', () => {
  const OLD_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const OLD_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-123';
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (OLD_URL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = OLD_URL;
    if (OLD_KEY === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = OLD_KEY;
    jest.restoreAllMocks();
  });

  it('sends credentials when signed out so verify_jwt does not 401 the public widget', async () => {
    mockSession(null);
    const fetchMock = mockFetch(200, { period: 'weekly', entries: [entry] });

    const entries = await fetchLeaderboard('weekly');

    expect(entries).toEqual([entry]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentHeaders(fetchMock)).toEqual({
      apikey: 'anon-key-123',
      Authorization: 'Bearer anon-key-123',
    });
  });

  it('prefers the signed-in access token as the bearer', async () => {
    mockSession({ access_token: 'user-jwt' });
    const fetchMock = mockFetch(200, { entries: [] });

    await fetchLeaderboard();

    expect(sentHeaders(fetchMock)).toEqual({
      apikey: 'anon-key-123',
      Authorization: 'Bearer user-jwt',
    });
  });

  it('puts the period in the query string and defaults to weekly', async () => {
    mockSession(null);
    const fetchMock = mockFetch(200, { entries: [] });

    await fetchLeaderboard('all_time');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://supabase.test.co/functions/v1/leaderboard?period=all_time',
    );
  });

  it('surfaces the gateway message instead of a bare HTTP 401', async () => {
    mockSession(null);
    mockFetch(401, { message: 'Missing authorization header' });

    await expect(fetchLeaderboard()).rejects.toThrow('Missing authorization header');
  });

  it('surfaces the edge function error field', async () => {
    mockSession(null);
    mockFetch(400, { error: 'Invalid period. Use weekly, monthly, or all_time.' });

    await expect(fetchLeaderboard()).rejects.toThrow('Invalid period');
  });

  it('does not throw a parse error when the error body is not JSON', async () => {
    mockSession(null);
    mockFetch(401, null, true);

    await expect(fetchLeaderboard()).rejects.toThrow('Rankings are temporarily unavailable.');
  });

  it('keeps a readable message for other statuses', async () => {
    mockSession(null);
    mockFetch(500, {});

    await expect(fetchLeaderboard()).rejects.toThrow('HTTP 500: Failed to load rankings');
  });

  it('throws when the Supabase env is missing, without calling fetch', async () => {
    mockSession(null);
    const fetchMock = mockFetch(200, { entries: [] });
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    await expect(fetchLeaderboard()).rejects.toThrow('Rankings are unavailable right now.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('exposes the toggle periods and their labels', () => {
    expect(LEADERBOARD_PERIODS).toEqual(['weekly', 'monthly', 'all_time']);
    expect(PERIOD_LABELS).toEqual({
      weekly: 'This Week',
      monthly: 'This Month',
      all_time: 'All Time',
    });
  });
});