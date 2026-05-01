'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { LoadingPage, Button, Card, Input } from '@/components/UI';
import { createClient } from '@/lib/supabase/client';
import { useRequireAuth, useProfile } from '@/lib/hooks';
import { useRouter } from 'next/navigation';

export default function EditProfilePage() {
  const { isReady, session } = useRequireAuth();
  const { profile, loading: profileLoading } = useProfile();
  const router = useRouter();
  const supabase = createClient();

  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleProfileLoaded = () => {
    if (profile && !username) {
      setUsername(profile.username || '');
      setBio(profile.bio || '');
    }
  };

  if (!isReady || profileLoading) {
    handleProfileLoaded();
    return <LoadingPage />;
  }

  if (profile && !username) {
    handleProfileLoaded();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { error: err } = await supabase
        .from('profiles')
        .update({
          username: username.trim(),
          bio: bio.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', session?.user.id);

      if (err) {
        setError(err.message);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/profile');
      }, 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Header />

      <main className="max-w-2xl mx-auto px-6 py-12">
        <Link href="/profile" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white mb-6 inline-block">
          ← Back to profile
        </Link>

        <Card>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-8">Edit profile</h1>

          <form onSubmit={handleSave} className="flex flex-col gap-6">
            <Input
              label="Username"
              placeholder="your_username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              error={error && username === '' ? 'Username is required' : undefined}
            />

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-900 dark:text-white">Bio</label>
              <textarea
                placeholder="Tell us about yourself..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={256}
                rows={4}
                className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
              />
              <span className="text-xs text-zinc-600 dark:text-zinc-400">{bio.length}/256</span>
            </div>

            {error && <div className="text-red-600 text-sm">{error}</div>}
            {success && <div className="text-green-600 text-sm">✓ Profile updated!</div>}

            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save changes'}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
