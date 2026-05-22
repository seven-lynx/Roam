import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 60;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('collections')
    .select('name, profiles(username)')
    .eq('slug', slug)
    .eq('is_public', true)
    .single();

  if (!data) return { title: 'Collection not found' };
  const owner = (data.profiles as { username: string } | null)?.username;
  return {
    title: data.name,
    description: owner ? `A collection by ${owner} on Roam` : 'A collection on Roam',
  };
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: collection } = await supabase
    .from('collections')
    .select('id, name, user_id, created_at, profiles(username, display_name)')
    .eq('slug', slug)
    .eq('is_public', true)
    .single();

  if (!collection) notFound();

  const { data: items } = await supabase
    .from('collection_items')
    .select('id, added_at, urls(id, title, original_url, description)')
    .eq('collection_id', collection.id)
    .order('added_at', { ascending: false });

  const owner = collection.profiles as { username: string; display_name: string } | null;

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-white dark:bg-zinc-950">
      <div className="max-w-2xl mx-auto px-6 py-12 flex flex-col gap-10">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{collection.name}</h1>
          {owner && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              by{' '}
              <Link
                href={`/u/${owner.username}`}
                className="hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                {owner.display_name || owner.username}
              </Link>
            </p>
          )}
        </div>

        {/* URL list */}
        {items && items.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {items.map(item => {
              const url = item.urls as { id: string; title: string | null; original_url: string; description: string | null } | null;
              if (!url) return null;
              const domain = (() => {
                try { return new URL(url.original_url).hostname.replace(/^www\./, ''); }
                catch { return url.original_url; }
              })();
              return (
                <li key={item.id}>
                  <a
                    href={url.original_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col gap-1 px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors group"
                  >
                    <span className="text-sm font-medium text-zinc-900 dark:text-white group-hover:underline">
                      {url.title || url.original_url}
                    </span>
                    {url.description && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">{url.description}</span>
                    )}
                    <span className="text-xs text-zinc-400">{domain}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">This collection is empty.</p>
        )}

      </div>
    </div>
  );
}
