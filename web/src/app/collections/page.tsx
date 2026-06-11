import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Collections',
  description: 'Browse community-curated collections of the best websites on Roam.',
};

export default async function CollectionsPage() {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return <CollectionsError />;
  }

  const { data: collections } = await supabase
    .from('collections')
    .select('id, name, slug, created_at, profiles(username, display_name)')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-white dark:bg-zinc-950">
      <div className="max-w-4xl mx-auto px-6 py-12 flex flex-col gap-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Collections</h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">
            Community-curated collections of the best websites on the web.
          </p>
        </div>

        {collections && collections.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {collections.map((col) => {
              const owner = col.profiles as unknown as { username: string; display_name: string } | null;
              return (
                <Link
                  key={col.id}
                  href={`/collections/${col.slug}`}
                  className="flex flex-col justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors group"
                >
                  <div>
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-white group-hover:underline">
                      {col.name}
                    </h2>
                    {owner && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        by {owner.display_name || owner.username}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-3">
                    {new Date(col.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                  </p>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No collections yet.</p>
            <p className="text-xs text-zinc-400">
              Collections will appear here once users start creating them.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function CollectionsError() {
  return (
    <div className="min-h-[calc(100vh-8rem)] bg-white dark:bg-zinc-950 flex flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Collections</h1>
      <p className="mt-3 text-zinc-500 dark:text-zinc-400 max-w-md">
        Could not load collections right now. Please try again later.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        Go home
      </Link>
    </div>
  );
}