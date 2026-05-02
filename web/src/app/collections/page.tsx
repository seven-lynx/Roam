'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { LoadingPage, Button, Card, Input, Spinner } from '@/components/UI';
import { createClient } from '@/lib/supabase/client';
import { useRequireAuth, useSession } from '@/lib/hooks';

type Collection = {
  id: string;
  name: string;
  description?: string;
  public: boolean;
  item_count: number;
};

export default function CollectionsPage() {
  const { isReady } = useRequireAuth();
  const { session } = useSession();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(searchParams.get('new') === 'true');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPublic, setNewPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadCollections() {
    try {
      if (!session?.user.id) {
        setLoading(false);
        return;
      }

      const { data, error: err } = await supabase
        .from('collections')
        .select('id, name, description, public')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (err) throw err;

      // Load item counts for each collection
      const collectionsWithCounts = await Promise.all(
        (data || []).map(async (col) => {
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
      console.error('Failed to load collections:', e);
      setError('Failed to load collections');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isReady) {
      loadCollections();
    }
  }, [isReady]);

  async function handleCreateCollection(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const { data, error: err } = await supabase
        .from('collections')
        .insert([{
          name: newName,
          description: newDescription,
          public: newPublic,
        }])
        .select()
        .single();

      if (err) throw err;

      setCollections([data, ...collections]);
      setNewName('');
      setNewDescription('');
      setNewPublic(false);
      setShowNewForm(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to create collection';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCollection(id: string) {
    if (!confirm('Delete this collection?')) return;

    try {
      await supabase.from('collections').delete().eq('id', id);
      setCollections(collections.filter(c => c.id !== id));
    } catch (e) {
      console.error('Failed to delete collection:', e);
      setError('Failed to delete collection');
    }
  }

  void handleDeleteCollection; // defined for future use

  if (!isReady) return <LoadingPage />;

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex justify-between items-start mb-12">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">Collections</h1>
            <p className="text-zinc-600 dark:text-zinc-400">Save and organize interesting pages</p>
          </div>
          {!showNewForm && (
            <Button onClick={() => setShowNewForm(true)}>Create collection</Button>
          )}
        </div>

        {/* New collection form */}
        {showNewForm && (
          <Card className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-6">New collection</h2>
            <form onSubmit={handleCreateCollection} className="flex flex-col gap-4">
              <Input
                label="Name"
                placeholder="e.g., Cool GitHub Repos"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                error={error && newName === '' ? 'Name is required' : undefined}
              />
              <Input
                label="Description (optional)"
                placeholder="What's this collection about?"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newPublic}
                  onChange={(e) => setNewPublic(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm font-medium text-zinc-900 dark:text-white">Make this public</span>
              </label>
              {error && <div className="text-red-600 text-sm">{error}</div>}
              <div className="flex gap-4">
                <Button type="submit" disabled={saving || !newName.trim()}>
                  {saving ? <Spinner /> : 'Create'}
                </Button>
                <Button variant="secondary" onClick={() => setShowNewForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Collections grid */}
        {loading ? (
          <LoadingPage />
        ) : collections.length === 0 ? (
          <Card className="text-center py-12">
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">No collections yet</h3>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">Create one to save interesting pages</p>
            <Button onClick={() => setShowNewForm(true)}>Create your first collection</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {collections.map((collection) => (
              <Link key={collection.id} href={`/collections/${collection.id}`}>
                <Card className="hover:shadow-lg transition-shadow h-full cursor-pointer">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{collection.name}</h3>
                    <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-1 rounded">
                      {collection.public ? '🌐 Public' : '🔒 Private'}
                    </span>
                  </div>
                  {collection.description && (
                    <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">{collection.description}</p>
                  )}
                  <div className="flex justify-between items-center pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">{collection.item_count} items</span>
                    <span className="text-zinc-400">→</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
