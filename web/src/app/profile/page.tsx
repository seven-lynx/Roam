'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { LoadingPage, Button, Card, Avatar, Input, Spinner } from '@/components/UI';
import { createClient } from '@/lib/supabase/client';
import { useRequireAuth, useProfile } from '@/lib/hooks';

type Category = { id: string; label: string; emoji: string };

const FALLBACK_CATEGORIES: Category[] = [
  { id: "c1000000-0000-0000-0000-000000000001", label: "Science & Nature", emoji: "🔬" },
  { id: "c1000000-0000-0000-0000-000000000002", label: "Technology", emoji: "💻" },
  { id: "c1000000-0000-0000-0000-000000000003", label: "Arts & Culture", emoji: "🎨" },
  { id: "c1000000-0000-0000-0000-000000000004", label: "History & Ideas", emoji: "📜" },
  { id: "c1000000-0000-0000-0000-000000000005", label: "Games & Hobbies", emoji: "🎮" },
  { id: "c1000000-0000-0000-0000-000000000006", label: "Weird & Wonderful", emoji: "🌀" },
  { id: "c1000000-0000-0000-0000-000000000007", label: "People & Places", emoji: "🌍" },
  { id: "c1000000-0000-0000-0000-000000000008", label: "Mind & Body", emoji: "🧠" },
];

export default function ProfilePage() {
  const { isReady, session } = useRequireAuth();
  const { profile, loading: profileLoading } = useProfile();
  const supabase = createClient();

  const [allCategories, setAllCategories] = useState<Category[]>(FALLBACK_CATEGORIES);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isReady) {
      loadCategories();
      loadStats();
    }
  }, [isReady]);

  useEffect(() => {
    if (!profileLoading && profile) {
      loadUserCategories();
    }
  }, [profile, profileLoading]);

  async function loadCategories() {
    try {
      const { data } = await supabase
        .from('categories')
        .select('id, name, icon, sort_order')
        .order('sort_order');
      if (data && data.length > 0) {
        setAllCategories(data.map((c) => ({ id: c.id, label: c.name, emoji: c.icon })));
      }
    } catch (e) {
      console.error('Failed to load categories:', e);
    }
  }

  async function loadUserCategories() {
    try {
      const { data } = await supabase
        .from('user_categories')
        .select('category_id')
        .eq('user_id', session?.user.id);
      setSelectedCategories(new Set(data?.map(d => d.category_id) || []));
    } catch (e) {
      console.error('Failed to load user categories:', e);
    }
  }

  async function loadStats() {
    try {
      const { data, error } = await supabase.functions.invoke('profile');
      if (data && !error) {
        setFollowerCount(data.follower_count || 0);
        setFollowingCount(data.following_count || 0);
      }
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
  }

  async function handleSaveCategories() {
    setLoading(true);
    try {
      // Delete old categories
      await supabase
        .from('user_categories')
        .delete()
        .eq('user_id', session?.user.id);

      // Insert new categories
      if (selectedCategories.size > 0) {
        await supabase.from('user_categories').insert(
          Array.from(selectedCategories).map((categoryId) => ({
            user_id: session?.user.id,
            category_id: categoryId,
          }))
        );
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('Failed to save categories:', e);
    } finally {
      setLoading(false);
    }
  }

  if (!isReady || profileLoading) return <LoadingPage />;

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Profile header */}
        <div className="mb-12">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-6">
              <Avatar initial={session?.user.email?.[0] || '?'} size="lg" />
              <div>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">{profile?.username || 'Your Profile'}</h1>
                <p className="text-zinc-600 dark:text-zinc-400">{session?.user.email}</p>
              </div>
            </div>
            <Link href="/profile/edit">
              <Button variant="secondary">Edit profile</Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <div className="text-center">
                <div className="text-2xl font-bold text-zinc-900 dark:text-white">{followerCount}</div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">Followers</div>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="text-2xl font-bold text-zinc-900 dark:text-white">{followingCount}</div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">Following</div>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <div className="text-2xl font-bold text-zinc-900 dark:text-white">0</div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">Collections</div>
              </div>
            </Card>
          </div>
        </div>

        {/* Bio */}
        {profile?.bio && (
          <Card className="mb-12">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">About</h2>
            <p className="text-zinc-600 dark:text-zinc-400">{profile.bio}</p>
          </Card>
        )}

        {/* Categories */}
        <Card className="mb-8">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-6">Your interests</h2>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            {allCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => {
                  const newSelected = new Set(selectedCategories);
                  if (newSelected.has(category.id)) {
                    newSelected.delete(category.id);
                  } else {
                    newSelected.add(category.id);
                  }
                  setSelectedCategories(newSelected);
                }}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  selectedCategories.has(category.id)
                    ? 'border-zinc-900 dark:border-white bg-zinc-100 dark:bg-zinc-800'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className="text-2xl mb-1">{category.emoji}</div>
                <div className="font-semibold text-zinc-900 dark:text-white text-sm">{category.label}</div>
              </button>
            ))}
          </div>

          <div className="flex gap-4">
            <Button onClick={handleSaveCategories} disabled={loading}>
              {loading ? <Spinner /> : 'Save interests'}
            </Button>
            {saved && <div className="text-green-600 font-semibold">✓ Saved!</div>}
          </div>
        </Card>

        {/* Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/collections">
            <Card className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 cursor-pointer h-full">
              <h3 className="font-semibold text-zinc-900 dark:text-white">📚 My Collections</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Manage your saved collections</p>
            </Card>
          </Link>
          <Link href="/friends">
            <Card className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 cursor-pointer h-full">
              <h3 className="font-semibold text-zinc-900 dark:text-white">👥 Friends</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">View followers and following</p>
            </Card>
          </Link>
        </div>
      </main>
    </div>
  );
}
