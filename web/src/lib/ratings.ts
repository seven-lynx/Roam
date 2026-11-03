import { createClient } from '@/lib/supabase/client';

/**
 * Read the signed-in user's current rating (+1 / -1) for a URL. RLS on the
 * `ratings` table limits reads to the caller's own rows, so a missing row reads
 * as "not yet rated".
 */
export async function getMyRating(urlId: string): Promise<1 | -1 | null> {
  try {
    const { data } = await createClient()
      .from('ratings')
      .select('value')
      .eq('url_id', urlId)
      .maybeSingle();
    const v = data?.value;
    return v === 1 || v === -1 ? (v as 1 | -1) : null;
  } catch (e) {
    console.error('[ratings] read failed', e);
    return null;
  }
}

/**
 * Upsert a rating (+1 up / -1 down). Each user can rate a URL once; a later
 * vote overwrites the earlier one (enforced by the unique (user_id, url_id)
 * constraint and the Wilson-score trigger).
 */
export async function setRating(urlId: string, userId: string, value: 1 | -1): Promise<boolean> {
  try {
    const { error } = await createClient()
      .from('ratings')
      .upsert({ user_id: userId, url_id: urlId, value }, { onConflict: 'user_id,url_id' });
    return !error;
  } catch (e) {
    console.error('[ratings] upsert failed', e);
    return false;
  }
}