'use client';

import Link from 'next/link';
import { ShareUrlButton } from '@/components/ShareUrlButton';
import type { CollectionItem } from './types';

export function CollectionItemsHeader({
  name,
  itemCount,
  owner,
}: {
  name: string;
  itemCount: number;
  owner: { username: string; display_name: string } | null;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{name}</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {itemCount} website{itemCount !== 1 ? 's' : ''}{owner && (
          <>
            {' · by '}
            <Link
              href={`/u/${owner.username}`}
              className="hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              {owner.display_name || owner.username}
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

export function CollectionItemsList({ items }: { items: CollectionItem[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map(item => {
        const url = item.urls;
        if (!url) return null;
        const domain = (() => {
          try { return new URL(url.original_url).hostname.replace(/^www\./, ''); }
          catch { return url.original_url; }
        })();
        return (
          <li key={item.id} className="flex gap-3 group">
            <a
              href={url.original_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex gap-3 px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
            >
              {url.og_image_url && (
                // eslint-disable-next-line @next/next/no-img-element -- external OG images cannot use next/image
                <img
                  src={url.og_image_url}
                  alt=""
                  loading="lazy"
                  className="w-14 h-14 rounded-lg object-cover bg-zinc-100 dark:bg-zinc-800 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <span className="text-sm font-medium text-zinc-900 dark:text-white group-hover:underline truncate">
                  {url.title || url.original_url}
                </span>
                {url.description && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">{url.description}</span>
                )}
                <span className="text-xs text-zinc-400 flex items-center gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element -- favicons are 14x14 and don't benefit from next/image */}
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`}
                    alt=""
                    width={14}
                    height={14}
                    className="shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  {domain}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0 text-xs text-zinc-400">
                <span className="text-green-600 dark:text-green-400">↑</span>
                <span>{url.upvotes}</span>
              </div>
            </a>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <ShareUrlButton
                urlId={url.id}
                urlTitle={url.title || url.original_url}
                className="text-xs"
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function CollectionItemsEmpty() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">This collection is empty yet.</p>
      <p className="text-xs text-zinc-400">
        Browse the web and save URLs to this collection to get started.
      </p>
    </div>
  );
}