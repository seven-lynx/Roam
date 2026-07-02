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

    const column = mode === 'followers' ? 'follower_id' : 'following_id';
    const joinColumn = mode === 'followers' ? 'following_id' : 'follower_id';

    // We need the OTHER user's profile, so for followers we join on follower_id,
    // for following we join on following_id.
    const { data, error: queryError } = await supabase
      .from('follows')
      .select(`profiles:${column}(id, username, display_name)`)
      .eq(joinColumn, userId)
      .eq('is_pending', false)
      .order('created_at', { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    // profiles returned as a single object (via the join), not an array
    const resolved: FollowUser[] = (data ?? [])
      .map((row: Record<string, unknown>) => {
        const p = row.profiles as FollowUser | null;
        return p ?? null;
      })
      .filter((u: FollowUser | null): u is FollowUser => u !== null && u.username != null);

    setUsers(resolved);
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