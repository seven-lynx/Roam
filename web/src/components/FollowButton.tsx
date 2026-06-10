'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface FollowButtonProps {
  targetUserId: string;
  initialStatus: 'none' | 'following' | 'pending';
}

export function FollowButton({ targetUserId, initialStatus }: FollowButtonProps) {
  const supabase = createClient();
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      if (status === 'none') {
        // Follow
        const { data, error } = await supabase.functions.invoke('follow', {
          body: { action: 'follow', target_user_id: targetUserId },
        });
        if (error) throw error;
        const newStatus = data?.status ?? 'following';
        setStatus(newStatus);
      } else {
        // Unfollow (works for both 'following' and 'pending')
        const { error } = await supabase.functions.invoke('follow', {
          body: { action: 'unfollow', target_user_id: targetUserId },
        });
        if (error) throw error;
        setStatus('none');
      }
    } finally {
      setLoading(false);
    }
  }

  const label = status === 'following' ? 'Following' : status === 'pending' ? 'Requested' : 'Follow';
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