'use client';

import { useState, useMemo, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { CollectionRow } from './CollectionsManager';

export interface SavedUrlRow {
  id: string;
  url: string;
  title: string;
  saved_at: string;
}

interface Props {
  userId: string;
  initialSavedUrls: SavedUrlRow[];
}

export function SavedUrlsManager({ userId, initialSavedUrls }: Props) {
  const supabase = createClient();
  const [items, setItems] = useState<SavedUrlRow[]>(initialSavedUrls);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const nowMs = useMemo(() => new Date().getTime(), []);

  async function remove(id: string) {
    const { error: err } = await supabase
      .from('saved_urls')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (err) { setError(err.message); return; }
    setItems(prev => prev.filter(i => i.id !== id));
    setSelected(s => { const n = new Set(s); n.delete(id); return n; });
  }

  function toggleSelect(id: string) {
    setSelected(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function batchDelete() {
    if (selected.size === 0) return;
    setBatchLoading(true);
    setBatchError(null);
    const ids = [...selected];
    const { error: err } = await supabase
      .from('saved_urls')
      .delete()
      .in('id', ids)
      .eq('user_id', userId);
    setBatchLoading(false);
    if (err) { setBatchError(err.message); return; }
    setItems(prev => prev.filter(i => !selected.has(i.id)));
    setSelected(new Set());
  }

  async function batchAddToCollection(collectionId: string) {
    setBatchLoading(true);
    setBatchError(null);
    const selectedItems = items.filter(i => selected.has(i.id));
    let failed = 0;
    for (const item of selectedItems) {
      const { error: err } = await supabase.functions.invoke('collection', {
        body: { action: 'add_item', collection_id: collectionId, url_id: item.id },
      });
      if (err) failed++;
    }
    setBatchLoading(false);
    setCollectionsOpen(false);
    setSelected(new Set());
    if (failed > 0) {
      setBatchError(`${failed} of ${selectedItems.length} items couldn't be added (may not be in the URL database).`);
    }
  }

  const isSelectionMode = selected.size > 0;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Saved URLs</h2>
        <p className="text-xs text-zinc-400">Expires after 30 days · max 50</p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-3xl mb-3">🔖</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 font-medium">
            No saved pages yet
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            Install the browser extension to bookmark pages while you browse.
          </p>
          <a
            href="https://chromewebstore.google.com/detail/ojgphkdgkefokhjnojkddhalnlbajfpc?utm_source=roam-web"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 text-xs text-blue-600 hover:underline font-medium"
          >
            Get the Chrome extension →
          </a>
        </div>
      ) : (
        <>
          {/* Selection bar */}
          {isSelectionMode && (
            <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{selected.size} selected</span>
              <div className="flex-1" />
              <button
                onClick={() => setCollectionsOpen(true)}
                disabled={batchLoading}
                className="text-xs px-3 py-1.5 rounded-md bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                Add to collection
              </button>
              <button
                onClick={batchDelete}
                disabled={batchLoading}
                className="text-xs px-3 py-1.5 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-50"
              >
                {batchLoading ? '…' : 'Delete'}
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
          {batchError && <p className="mb-2 text-xs text-red-600">{batchError}</p>}

          {/* Collection picker */}
          {collectionsOpen && (
            <CollectionPicker
              onSelect={(id) => void batchAddToCollection(id)}
              onClose={() => setCollectionsOpen(false)}
            />
          )}

          <ul className="flex flex-col gap-2">
            {items.map(item => {
              const domain = (() => {
                try { return new URL(item.url).hostname.replace(/^www\./, ''); }
                catch { return item.url; }
              })();
              const daysAgo = Math.floor(
                (nowMs - new Date(item.saved_at).getTime()) / (1000 * 60 * 60 * 24)
              );
              const expiresIn = 30 - daysAgo;
              return (
                <li
                  key={item.id}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                    selected.has(item.id)
                      ? 'border-zinc-900 dark:border-white bg-zinc-50 dark:bg-zinc-900'
                      : 'border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    className="shrink-0 w-4 h-4 rounded accent-zinc-900 dark:accent-white cursor-pointer"
                  />
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-0"
                  >
                    <p className="text-sm font-medium text-zinc-900 dark:text-white truncate hover:underline">
                      {item.title || item.url}
                    </p>
                    <p className="text-xs text-zinc-400 truncate">
                      {domain}
                      {expiresIn <= 7 && (
                        <span className="ml-2 text-amber-500">expires in {expiresIn}d</span>
                      )}
                    </p>
                  </a>
                  <button
                    onClick={() => void remove(item.id)}
                    aria-label="Remove saved page"
                    title="Remove"
                    className="shrink-0 text-zinc-400 hover:text-red-500 transition-colors text-sm"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  );
}

// ── Inline collection picker ──────────────────────────────────────────────────

function CollectionPicker({ onSelect, onClose }: { onSelect: (id: string) => void; onClose: () => void }) {
  const supabase = createClient();
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await supabase.from('collections').select('id, name, item_count:collection_items(count)').order('name');
      setCollections((res.data ?? []).map((c: { id: string; name: string; item_count: { count: number }[] | number }) => ({
        id: c.id,
        name: c.name,
        slug: '',
        is_public: false,
        item_count: Array.isArray(c.item_count) && c.item_count[0]?.count ? Number(c.item_count[0].count) : 0,
      })));
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mb-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Choose a collection</p>
        <button onClick={onClose} className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">Cancel</button>
      </div>
      {loading ? (
        <p className="text-xs text-zinc-400">Loading…</p>
      ) : collections.length === 0 ? (
        <p className="text-xs text-zinc-400">No collections yet. Create one above.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {collections.map(col => (
            <li key={col.id}>
              <button
                onClick={() => onSelect(col.id)}
                className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {col.name} <span className="text-xs text-zinc-400">({col.item_count})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
