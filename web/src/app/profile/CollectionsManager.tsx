'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

function makeSlug(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

interface CollectionItem {
  id: string;
  added_at: string;
  url: { id: string; title: string | null; original_url: string } | null;
}

export interface CollectionRow {
  id: string;
  name: string;
  slug: string;
  is_public: boolean;
  item_count: number;
}

interface Props {
  userId: string;
  initialCollections: CollectionRow[];
}

export function CollectionsManager({ userId, initialCollections }: Props) {
  const supabase = createClient();

  const [collections, setCollections] = useState<CollectionRow[]>(initialCollections);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<CollectionItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function loadItems(collectionId: string) {
    setLoadingItems(true);
    const { data } = await supabase
      .from('collection_items')
      .select('id, added_at, urls(id, title, original_url)')
      .eq('collection_id', collectionId)
      .order('added_at', { ascending: false });
    // PostgREST returns the many-to-one `urls` embed as an object (or null), not an array.
    // Defensively handle both shapes in case a future schema change makes it many-to-many.
    type RawUrl = { id: string; title: string | null; original_url: string };
    setExpandedItems(
      (data ?? []).map((item: { id: string; added_at: string; urls: RawUrl | RawUrl[] | null }) => ({
        id: item.id,
        added_at: item.added_at,
        url: Array.isArray(item.urls) ? item.urls[0] ?? null : item.urls,
      }))
    );
    setLoadingItems(false);
  }

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedItems([]);
    } else {
      setExpandedId(id);
      void loadItems(id);
    }
  }

  async function createCollection() {
    const name = newName.trim();
    if (!name) {
      setCreateError('Collection name is required');
      return;
    }
    if (name.length < 2) {
      setCreateError('Collection name must be at least 2 characters.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    const slug = makeSlug(name);
    const { data, error: err } = await supabase
      .from('collections')
      .insert({ name, slug, user_id: userId, is_public: false })
      .select('id, name, slug, is_public')
      .single();
    setCreating(false);
    if (err) {
      setCreateError(
        err.message.includes('20 collections') || err.message.includes('at most 20')
          ? 'You can have at most 20 collections.'
          : err.message
      );
      return;
    }
    setCollections(prev => [{ ...data, item_count: 0 }, ...prev]);
    setNewName('');
  }

  async function deleteCollection(id: string) {
    if (!confirm('Delete this collection and all its items?')) return;
    const { error: err } = await supabase
      .from('collections')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (err) { setError(err.message); return; }
    setCollections(prev => prev.filter(c => c.id !== id));
    if (expandedId === id) { setExpandedId(null); setExpandedItems([]); }
  }

  async function togglePublic(col: CollectionRow) {
    const { error: err } = await supabase
      .from('collections')
      .update({ is_public: !col.is_public })
      .eq('id', col.id)
      .eq('user_id', userId);
    if (err) { setError(err.message); return; }
    setCollections(prev =>
      prev.map(c => c.id === col.id ? { ...c, is_public: !c.is_public } : c)
    );
  }

  async function removeItem(collectionId: string, itemId: string) {
    const { error: err } = await supabase
      .from('collection_items')
      .delete()
      .eq('id', itemId);
    if (err) { setError(err.message); return; }
    setExpandedItems(prev => prev.filter(i => i.id !== itemId));
    setCollections(prev =>
      prev.map(c => c.id === collectionId ? { ...c, item_count: Math.max(0, c.item_count - 1) } : c)
    );
  }

  function copyShareLink(col: CollectionRow) {
    void navigator.clipboard.writeText(`https://roamtheweb.app/collections/${col.slug}`);
    setCopied(col.id);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <section>
      <h2 className="text-base font-semibold text-zinc-900 dark:text-white mb-3">Collections</h2>
      <p className="text-xs text-zinc-400 mb-4">Max 20 collections · 200 items each. Make a collection public to share it.</p>

      {/* Create new */}
      <div className="flex gap-2 mb-4">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void createCollection()}
          placeholder="New collection name…"
          maxLength={80}
          className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
        />
        <button
          onClick={() => void createCollection()}
          disabled={creating || !newName.trim()}
          className="shrink-0 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {creating ? 'Creating…' : 'Create'}
        </button>
      </div>
      {createError && <p className="text-xs text-red-600 mb-3">{createError}</p>}

      {/* List */}
      {collections.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No collections yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {collections.map(col => (
            <li key={col.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              {/* Header row */}
              <div className="flex items-center gap-2 px-4 py-3">
                <button
                  onClick={() => toggleExpand(col.id)}
                  className="flex-1 text-left flex items-center gap-2 min-w-0"
                >
                  <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">{col.name}</span>
                  <span className="shrink-0 text-xs text-zinc-400">{col.item_count}</span>
                  <span className="shrink-0 text-xs text-zinc-400">{expandedId === col.id ? '▲' : '▼'}</span>
                </button>

                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
                  col.is_public
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                }`}>
                  {col.is_public ? 'Public' : 'Private'}
                </span>

                {col.is_public && (
                  <button
                    onClick={() => copyShareLink(col)}
                    title="Copy share link"
                    className="shrink-0 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                  >
                    {copied === col.id ? '✓' : '🔗'}
                  </button>
                )}

                <button
                  onClick={() => void togglePublic(col)}
                  title={col.is_public ? 'Make private' : 'Make public'}
                  className="shrink-0 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                >
                  {col.is_public ? 'Make private' : 'Share'}
                </button>

                <button
                  onClick={() => void deleteCollection(col.id)}
                  title="Delete collection"
                  className="shrink-0 text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>

              {/* Expanded items */}
              {expandedId === col.id && (
                <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                  {loadingItems ? (
                    <p className="px-4 py-3 text-xs text-zinc-400">Loading…</p>
                  ) : expandedItems.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-zinc-400">No items yet. Add pages from the browser extension.</p>
                  ) : (
                    <ul>
                      {expandedItems.map(item => {
                        const u = item.url;
                        if (!u) return null;
                        const domain = (() => {
                          try { return new URL(u.original_url).hostname.replace(/^www\./, ''); }
                          catch { return u.original_url; }
                        })();
                        return (
                          <li
                            key={item.id}
                            className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 last:border-0"
                          >
                            <a
                              href={u.original_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 min-w-0"
                            >
                              <p className="text-xs font-medium text-zinc-900 dark:text-white truncate hover:underline">
                                {u.title || u.original_url}
                              </p>
                              <p className="text-xs text-zinc-400 truncate">{domain}</p>
                            </a>
                            <button
                              onClick={() => void removeItem(col.id, item.id)}
                              title="Remove from collection"
                              aria-label="Remove"
                              className="shrink-0 text-xs text-zinc-400 hover:text-red-500 transition-colors"
                            >
                              ✕
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </section>
  );
}
