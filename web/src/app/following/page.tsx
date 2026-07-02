import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { ActivityFeedClient } from './ActivityFeedClient';

export const metadata: Metadata = {
  title: 'Following — Roam',
  description: 'See what people you follow are discovering on Roam.',
};

export default async function FollowingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/join');

  // Fetch initial activity feed (SSR)
  const { data: activities, error } = await supabase.rpc('get_activity_feed', {
    p_limit: 50,
    p_offset: 0,
    p_before: null,
  });

  // Fetch count of people user follows
  const { count: followingCount } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', user.id);

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-white dark:bg-zinc-950">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Following</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            What people you follow are discovering
          </p>
        </div>

        <ActivityFeedClient
          initialActivities={error ? [] : (activities ?? [])}
          followingCount={followingCount ?? 0}
        />
      </div>
    </div>
  );
}
