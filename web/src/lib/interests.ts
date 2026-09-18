import type { SupabaseClient } from '@supabase/supabase-js';

export type InterestMode = 'pillars' | 'topics';

export interface InterestState {
  mode: InterestMode;
  selectedPillars: Set<string>;
  selectedTopics: Set<string>;
}

/** Maps subcategory ID → parent category ID. */
export type SubcategoryParentMap = Map<string, string>;

/**
 * Deletes all user_categories rows for this user and re-inserts from state.
 * In pillars mode inserts one pillar-level row per selected category (subcategory_id = null).
 * In topics mode inserts one topic-level row per selected subcategory.
 */
export async function saveUserInterests(
  supabase: SupabaseClient,
  userId: string,
  mode: InterestMode,
  selectedPillars: Set<string>,
  selectedTopics: Set<string>,
  subcategoryParentMap: SubcategoryParentMap,
): Promise<void> {
  const { error: delError } = await supabase
    .from('user_categories')
    .delete()
    .eq('user_id', userId);
  if (delError) throw new Error(delError.message);

  const rows =
    mode === 'pillars'
      ? Array.from(selectedPillars).map((category_id) => ({
          user_id: userId,
          category_id,
          subcategory_id: null as string | null,
        }))
      : Array.from(selectedTopics).map((subcategory_id) => ({
          user_id: userId,
          category_id: subcategoryParentMap.get(subcategory_id) ?? null,
          subcategory_id,
        }));

  if (rows.length === 0) return;

  const { error: insError } = await supabase.from('user_categories').insert(rows);
  if (insError) throw new Error(insError.message);
}

/**
 * Reads the user's current interests from user_categories.
 * Returns pillar mode if all rows have no subcategory, otherwise topic mode.
 */
export async function loadUserInterests(
  supabase: SupabaseClient,
  userId: string,
): Promise<InterestState> {
  const { data, error } = await supabase
    .from('user_categories')
    .select('category_id, subcategory_id')
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
  const rows = data ?? [];

  const topicRows = rows.filter((r) => r.subcategory_id != null);

  if (topicRows.length > 0) {
    return {
      mode: 'topics',
      selectedPillars: new Set(),
      selectedTopics: new Set(topicRows.map((r) => r.subcategory_id as string)),
    };
  }

  return {
    mode: 'pillars',
    selectedPillars: new Set(rows.map((r) => r.category_id as string)),
    selectedTopics: new Set(),
  };
}
