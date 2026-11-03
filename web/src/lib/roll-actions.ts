'use client';

import { createClient } from '@/lib/supabase/client';

/**
 * Server-side tracking for the Cyberdeck Roll gallery actions (set wallpaper,
 * rate a photo). Fire-and-forget: signed-out operators skip tracking entirely,
 * and any failure is swallowed so the gallery never breaks on a dead relay.
 */
export type RollActionType = 'wallpaper' | 'roll_rate';

async function recordRollAction(type: RollActionType, metadata: Record<string, unknown>): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  try {
    await supabase.functions.invoke('roll-action', { body: { action_type: type, metadata } });
  } catch (e) {
    console.warn('[roll-actions] tracking failed', e);
  }
}

export function recordWallpaperAction(photoId: string): void {
  void recordRollAction('wallpaper', { photo_id: photoId });
}

export function recordRollRateAction(photoId: string): void {
  void recordRollAction('roll_rate', { photo_id: photoId });
}
