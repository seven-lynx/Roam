/**
 * Tests for user interests management (lib/interests.ts).
 *
 * Issue #121: the mode is persisted in `user_settings.interest_mode` and is never
 * inferred from `user_categories` row shape, and a save is one atomic RPC rather
 * than a delete followed by an insert.
 */

import {
  saveUserInterests,
  loadUserInterests,
  resolveInterestState,
  selectAllCategories,
} from '@/lib/interests';
import type { InterestState } from '@/lib/interests';

interface RpcCall {
  fn: string;
  args: Record<string, unknown>;
}

/**
 * Build a mock SupabaseClient for the two shapes interests.ts uses:
 *   rpc(fn, args)                              -> { error }
 *   from(table).select(cols).eq(col, val)      -> awaitable { data, error }
 *   from(table).select(cols).eq(col, val).maybeSingle() -> { data, error }
 */
function mockSupabaseClient() {
  const responses = {
    rpc: { error: null as { message: string } | null },
    settings: { data: null as Record<string, unknown> | null, error: null as { message: string } | null },
    categories: { data: [] as Array<Record<string, unknown>>, error: null as { message: string } | null },
  };
  const calls = { rpc: [] as RpcCall[], tables: [] as string[] };

  const supabase = {
    _responses: responses,
    _calls: calls,

    rpc(fn: string, args: Record<string, unknown>) {
      calls.rpc.push({ fn, args });
      return Promise.resolve({ data: null, error: responses.rpc.error });
    },

    from(table: string) {
      calls.tables.push(table);
      return {
        select(_cols: string) {
          return {
            eq(_col: string, _val: string) {
              const result = table === 'user_settings' ? responses.settings : responses.categories;
              return {
                maybeSingle: () => Promise.resolve(result),
                then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
                  Promise.resolve(result).then(resolve, reject),
              };
            },
          };
        },
      };
    },
  };

  return supabase as typeof supabase & {
    from: (table: string) => ReturnType<typeof supabase.from>;
  };
}describe('Interests (lib/interests)', () => {
  describe('InterestState', () => {
    it('should allow pillar mode state', () => {
      const state: InterestState = {
        mode: 'pillars',
        selectedPillars: new Set(['cat-1', 'cat-2']),
        selectedTopics: new Set(),
      };
      expect(state.mode).toBe('pillars');
      expect(state.selectedPillars.size).toBe(2);
    });

    it('should allow topic mode state', () => {
      const state: InterestState = {
        mode: 'topics',
        selectedPillars: new Set(),
        selectedTopics: new Set(['sub-1', 'sub-2', 'sub-3']),
      };
      expect(state.mode).toBe('topics');
      expect(state.selectedTopics.size).toBe(3);
    });
  });

  describe('saveUserInterests', () => {
    it('writes pillars and the mode in a single RPC call', async () => {
      const supabase = mockSupabaseClient();

      await saveUserInterests(
        supabase as never,
        'pillars',
        new Set(['cat-a', 'cat-b']),
        new Set(),
      );

      expect(supabase._calls.rpc).toHaveLength(1);
      expect(supabase._calls.rpc[0].fn).toBe('replace_user_interests');
      expect(supabase._calls.rpc[0].args.p_mode).toBe('pillars');
      expect(supabase._calls.rpc[0].args.p_pillar_ids).toEqual(['cat-a', 'cat-b']);
      expect(supabase._calls.rpc[0].args.p_topic_ids).toEqual([]);
    });

    it('never touches user_categories directly (the delete/insert pair is gone)', async () => {
      const supabase = mockSupabaseClient();

      await saveUserInterests(supabase as never, 'pillars', new Set(['cat-a']), new Set());

      expect(supabase._calls.tables).toEqual([]);
    });

    it('writes topics and the mode in a single RPC call', async () => {
      const supabase = mockSupabaseClient();

      await saveUserInterests(
        supabase as never,
        'topics',
        new Set(['cat-a']),
        new Set(['sub-1', 'sub-2']),
      );

      expect(supabase._calls.rpc).toHaveLength(1);
      expect(supabase._calls.rpc[0].args.p_mode).toBe('topics');
      expect(supabase._calls.rpc[0].args.p_pillar_ids).toEqual([]);
      expect(supabase._calls.rpc[0].args.p_topic_ids).toEqual(['sub-1', 'sub-2']);
    });    it('rejects an empty selection instead of stripping every row', async () => {
      const supabase = mockSupabaseClient();

      await expect(
        saveUserInterests(supabase as never, 'pillars', new Set(), new Set()),
      ).rejects.toThrow('Pick at least one category');

      await expect(
        saveUserInterests(supabase as never, 'topics', new Set(), new Set()),
      ).rejects.toThrow('Pick at least one topic');

      expect(supabase._calls.rpc).toHaveLength(0);
    });

    it('surfaces the RPC error message', async () => {
      const supabase = mockSupabaseClient();
      supabase._responses.rpc = { error: { message: 'Unknown category in selection' } };

      await expect(
        saveUserInterests(supabase as never, 'pillars', new Set(['cat-a']), new Set()),
      ).rejects.toThrow('Unknown category in selection');
    });
  });

  describe('loadUserInterests', () => {
    it('reads pillar mode from user_settings, not from row shape', async () => {
      const supabase = mockSupabaseClient();
      supabase._responses.settings = { data: { interest_mode: 'pillars' }, error: null };
      supabase._responses.categories = {
        data: [
          { category_id: 'cat-1', subcategory_id: null },
          { category_id: 'cat-2', subcategory_id: null },
        ],
        error: null,
      };

      const result = await loadUserInterests(supabase as never, 'user-1');

      expect(result.mode).toBe('pillars');
      expect(result.selectedPillars.has('cat-1')).toBe(true);
      expect(result.selectedPillars.has('cat-2')).toBe(true);
      expect(result.selectedTopics.size).toBe(0);
    });

    it('keeps the stored mode when a stray topic row is present (issue #121)', async () => {
      const supabase = mockSupabaseClient();
      supabase._responses.settings = { data: { interest_mode: 'pillars' }, error: null };
      supabase._responses.categories = {
        data: [
          { category_id: 'cat-1', subcategory_id: null },
          { category_id: 'cat-2', subcategory_id: 'sub-a' },
        ],
        error: null,
      };

      const result = await loadUserInterests(supabase as never, 'user-2');

      // The stray row must not flip the picker into topics mode any more.
      expect(result.mode).toBe('pillars');
      expect(result.selectedPillars.has('cat-1')).toBe(true);
      expect(result.selectedTopics.size).toBe(0);
    });

    it('reads topics mode from user_settings despite pillar-shaped rows', async () => {
      const supabase = mockSupabaseClient();
      supabase._responses.settings = { data: { interest_mode: 'topics' }, error: null };
      supabase._responses.categories = {
        data: [
          { category_id: 'cat-1', subcategory_id: null },
          { category_id: 'cat-2', subcategory_id: 'sub-a' },
        ],
        error: null,
      };

      const result = await loadUserInterests(supabase as never, 'user-3');

      expect(result.mode).toBe('topics');
      expect(result.selectedTopics.has('sub-a')).toBe(true);
      expect(result.selectedPillars.size).toBe(0);
    });

    it('defaults to pillars when the user has no settings row', async () => {
      const supabase = mockSupabaseClient();
      supabase._responses.settings = { data: null, error: null };
      supabase._responses.categories = { data: [], error: null };

      const result = await loadUserInterests(supabase as never, 'user-4');

      expect(result.mode).toBe('pillars');
      expect(result.selectedPillars.size).toBe(0);
      expect(result.selectedTopics.size).toBe(0);
    });

    it('throws when the settings query fails', async () => {
      const supabase = mockSupabaseClient();
      supabase._responses.settings = { data: null, error: { message: 'Settings failed' } };

      await expect(loadUserInterests(supabase as never, 'user-5')).rejects.toThrow('Settings failed');
    });

    it('throws when the rows query fails', async () => {
      const supabase = mockSupabaseClient();
      supabase._responses.categories = { data: [], error: { message: 'Query failed' } };

      await expect(loadUserInterests(supabase as never, 'user-6')).rejects.toThrow('Query failed');
    });
  });

  describe('resolveInterestState', () => {
    it('ignores a stray topic row when the stored mode is pillars', () => {
      const state = resolveInterestState('pillars', [
        { category_id: 'cat-1', subcategory_id: null },
        { category_id: 'cat-2', subcategory_id: 'sub-a' },
      ]);

      expect(state.mode).toBe('pillars');
      expect(state.selectedPillars.has('cat-1')).toBe(true);
      expect(state.selectedTopics.size).toBe(0);
    });

    it('falls back to pillars when the mode is missing', () => {
      const state = resolveInterestState(null, [
        { category_id: 'cat-1', subcategory_id: null },
      ]);

      expect(state.mode).toBe('pillars');
      expect(state.selectedPillars.has('cat-1')).toBe(true);
    });
  });

  describe('selectAllCategories', () => {
    it('selects every category so "everything" is not the empty selection', () => {
      const all = selectAllCategories([{ id: 'cat-1' }, { id: 'cat-2' }]);

      expect(all.size).toBe(2);
      expect(all.has('cat-1')).toBe(true);
      expect(all.has('cat-2')).toBe(true);
    });
  });
});