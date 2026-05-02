'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { LoadingPage, Button, Card, Avatar } from '@/components/UI';
import { createClient } from '@/lib/supabase/client';
import { useRequireAuth } from '@/lib/hooks';

type User = {
  id: string;
  username: string;
  email: string;
  bio?: string;
  following?: boolean;
};

type FollowRecord = {
  follower_id: string;
  profiles: { id: string; username: string; email: string; bio?: string }[] | null;
};

type FollowingRecord = {
  following_id: string;
  profiles: { id: string; username: string; email: string; bio?: string }[] | null;
};

export default function FriendsPage() {
  const { isReady, session } = useRequireAuth();
  const supabase = createClient();

  const [tab, setTab] = useState<'followers' | 'following'>('followers');
  const [followers, setFollowers] = useState<User[]>([]);
  const [following, setFollowing] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  async function loadFollowers() {
    try {
      const { data, error } = await supabase
        .from('follows')
        .select('follower_id, profiles(id, username, email, bio)')
        .eq('following_id', session?.user.id);

      if (!error && data) {
        setFollowers(
          (data as unknown as FollowRecord[])
            .map((f) => ({
              id: f.profiles?.[0]?.id ?? '',
              username: f.profiles?.[0]?.username ?? '',
              email: f.profiles?.[0]?.email ?? '',
              bio: f.profiles?.[0]?.bio,
            }))
            .filter((u) => u.id)
        );
      }
    } catch (e) {
      console.error('Failed to load followers:', e);
    } finally {
      setLoading(false);
    }
  }

  async function loadFollowing() {
    try {
      const { data, error } = await supabase
        .from('follows')
        .select('following_id, profiles(id, username, email, bio)')
        .eq('follower_id', session?.user.id);

      if (!error && data) {
        setFollowing(
          (data as unknown as FollowingRecord[])
            .map((f) => ({
              id: f.profiles?.[0]?.id ?? '',
              username: f.profiles?.[0]?.username ?? '',
              email: f.profiles?.[0]?.email ?? '',
              bio: f.profiles?.[0]?.bio,
            }))
            .filter((u) => u.id)
        );
      }
    } catch (e) {
      console.error('Failed to load following:', e);
    }
  }

  async function handleUnfollow(userId: string) {
    try {
      await supabase.functions.invoke('follow', {
        body: { action: 'unfollow', user_id: userId },
      });
      loadFollowing();
    } catch (e) {
      console.error('Failed to unfollow:', e);
    }
  }

  useEffect(() => {
    if (isReady) {
      loadFollowers();
      loadFollowing();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  if (!isReady) return <LoadingPage />;

  const currentList = tab === 'followers' ? followers : following;
  const filteredList = currentList.filter(
    (user) =>
      user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">Friends</h1>
          <p className="text-zinc-600 dark:text-zinc-400">Connect with other Roam users</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setTab('followers')}
            className={`px-4 py-3 font-semibold border-b-2 transition-colors ${
              tab === 'followers'
                ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
                : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            👤 Followers ({followers.length})
          </button>
          <button
            onClick={() => setTab('following')}
            className={`px-4 py-3 font-semibold border-b-2 transition-colors ${
              tab === 'following'
                ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white'
                : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            ⭐ Following ({following.length})
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full mb-8 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
        />

        {/* Users list */}
        {loading ? (
          <LoadingPage />
        ) : filteredList.length === 0 ? (
          <Card className="text-center py-12">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
              {searchQuery ? 'No users found' : `No ${tab} yet`}
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              {searchQuery ? 'Try a different search' : `Start ${tab === 'followers' ? 'following' : 'connected'} with others!`}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredList.map((user) => (
              <Card key={user.id} className="flex items-center justify-between">
                <Link href={`/u/${user.username}`} className="flex items-center gap-4 flex-1 hover:opacity-70">
                  <Avatar initial={user.email?.[0] || '?'} />
                  <div className="flex-1">
                    <h3 className="font-semibold text-zinc-900 dark:text-white">{user.username || user.email}</h3>
                    {user.bio && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">{user.bio}</p>
                    )}
                  </div>
                </Link>

                {tab === 'following' && (
                  <Button
                    variant="secondary"
                    onClick={() => handleUnfollow(user.id)}
                    className="text-sm px-3 py-1"
                  >
                    Unfollow
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
