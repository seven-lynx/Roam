'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface FollowUser {
  id: string;
  username: string;
  display_name: string;
}

interface FollowSectionProps {
  profileId: string;
  followerCount: number;
  followingCount: number;
}

type ViewMode = 'stats' | 'followers' | 'following';

export function FollowSection({ profileId, followerCount, followingCount }: FollowSectionProps) {
  const supabase = createClient();
  const [viewMode, setViewMode] = useState<ViewMode>('stats');
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(false);

  async function showList(mode: 'followers' | 'following') {
    if (viewMode === mode) {
      setViewMode('stats');
      return;
    }

    setViewMode(mode);
    setLoading(true);

    const column = mode === 'followers' ? 'follower_id' : 'following_id';
    const joinColumn = mode === 'followers' ? 'following_id' : 'follower_id';

    const { data } = await supabase
      .from('follows')
      .select(`profiles:${column}(id, username, display_name)`)
      .eq(joinColumn, profileId)
      .eq('is_pending', false)
      .order('created_at', { ascending: false });

    const resolved: FollowUser[] = (data ?? [])
      .map((row: Record<string, unknown>) => row.profiles as FollowUser | null)
      .filter((u: FollowUser | null): u is FollowUser => u !== null && u.username != null);

    setUsers(resolved);
    setLoading(false);
  }

  const initials = (name: string | null, fallback: string) => {
    const source = name || fallback;
    return source[0]?.toUpperCase() ?? '?';
  };

  return (
    <div>
      {viewMode === 'stats' && (
        <div className="flex items-center gap-6 text-sm">
          <button
            onClick={() => showList('followers')}
            className="text-center hover:opacity-70 transition-opacity"
          >
            <p className="font-semibold text-zinc-900 dark:text-white">{followerCount}</p>
            <p className="text-zinc-400">followers</p>
          </button>
          <button
            onClick={() => showList('following')}
            className="text-center hover:opacity-70 transition-opacity"
          >
            <p className="font-semibold text-zinc-900 dark:text-white">{followingCount}</p>
            <p className="text-zinc-400">following</p>
          </button>
        </div>
      )}

      {(viewMode === 'followers' || viewMode === 'following') && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setViewMode('stats')}
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors"
            >
              ← Back
            </button>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
              {viewMode === 'followers' ? 'Followers' : 'Following'}
            </h3>
          </div>

          {loading ? (
            <p className="py-4 text-sm text-zinc-400 text-center">Loading…</p>
          ) : users.length === 0 ? (
            <p className="py-4 text-sm text-zinc-400 text-center">
              {viewMode === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
            </p>
          ) : (
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
          )}
        </div>
      )}
    </div>
  );
}