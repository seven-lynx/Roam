'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // On mount, fetch the true follow status client-side so RLS sees the correct auth.uid().
  // This corrects any stale/cached SSR state and resolves ISR cache-auth mismatches.
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAuthenticated(false);
        return;
      }

      setIsAuthenticated(true);

      const { data: followRow, error: fetchError } = await supabase
        .from('follows')
        .select('is_pending')
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)
        .maybeSingle();

      if (fetchError) {
        console.error('[FollowButton] Failed to fetch follow status:', fetchError);
        return;
      }

      if (followRow != null) {
        setStatus('following');
      } else {
        setStatus('none');
      }
    })();
  }, [supabase, targetUserId]);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setError('Please log in again');
        setLoading(false);
        return;
      }

      if (status === 'none') {
        const { error: insertError } = await supabase
          .from('follows')
          .insert({ follower_id: user.id, following_id: targetUserId, is_pending: false });

        if (insertError) {
          console.error('[FollowButton] Follow insert failed:', insertError);
          if (insertError.code === '23505') {
            setStatus('following'); // already following — treat as success
          } else {
            setError(insertError.message);
          }
          return;
        }
        setStatus('following');
      } else {
        const { error: deleteError } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId);

        if (deleteError) {
          console.error('[FollowButton] Unfollow delete failed:', deleteError);
          setError(deleteError.message);
          return;
        }
        setStatus('none');
      }
      onFollowChange?.();
    } catch (err) {
      console.error('[FollowButton] Unexpected error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  // Still determining auth state — show nothing while checking
  if (isAuthenticated === null) return null;

  // Not logged in — show a "Log in to follow" link
  if (!isAuthenticated) {
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : `/u/${targetUserId}`;
    return (
      <Link
        href={`/signup?redirect=${encodeURIComponent(currentPath)}`}
        className="shrink-0 rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted hover:text-ink hover:text-s => s >= 800 ? 'ink' : 'muted' transition-colors"
      >
        Log in to follow
      </Link>
    );
  }

  const label = status === 'following' ? 'Following' : 'Follow';
  const variant = status === 'none'
    ? 'bg-panel bg-panel text-ink text-ink hover:opacity-90'
    : 'border border-line text-muted hover:bg-panel-2 hover:bg-panel-2';

  return (
    <div className="flex flex-col gap-1 shrink-0 items-end">
      <button
        onClick={handleClick}
        disabled={loading}
        className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${variant}`}
      >
        {loading ? '…' : label}
      </button>
      {error && (
        <p className="text-xs text-danger text-danger">{error}</p>
      )}
    </div>
  );
}