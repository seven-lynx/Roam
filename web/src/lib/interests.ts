import type { SupabaseClient } from '@supabase/supabase-js';

export type InterestMode = 'pillars' | 'topics';

export interface InterestState {
  mode: InterestMode;
  selectedPillars: Set<string>;
  selectedTopics: Set<string>;
}

export interface InterestRow {
  category_id: string | null;
  subcategory_id: string | null;
}

/**
 * The single definition of what a user's stored interests mean.
 *
 * The mode comes from `user_settings.interest_mode` and is never inferred from row
 * shape (issue #121) — one stray topic row used to flip the whole picker into
 * topics mode. Rows that do not belong to the stored mode are ignored rather than
 * allowed to change it. Used by the client reader below and by the `/profile`
 * server component, so the rule lives in one place.
 */
export function resolveInterestState(
  interestMode: string | null | undefined,
  rows: InterestRow[],
): InterestState {
  if (interestMode === 'topics') {
    return {
      mode: 'topics',
      selectedPillars: new Set(),
      selectedTopics: new Set(
        rows
          .filter((r) => r.subcategory_id != null)
          .map((r) => r.subcategory_id as string),
      ),
    };
  }

  return {
    mode: 'pillars',
    selectedPillars: new Set(
      rows
        .filter((r) => r.subcategory_id == null && r.category_id != null)
        .map((r) => r.category_id as string),
    ),
    selectedTopics: new Set(),
  };
}

/**
 * Replaces the user's interests through `replace_user_interests()`.
 *
 * The mode and the rows are written in one transaction (issue #121): the old
 * delete-all-then-insert pair lived in two PostgREST requests, so a failure
 * between them left zero rows — which `roam()` reads as "no filter at all" — or
 * a partial set that silently narrowed discovery. The RPC also refuses an empty
 * selection, so "everything" has to be an explicit choice (all categories).
 *
 * Only the active mode's ids are sent; the RPC derives each topic's parent
 * category itself, so no client-side parent map is needed.
 */
export async function saveUserInterests(
  supabase: SupabaseClient,
  mode: InterestMode,
  selectedPillars: Set<string>,
  selectedTopics: Set<string>,
): Promise<void> {
  const pillarIds = mode === 'pillars' ? [...selectedPillars] : [];
  const topicIds = mode === 'topics' ? [...selectedTopics] : [];

  // Mirrors the RPC's own guard so the UI gets the message without a round trip.
  if (mode === 'pillars' && pillarIds.length === 0) {
    throw new Error('Pick at least one category');
  }
  if (mode === 'topics' && topicIds.length === 0) {
    throw new Error('Pick at least one topic');
  }

  const { error } = await supabase.rpc('replace_user_interests', {
    p_mode: mode,
    p_pillar_ids: pillarIds,
    p_topic_ids: topicIds,
  });
  if (error) throw new Error(error.message);
}

/**
 * Reads the user's interests: the mode from `user_settings.interest_mode` and the
 * rows from `user_categories`.
 *
 * The mode is never inferred from row shape any more (issue #121) — a single
 * stray topic row used to flip the whole picker into topics mode. Rows that do
 * not belong to the stored mode are ignored rather than allowed to change it.
 */
export async function loadUserInterests(
  supabase: SupabaseClient,
  userId: string,
): Promise<InterestState> {
  const [settings, rowsResult] = await Promise.all([
    supabase
      .from('user_settings')
      .select('interest_mode')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('user_categories')
      .select('category_id, subcategory_id')
      .eq('user_id', userId),
  ]);

  if (settings.error) throw new Error(settings.error.message);
  if (rowsResult.error) throw new Error(rowsResult.error.message);

  const storedMode = (settings.data as { interest_mode?: string } | null)?.interest_mode;
  return resolveInterestState(storedMode, (rowsResult.data ?? []) as InterestRow[]);
}

/**
 * The "everything" selection: every category, which `roam()` already reads as the
 * whole pool. Kept here so all three surfaces name the same concept.
 */
export function selectAllCategories(categories: { id: string }[]): Set<string> {
  return new Set(categories.map((c) => c.id));
}