'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

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
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string) {
    const { error: err } = await supabase
      .from('saved_urls')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (err) { setError(err.message); return; }
    setItems(prev => prev.filter(i => i.id !== id));
  }

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Saved for later</h2>
        <p className="text-xs text-zinc-400">Expires after 30 days · max 50</p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Nothing saved yet. Use the browser extension to bookmark pages while browsing.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map(item => {
            const domain = (() => {
              try { return new URL(item.url).hostname.replace(/^www\./, ''); }
              catch { return item.url; }
            })();
            const daysAgo = Math.floor(
              (Date.now() - new Date(item.saved_at).getTime()) / (1000 * 60 * 60 * 24)
            );
            const expiresIn = 30 - daysAgo;
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3"
              >
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
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  );
}
