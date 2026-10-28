'use client';

import Link from 'next/link';
import { extractDomain, getFaviconUrl } from '@/lib/url-utils';
import type { TopSite } from './TopSites';

interface Props {
  sites: TopSite[];
  userId?: string | null;
}

export function TopSitesList({ sites, userId }: Props) {
  return (
    <div className="w-full border-t border-line pt-10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-ink">Top-rated sites</h2>
        <span className="text-xs text-muted">Ranked by community votes</span>
      </div>

      <div className="grid gap-3">
        {sites.map((site) => {
          const domain = extractDomain(site.original_url) || site.domain || site.original_url;

          return (
            <a
              key={site.id}
              href={site.original_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 panel px-4 py-3 hover:bg-panel-2 transition-colors group"
            >
              {/* Favicon */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getFaviconUrl(domain, 32)}
                alt=""
                width={20}
                height={20}
                className="shrink-0 rounded"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />

              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-ink group-hover:underline truncate block">
                  {site.title || site.original_url}
                </span>
                <span className="text-xs text-muted">{domain}</span>
              </div>

              <div className="flex items-center gap-1 shrink-0 text-xs text-muted">
                <span className="text-ok">↑</span>
                <span>{site.upvotes}</span>
              </div>
            </a>
          );
        })}
      </div>

      <div className="mt-4 text-center">
        {userId ? (
          <Link href="/signup?mode=discover" className="text-sm text-phosphor hover:underline font-medium">
            Discover the web →
          </Link>
        ) : (
          <Link href="/signup" className="text-sm text-phosphor hover:underline font-medium">
            Sign up to discover more →
          </Link>
        )}
      </div>
    </div>
  );
}
