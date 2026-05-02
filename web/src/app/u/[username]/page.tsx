'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { LoadingPage, Button, Card, Avatar } from '@/components/UI';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/lib/hooks';

type UserProfile = {
  id: string;
  username: string;
  email: string;
  bio?: string;
  follower_count: number;
  following_count: number;
};

type UserCollection = {
  id: string;
  name: string;
  description?: string;
  public: boolean;
  item_count: number;
};

export default function UserProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const { session } = useSession();
  const supabase = createClient();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [collections, setCollections] = useState<UserCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadProfile() {
    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .select('id, username, email, bio')
        .eq('username', username)
        .single();

      if (err) {
        setError('User not found');
        return;
      }

      // Get stats via function
      const { data: stats } = await supabase.functions.invoke('profile', {
        body: { user_id: data.id },
      });

      const profileData = {
        ...data,
        follower_count: stats?.follower_count || 0,
        following_count: stats?.following_count || 0,
      };

      setProfile(profileData);

      // Load public collections
      const { data: cols } = await supabase
        .from('collections')
        .select('id, name, description, public')
        .eq('user_id', data.id)
        .eq('public', true)
        .order('created_at', { ascending: false });

      // Get item counts
      const collectionsWithCounts = await Promise.all(
        (cols || []).map(async (col) => {
          const { count } = await supabase
            .from('collection_items')
            .select('id', { count: 'exact' })
            .eq('collection_id', col.id);
          return {
            ...col,
            item_count: count || 0,
          };
        })
      );

      setCollections(collectionsWithCounts);
    } catch (e) {
      console.error('Failed to load profile:', e);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  async function checkFollowing() {
    if (!profile) return;

    try {
      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', session?.user.id)
        .eq('following_id', profile.id)
        .single();

      setIsFollowing(!!data);
    } catch {
      // User is not following
      setIsFollowing(false);
    }
  }

  async function handleFollow() {
    if (!profile) return;

    try {
      await supabase.functions.invoke('follow', {
        body: { action: isFollowing ? 'unfollow' : 'follow', user_id: profile.id },
      });
      setIsFollowing(!isFollowing);
    } catch (e) {
      console.error('Failed to toggle follow:', e);
    }
  }

  useEffect(() => {
    loadProfile();
  }, [username]);

  useEffect(() => {
    if (profile && session?.user.id) {
      checkFollowing();
    }
  }, [profile, session]);

  if (loading) return <LoadingPage />;

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950">
        <Header />
        <main className="max-w-4xl mx-auto px-6 py-12 text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">User not found</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">The user you&apos;re looking for doesn&apos;t exist or has been removed.</p>
          <Link href="/friends">
            <Button>Back to friends</Button>
          </Link>
        </main>
      </div>
    );
  }

  const isOwnProfile = session?.user.id === profile.id;

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Profile header */}
        <div className="mb-12">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-6">
              <Avatar initial={profile.email?.[0] || '?'} size="lg" />
              <div>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">{profile.username}</h1>
                <p className="text-zinc-600 dark:text-zinc-400">{profile.email}</p>
              </div>
            </div>
            {!isOwnProfile && session && (
              <Button variant={isFollowing ? 'secondary' : 'primary'} onClick={handleFollow}>
                {isFollowing ? 'Following ⭐' : 'Follow'}
              </Button>
            )}
            {isOwnProfile && (
              <Link href="/profile">
                <Button variant="secondary">Edit profile</Button>
              </Link>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <div className="text-center">
                <div className="text-2xl font-bold text-zinc-900 dark:text-white">{profile.follower_count}</div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">Followers</div>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="text-2xl font-bold text-zinc-900 dark:text-white">{profile.following_count}</div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">Following</div>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="text-2xl font-bold text-zinc-900 dark:text-white">{collections.length}</div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">Collections</div>
              </div>
            </Card>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <Card className="mb-12">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">About</h2>
            <p className="text-zinc-600 dark:text-zinc-400">{profile.bio}</p>
          </Card>
        )}

        {/* Collections */}
        {collections.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">Public collections</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {collections.map((collection) => (
                <Link key={collection.id} href={`/collections/${collection.id}`}>
                  <Card className="hover:shadow-lg transition-shadow h-full cursor-pointer">
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">{collection.name}</h3>
                    {collection.description && (
                      <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">{collection.description}</p>
                    )}
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">{collection.item_count} items</div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

