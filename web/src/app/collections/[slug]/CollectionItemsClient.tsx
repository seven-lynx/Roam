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
      <h1 className="text-2xl font-bold text-ink">{name}</h1>
      <p className="mt-1 text-sm text-muted">
        {itemCount} website{itemCount !== 1 ? 's' : ''}{owner && (
          <>
            {' · by '}
            <Link
              href={`/u/${owner.username}`}
              className="hover:text-ink transition-colors"
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
              className="flex-1 flex gap-3 px-4 py-3 rounded-lg border border-line hover:bg-panel-2 transition-colors"
            >
              {url.og_image_url && (
                // eslint-disable-next-line @next/next/no-img-element -- external OG images cannot use next/image
                <img
                  src={url.og_image_url}
                  alt=""
                  loading="lazy"
                  className="w-14 h-14 rounded-lg object-cover bg-panel-2 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <span className="text-sm font-medium text-ink group-hover:underline truncate">
                  {url.title || url.original_url}
                </span>
                {url.description && (
                  <span className="text-xs text-muted line-clamp-2">{url.description}</span>
                )}
                <span className="text-xs text-muted flex items-center gap-1">
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
              <div className="flex items-center gap-1 shrink-0 text-xs text-muted">
                <span className="text-ok">↑</span>
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
      <p className="text-sm text-muted">This collection is empty yet.</p>
      <p className="text-xs text-muted">
        Browse the web and save URLs to this collection to get started.
      </p>
    </div>
  );
}