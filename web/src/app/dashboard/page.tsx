'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { LoadingPage, Button, Card, Spinner, Toast } from '@/components/UI';
import { createClient } from '@/lib/supabase/client';
import { useRequireAuth, useUserCategories } from '@/lib/hooks';
import Link from 'next/link';

type DiscoveryURL = {
  id: string;
  url: string;
  title: string;
  description: string;
  og_image_url?: string;
  category_id?: string;
};

export default function DashboardPage() {
  const { isReady } = useRequireAuth();
  const { categories: selectedCategories } = useUserCategories();
  const supabase = createClient();

  const [currentUrl, setCurrentUrl] = useState<DiscoveryURL | null>(null);
  const [loading, setLoading] = useState(false);
  const [voted, setVoted] = useState<'up' | 'down' | null>(null);
  const [savedToCollection, setSavedToCollection] = useState(false);
  const [showSavePanel, setShowSavePanel] = useState(false);
  const [userCollections, setUserCollections] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isReady) {
      fetchNextUrl();
      loadCollections();
    }
  }, [isReady]);

  async function loadCollections() {
    try {
      const { data } = await supabase
        .rpc('get_user_collections');
      setUserCollections((data as any) || []);
    } catch (e) {
      console.error('Failed to load collections:', e);
    }
  }

  async function fetchNextUrl() {
    if (loading) return;
    setLoading(true);
    setVoted(null);
    setSavedToCollection(false);

    try {
      const { data, error } = await supabase.functions.invoke('roam', {
        body: {
          category_filter: selectedCategories.length > 0 ? selectedCategories : undefined,
        },
      });

      if (error) {
        console.error('Roam error:', error);
        return;
      }

      setCurrentUrl(data);
    } catch (e) {
      console.error('Failed to fetch URL:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleVote(vote: 1 | -1) {
    if (!currentUrl) return;

    try {
      setError(null);
      await supabase.functions.invoke('rate', {
        body: { url_id: currentUrl.id, vote },
      });
      setVoted(vote === 1 ? 'up' : 'down');

      // Auto-advance after 1 second
      setTimeout(() => fetchNextUrl(), 1000);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to record vote';
      setError(message);
      console.error('Failed to record vote:', e);
    }
  }

  async function handleSaveToCollection(collectionId: string) {
    if (!currentUrl) return;

    try {
      setError(null);
      await supabase.functions.invoke('collection', {
        body: {
          action: 'add_item',
          collection_id: collectionId,
          url_id: currentUrl.id,
        },
      });
      setSavedToCollection(true);
      setShowSavePanel(false);
      setTimeout(() => setSavedToCollection(false), 2000);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save to collection';
      setError(message);
      console.error('Failed to save to collection:', e);
    }
  }

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (!isReady) return <LoadingPage />;

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-2">Discover</h1>
          <p className="text-zinc-600 dark:text-zinc-400">Click the button below to explore a random corner of the web.</p>
        </div>

        {/* Discovery card */}
        <Card className="mb-8">
          {currentUrl ? (
            <div className="flex flex-col gap-6">
              {/* Image */}
              {currentUrl.og_image_url && (
                <a
                  href={currentUrl.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative w-full h-64 bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
                >
                  <img
                    src={currentUrl.og_image_url}
                    alt={currentUrl.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </a>
              )}

              {/* Content */}
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
                    <a
                      href={currentUrl.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:opacity-70 transition-opacity"
                    >
                      {currentUrl.title || 'Untitled'}
                    </a>
                  </h2>
                  <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-2">
                    {new URL(currentUrl.url).hostname}
                  </p>
                  {currentUrl.description && (
                    <p className="text-zinc-700 dark:text-zinc-300">{currentUrl.description}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-4 items-center pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <button
                    onClick={() => handleVote(1)}
                    disabled={voted !== null || loading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    👍 {voted === 'up' ? 'Liked!' : 'Like'}
                  </button>
                  <button
                    onClick={() => handleVote(-1)}
                    disabled={voted !== null || loading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    👎 {voted === 'down' ? 'Passed!' : 'Pass'}
                  </button>
                  <button
                    onClick={() => setShowSavePanel(true)}
                    disabled={voted === null || loading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    💾 Save
                  </button>
                  <a
                    href={currentUrl.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                  >
                    🔗 Visit
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">No more URLs to discover!</p>
              <Button onClick={fetchNextUrl}>Try again</Button>
            </div>
          )}
        </Card>

        {/* Next button */}
        {currentUrl && (
          <div className="text-center">
            <Button onClick={fetchNextUrl} disabled={loading || voted === null}>
              {loading ? <Spinner /> : voted ? 'Next 🚀' : 'Vote first 👇'}
            </Button>
          </div>
        )}

        {/* Save panel */}
        {showSavePanel && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
            <Card className="w-full max-w-md">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">Save to collection</h3>
              {userCollections.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-zinc-600 dark:text-zinc-400 mb-4">You haven't created any collections yet.</p>
                  <Link href="/collections?new=true" className="text-blue-600 hover:underline">
                    Create a collection →
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                  {userCollections.map((collection) => (
                    <button
                      key={collection.id}
                      onClick={() => handleSaveToCollection(collection.id)}
                      className="text-left px-4 py-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-900 dark:text-white font-medium"
                    >
                      {collection.name}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowSavePanel(false)}
                className="w-full mt-4 px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
              >
                Close
              </button>
            </Card>
          </div>
        )}

        {/* Success message */}
        {savedToCollection && (
          <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg">
            ✅ Saved to collection!
          </div>
        )}

        {/* Error toast */}
        {error && (
          <Toast
            message={error}
            variant="error"
            onDismiss={() => setError(null)}
          />
        )}
      </main>
    </div>
  );
}
