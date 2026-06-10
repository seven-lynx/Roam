import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

interface TopSite {
  id: string;
  title: string;
  original_url: string;
  domain: string;
  wilson_score: number;
  upvotes: number;
  og_image_url: string | null;
}

async function getTopSites(): Promise<TopSite[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('urls')
    .select('id, title, original_url, domain, wilson_score, upvotes, og_image_url')
    .eq('approved', true)
    .eq('inactive', false)
    .order('wilson_score', { ascending: false })
    .limit(10);

  return (data ?? []) as TopSite[];
}

export async function TopSites() {
  const sites = await getTopSites();

  if (sites.length === 0) return null;

  return (
    <div className="w-full border-t border-zinc-200 dark:border-zinc-800 pt-10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Top-rated sites</h2>
        <span className="text-xs text-zinc-400">Ranked by community votes</span>
      </div>

      <div className="grid gap-3">
        {sites.map((site) => {
          const domain = (() => {
            try { return new URL(site.original_url).hostname.replace(/^www\./, ''); }
            catch { return site.domain || site.original_url; }
          })();

          return (
            <a
              key={site.id}
              href={site.original_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors group"
            >
              {/* Favicon */}
              <img
                src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`}
                alt=""
                width={20}
                height={20}
                className="shrink-0 rounded"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />

              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-zinc-900 dark:text-white group-hover:underline truncate block">
                  {site.title || site.original_url}
                </span>
                <span className="text-xs text-zinc-400">{domain}</span>
              </div>

              <div className="flex items-center gap-1 shrink-0 text-xs text-zinc-400">
                <span className="text-green-600 dark:text-green-400">↑</span>
                <span>{site.upvotes}</span>
              </div>
            </a>
          );
        })}
      </div>

      <div className="mt-4 text-center">
        <Link
          href="/signup"
          className="text-sm text-blue-600 hover:underline font-medium"
        >
          Sign up to discover more →
        </Link>
      </div>
    </div>
  );
}