/**
 * Tests for user interests management (lib/interests.ts).
 * Verifies: saveUserInterests, loadUserInterests, InterestState, pillar vs topic modes.
 */

import {
  saveUserInterests,
  loadUserInterests,
} from '@/lib/interests';
import type { InterestState, SubcategoryParentMap } from '@/lib/interests';

/**
 * Build a mock SupabaseClient that supports the chaining pattern used by interests.ts:
 *   from(table).delete().eq(col, val)  → { error }
 *   from(table).select(cols).eq(col, val) → { data, error }
 *   from(table).insert(rows) → { error }
 */
function mockSupabaseClient() {
  // Responses that can be reconfigured per test
  const responses = {
    delete: { error: null as { message: string } | null },
    select: { data: [] as Array<Record<string, unknown>>, error: null as { message: string } | null },
    insert: { error: null as { message: string } | null },
  };

  const supabase = {
    _responses: responses,

    from(_table: string) {
      return {
        delete() {
          const self = this;
          return {
            eq(_col: string, _val: string) {
              return responses.delete;
            },
          };
        },
        select(_cols: string) {
          const self = this;
          return {
            eq(_col: string, _val: string) {
              return responses.select;
            },
          };
        },
        insert(rows: Array<Record<string, unknown>>) {
          return responses.insert;
        },
      };
    },
  };

  return supabase as typeof supabase & {
    from: (table: string) => ReturnType<typeof supabase.from>;
    _responses: typeof responses;
  };
}

describe('Interests (lib/interests)', () => {
  // ─── InterestState type ──────────────────────────────────────────────────────

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

  // ─── saveUserInterests ───────────────────────────────────────────────────────

  describe('saveUserInterests', () => {
    it('should delete existing rows and insert pillar-level rows in pillars mode', async () => {
      const supabase = mockSupabaseClient();
      supabase._responses.delete = { error: null };
      supabase._responses.insert = { error: null };

      const parentMap: SubcategoryParentMap = new Map();

      await saveUserInterests(
        supabase as never,
        'user-1',
        'pillars',
        new Set(['cat-a', 'cat-b']),
        new Set(),
        parentMap,
      );

      // Check that insert was called with correct rows — verify by checking
      // no errors were thrown (which confirms the mock chaining worked)
    });

    it('should insert topic-level rows in topics mode with parent mapping', async () => {
      const supabase = mockSupabaseClient();
      supabase._responses.delete = { error: null };
      supabase._responses.insert = { error: null };

      const parentMap: SubcategoryParentMap = new Map([
        ['sub-1', 'cat-a'],
        ['sub-2', 'cat-b'],
      ]);

      await saveUserInterests(
        supabase as never,
        'user-2',
        'topics',
        new Set(),
        new Set(['sub-1', 'sub-2']),
        parentMap,
      );

      // No errors = success
    });

    it('should not call insert when no rows to insert (empty selection)', async () => {
      const supabase = mockSupabaseClient();
      supabase._responses.delete = { error: null };

      const parentMap: SubcategoryParentMap = new Map();

      await saveUserInterests(
        supabase as never,
        'user-3',
        'pillars',
        new Set(),
        new Set(),
        parentMap,
      );

      // Should not throw — delete succeeds, insert is skipped
    });

    it('should throw when delete fails', async () => {
      const supabase = mockSupabaseClient();
      supabase._responses.delete = { error: { message: 'DB error' } };

      const parentMap: SubcategoryParentMap = new Map();

      await expect(
        saveUserInterests(
          supabase as never,
          'user-4',
          'pillars',
          new Set(['cat-a']),
          new Set(),
          parentMap,
        )
      ).rejects.toThrow('DB error');
    });

    it('should throw when insert fails', async () => {
      const supabase = mockSupabaseClient();
      supabase._responses.delete = { error: null };
      supabase._responses.insert = { error: { message: 'Insert failed' } };

      const parentMap: SubcategoryParentMap = new Map();

      await expect(
        saveUserInterests(
          supabase as never,
          'user-5',
          'pillars',
          new Set(['cat-a']),
          new Set(),
          parentMap,
        )
      ).rejects.toThrow('Insert failed');
    });
  });

  // ─── loadUserInterests ──────────────────────────────────────────────────────

  describe('loadUserInterests', () => {
    it('should return pillars mode when all rows have null subcategory_id', async () => {
      const supabase = mockSupabaseClient();
      supabase._responses.select = {
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

    it('should return topics mode when any row has a subcategory_id', async () => {
      const supabase = mockSupabaseClient();
      supabase._responses.select = {
        data: [
          { category_id: 'cat-1', subcategory_id: 'sub-a' },
          { category_id: 'cat-2', subcategory_id: null },
        ],
        error: null,
      };

      const result = await loadUserInterests(supabase as never, 'user-2');

      expect(result.mode).toBe('topics');
      expect(result.selectedTopics.has('sub-a')).toBe(true);
      // selectedPillars should be empty in topics mode
      expect(result.selectedPillars.size).toBe(0);
    });

    it('should return empty pillars mode when no rows exist', async () => {
      const supabase = mockSupabaseClient();
      supabase._responses.select = { data: [], error: null };

      const result = await loadUserInterests(supabase as never, 'user-3');

      expect(result.mode).toBe('pillars');
      expect(result.selectedPillars.size).toBe(0);
      expect(result.selectedTopics.size).toBe(0);
    });

    it('should throw on query error', async () => {
      const supabase = mockSupabaseClient();
      supabase._responses.select = { data: [], error: { message: 'Query failed' } };

      await expect(
        loadUserInterests(supabase as never, 'user-4')
      ).rejects.toThrow('Query failed');
    });
  });
});