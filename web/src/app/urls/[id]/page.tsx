'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { LoadingPage, Card, Button } from '@/components/UI';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/lib/hooks';

type UrlDetail = {
  id: string;
  url: string;
  title?: string;
  description?: string;
  og_image_url?: string;
  category_id?: string;
  likes: number;
  dislikes: number;
};

export default function UrlPage() {
  const params = useParams();
  const urlId = params.id as string;
  const { session } = useSession();
  const supabase = createClient();

  const [url, setUrl] = useState<UrlDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [userVote, setUserVote] = useState<'like' | 'dislike' | null>(null);

  useEffect(() => {
    loadUrl();
  }, [urlId]);

  async function loadUrl() {
    try {
      const { data } = await supabase
        .from('urls')
        .select('id, url, title, description, og_image_url, category_id')
        .eq('id', urlId)
        .single();

      if (data) {
        // Get vote counts
        const { data: ratings } = await supabase
          .from('ratings')
          .select('like')
          .eq('url_id', urlId);

        const likes = ratings?.filter((r) => r.like === true).length || 0;
        const dislikes = ratings?.filter((r) => r.like === false).length || 0;

        setUrl({
          ...data,
          likes,
          dislikes,
        });

        // Check user's vote
        if (session?.user.id) {
          const { data: userVoteData } = await supabase
            .from('ratings')
            .select('like')
            .eq('url_id', urlId)
            .eq('user_id', session.user.id)
            .single();

          if (userVoteData) {
            setUserVote(userVoteData.like ? 'like' : 'dislike');
          }
        }
      }
    } catch (e) {
      console.error('Failed to load URL:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleVote(like: boolean) {
    if (!session?.user.id || !url) return;

    try {
      // Upsert rating
      await supabase.from('ratings').upsert({
        user_id: session.user.id,
        url_id: url.id,
        like,
      });

      setUserVote(like ? 'like' : 'dislike');
      loadUrl();
    } catch (e) {
      console.error('Failed to save vote:', e);
    }
  }

  if (loading) return <LoadingPage />;

  if (!url) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950">
        <Header />
        <main className="max-w-4xl mx-auto px-6 py-12 text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">URL not found</h1>
          <Link href="/dashboard">
            <Button>Back to discover</Button>
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Back link */}
        <Link href="/dashboard" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white mb-6 inline-block">
          ← Back to discover
        </Link>

        {/* URL Preview */}
        <Card>
          {url.og_image_url && (
            <img
              src={url.og_image_url}
              alt={url.title || url.url}
              className="w-full h-64 object-cover rounded-lg mb-6"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}

          <div className="flex flex-col gap-4">
            <h1 className="text-4xl font-bold text-zinc-900 dark:text-white">
              {url.title || url.url}
            </h1>

            <a
              href={url.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline break-all"
            >
              {url.url}
            </a>

            {url.description && (
              <p className="text-lg text-zinc-600 dark:text-zinc-400">{url.description}</p>
            )}

            {/* Domain */}
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              {new URL(url.url).hostname}
            </div>

            {/* Stats */}
            <div className="flex gap-8 py-6 border-y border-zinc-200 dark:border-zinc-800">
              <div>
                <div className="text-2xl font-bold text-zinc-900 dark:text-white">{url.likes}</div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">👍 Likes</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-zinc-900 dark:text-white">{url.dislikes}</div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">👎 Dislikes</div>
              </div>
            </div>

            {/* Actions */}
            {session && (
              <div className="flex gap-4">
                <Button
                  variant={userVote === 'like' ? 'primary' : 'secondary'}
                  onClick={() => handleVote(true)}
                >
                  👍 Like
                </Button>
                <Button
                  variant={userVote === 'dislike' ? 'danger' : 'secondary'}
                  onClick={() => handleVote(false)}
                >
                  👎 Pass
                </Button>
              </div>
            )}

            {!session && (
              <p className="text-zinc-600 dark:text-zinc-400 text-sm">
                <Link href="/join" className="text-blue-600 hover:underline">
                  Sign in
                </Link>
                {' '}to rate this URL.
              </p>
            )}

            {/* Visit button */}
            <a
              href={url.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <Button>Visit →</Button>
            </a>
          </div>
        </Card>
      </main>
    </div>
  );
}
