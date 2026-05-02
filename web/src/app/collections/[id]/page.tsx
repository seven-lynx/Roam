'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { LoadingPage, Button, Card } from '@/components/UI';
import { createClient } from '@/lib/supabase/client';
import { useSession, useRequireAuth } from '@/lib/hooks';

type CollectionItem = {
  id: string;
  url: string;
  title: string;
  description?: string;
  og_image_url?: string;
};

type CollectionDetail = {
  id: string;
  name: string;
  description?: string;
  public: boolean;
  user_id: string;
  items: CollectionItem[];
};

export default function CollectionDetailPage() {
  const params = useParams();
  const collectionId = params.id as string;
  const { isReady } = useRequireAuth();
  const { session } = useSession();
  const supabase = createClient();

  const [collection, setCollection] = useState<CollectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  async function loadCollection() {
    try {
      const { data: col, error: err } = await supabase
        .from('collections')
        .select('id, name, description, public, user_id')
        .eq('id', collectionId)
        .single();

      if (err) {
        setError('Collection not found');
        return;
      }

      // Check if public or owned by user
      if (!col.public && col.user_id !== session?.user.id) {
        setError('You don\'t have access to this collection');
        return;
      }

      // Load items
      const { data: items } = await supabase
        .from('collection_items')
        .select('id, urls(id, url, title, description, og_image_url)')
        .eq('collection_id', collectionId)
        .order('created_at', { ascending: false });

      setCollection({
        ...col,
        items: items?.map((item: { id: string; urls: Omit<CollectionItem, 'id'> | null }) => ({
          id: item.id,
          ...item.urls,
        })) || [],
      });

      setIsOwner(col.user_id === session?.user.id);
    } catch (e) {
      console.error('Failed to load collection:', e);
      setError('Failed to load collection');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveItem(itemId: string) {
    try {
      await supabase.from('collection_items').delete().eq('id', itemId);
      loadCollection();
    } catch (e) {
      console.error('Failed to remove item:', e);
    }
  }

  useEffect(() => {
    if (isReady) {
      loadCollection();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, collectionId]);

  if (!isReady || loading) return <LoadingPage />;

  if (error || !collection) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950">
        <Header />
        <main className="max-w-4xl mx-auto px-6 py-12 text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">{error || 'Collection not found'}</h1>
          <Link href="/collections">
            <Button>Back to collections</Button>
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <Link href="/collections" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white mb-4 inline-block">
            ← Collections
          </Link>
          <div className="flex justify-between items-start gap-6">
            <div>
              <h1 className="text-4xl font-bold text-zinc-900 dark:text-white">{collection.name}</h1>
              {collection.description && (
                <p className="text-zinc-600 dark:text-zinc-400 mt-2">{collection.description}</p>
              )}
              <div className="text-sm text-zinc-600 dark:text-zinc-400 mt-4">
                {collection.items.length} items · {collection.public ? '🌐 Public' : '🔒 Private'}
              </div>
            </div>
            {isOwner && (
              <Link href={`/collections/${collection.id}/edit`}>
                <Button variant="secondary">Edit</Button>
              </Link>
            )}
          </div>
        </div>

        {/* Items */}
        {collection.items.length === 0 ? (
          <Card className="text-center py-12">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">No items yet</h3>
            <p className="text-zinc-600 dark:text-zinc-400">This collection is empty.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {collection.items.map((item) => (
              <Card key={item.id} className="flex gap-6 items-start">
                {item.og_image_url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0"
                  >
                    <Image
                      src={item.og_image_url as string}
                      alt={item.title ?? ''}
                      width={96}
                      height={96}
                      unoptimized
                      className="w-24 h-24 object-cover rounded-lg hover:opacity-80 transition-opacity"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </a>
                )}
                <div className="flex-1 min-w-0">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-70 transition-opacity"
                  >
                    <h3 className="font-semibold text-zinc-900 dark:text-white text-lg line-clamp-2">
                      {item.title || 'Untitled'}
                    </h3>
                  </a>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                    {new URL(item.url).hostname}
                  </p>
                  {item.description && (
                    <p className="text-zinc-600 dark:text-zinc-400 text-sm line-clamp-2">{item.description}</p>
                  )}
                </div>
                {isOwner && (
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="flex-shrink-0 text-red-600 hover:text-red-700 font-semibold text-sm"
                  >
                    Remove
                  </button>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
