import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 60;

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('display_name, bio')
    .eq('username', username)
    .eq('is_public', true)
    .single();

  if (!data) return { title: 'Profile not found' };
  return {
    title: data.display_name || username,
    description: data.bio ?? `${username}'s profile on Roam`,
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, created_at')
    .eq('username', username)
    .eq('is_public', true)
    .single();

  if (!profile) notFound();

  const { data: collections } = await supabase
    .from('collections')
    .select('id, name, slug, created_at')
    .eq('user_id', profile.id)
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  const { data: userCategories } = await supabase
    .from('user_categories')
    .select('categories(name, icon)')
    .eq('user_id', profile.id);

  const interests = (userCategories ?? [])
    .flatMap(r => r.categories ? [r.categories as { name: string; icon: string }] : []);

  const initial = (profile.display_name || profile.username || '?')[0].toUpperCase();

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-white dark:bg-zinc-950">
      <div className="max-w-2xl mx-auto px-6 py-12 flex flex-col gap-10">

        {/* Header */}
        <div className="flex items-center gap-5">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-zinc-200 dark:bg-zinc-800 text-2xl font-bold text-zinc-900 dark:text-white shrink-0">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={profile.username}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : initial}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {profile.display_name || profile.username}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">@{profile.username}</p>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <section>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">{profile.bio}</p>
          </section>
        )}

        {/* Interests */}
        {interests.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white mb-3">Interests</h2>
            <div className="flex flex-wrap gap-2">
              {interests.map(cat => (
                <span
                  key={cat.name}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                >
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Collections */}
        {collections && collections.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white mb-3">Collections</h2>
            <ul className="flex flex-col gap-2">
              {collections.map(col => (
                <li key={col.id}>
                  <Link
                    href={`/c/${col.slug}`}
                    className="flex items-center justify-between px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors group"
                  >
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">{col.name}</span>
                    <span className="text-xs text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">View →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

      </div>
    </div>
  );
}
