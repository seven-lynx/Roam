'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface FollowUser {
  id: string;
  username: string;
  display_name: string;
}

interface FollowListProps {
  userId: string;
  mode: 'followers' | 'following';
}

export function FollowList({ userId, mode }: FollowListProps) {
  const supabase = createClient();
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    const filterColumn = mode === 'followers' ? 'following_id' : 'follower_id';
    const selectColumn = mode === 'followers' ? 'follower_id' : 'following_id';

    // Step 1: Get user IDs from follows
    // (follows.follower_id/following_id reference auth.users, not public.profiles,
    //  so Supabase cannot auto-join via FK — do it manually)
    const { data: followRows, error: followError } = await supabase
      .from('follows')
      .select(selectColumn)
      .eq(filterColumn, userId)
      .order('created_at', { ascending: false });

    if (followError) {
      setError(followError.message);
      setLoading(false);
      return;
    }

    const userIds = (followRows ?? [])
      .map((r: Record<string, string>) => r[selectColumn])
      .filter(Boolean);

    if (userIds.length === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }

    // Step 2: Fetch profiles for those user IDs
    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .in('id', userIds);

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    setUsers((profileRows ?? []) as FollowUser[]);
    setLoading(false);
  }, [supabase, userId, mode]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-zinc-400">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center text-sm text-red-600">
        Failed to load: {error}
        <button
          onClick={fetch}
          className="ml-2 underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-zinc-400">
        {mode === 'followers'
          ? 'No followers yet.'
          : 'Not following anyone yet.'}
      </div>
    );
  }

  const initials = (name: string | null, fallback: string) => {
    const source = name || fallback;
    return source[0]?.toUpperCase() ?? '?';
  };

  return (
    <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
      {users.map((user) => (
        <li key={user.id}>
          <Link
            href={`/u/${user.username}`}
            className="flex items-center gap-3 px-1 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-lg transition-colors"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 text-white text-sm font-bold shrink-0">
              {initials(user.display_name, user.username)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                {user.display_name || user.username}
              </p>
              <p className="text-xs text-zinc-400 truncate">@{user.username}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}