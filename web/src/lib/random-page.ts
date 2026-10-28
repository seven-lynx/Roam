import { createClient } from '@/lib/supabase/client';
import { APP_URL } from '@/lib/constants';

/**
 * Opens a page from the curated catalogue in a new tab, falling back to the
 * public collections page if the lookup fails. Used by the homepage's
 * "try a random page" button; the ROAM key on the deck runs the scan sequence
 * instead (see ScanSequence).
 */
export async function openRandomPage(): Promise<void> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('urls')
      .select('original_url')
      .limit(1)
      .order('RANDOM()' as never);

    if (data && data.length > 0 && data[0]?.original_url) {
      window.open(data[0].original_url, '_blank', 'noopener,noreferrer');
    } else {
      window.open(`${APP_URL}/collections`, '_blank');
    }
  } catch {
    window.open(`${APP_URL}/collections`, '_blank');
  }
}
