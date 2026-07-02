'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface FollowButtonProps {
  targetUserId: string;
  initialStatus: 'none' | 'following';
  onFollowChange?: () => void;
}

export function FollowButton({ targetUserId, initialStatus, onFollowChange }: FollowButtonProps) {
  const supabase = createClient();
  const [status, setStatus] = useState<'none' | 'following'>(initialStatus);
  const [loading, setLoading] = useState(false);

  // On mount, fetch the true follow status client-side so RLS sees the correct auth.uid().
  // This corrects any stale/cached SSR state and resolves ISR cache-auth mismatches.
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: followRow } = await supabase
        .from('follows')
        .select('is_pending')
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)
        .maybeSingle();

      if (followRow != null) {
        setStatus('following');
      } else {
        setStatus('none');
      }
    })();
  }, [supabase, targetUserId]);

  async function handleClick() {
    setLoading(true);
    try {
      if (status === 'none') {
        const { error } = await supabase.functions.invoke('follow', {
          body: { action: 'follow', following_id: targetUserId },
        });
        if (error) throw error;
        setStatus('following');
      } else {
        const { error } = await supabase.functions.invoke('follow', {
          body: { action: 'unfollow', following_id: targetUserId },
        });
        if (error) throw error;
        setStatus('none');
      }
      onFollowChange?.();
    } finally {
      setLoading(false);
    }
  }

  const label = status === 'following' ? 'Following' : 'Follow';
  const variant = status === 'none'
    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90'
    : 'border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800';

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${variant}`}
    >
      {loading ? '…' : label}
    </button>
  );
}