import { createClient } from '@/lib/supabase/client';

/**
 * Save a URL to the authenticated user's server-side "saved for later" list via
 * the `save-url` edge function (mirrors Android's RoamRepository.saveUrl). The
 * edge function runs with the caller's JWT, so RLS on `saved_urls` applies.
 */
export async function saveUrlForUser(
  url: string,
  title: string | null,
  urlId?: string | null,
): Promise<boolean> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return false;

  try {
    const res = await fetch(`${base}/functions/v1/save-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: 'save',
        url,
        title: title ?? '',
        url_id: urlId ?? null,
      }),
    });
    if (!res.ok) {
      console.error('[save-url] request failed', { status: res.status, url });
      return false;
    }
    return true;
  } catch (e) {
    console.error('[save-url] unreachable', e);
    return false;
  }
}
