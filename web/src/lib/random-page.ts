import { createClient } from '@/lib/supabase/client';
import { roamBufferNext } from '@/lib/roam-buffer';

/**
 * Pick a random curated page URL for the homepage's "try a random page" button.
 * Prefers a validated (hot) entry from the prefetch buffer; falls back to a
 * direct catalog query. Returns null when the catalog is unreachable.
 */
export async function fetchRandomPageUrl(): Promise<string | null> {
  const hot = roamBufferNext();
  if (hot?.url) return hot.url;

  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('urls')
      .select('original_url')
      .limit(1)
      .order('RANDOM()' as never);

    if (data && data.length > 0 && data[0]?.original_url) {
      return data[0].original_url;
    }
    return null;
  } catch {
    return null;
  }
}
