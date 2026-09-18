import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { PeopleClient, type PersonResult } from './PeopleClient';

export const metadata: Metadata = {
  title: 'Find people — Roam',
  description: 'Search for people to follow and discover new curators on Roam.',
};

export default async function PeoplePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/join?mode=signin');

  const { data: suggestions } = await supabase.rpc('get_follow_suggestions', { p_limit: 12 });

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-white dark:bg-zinc-950">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Find people</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Search by username or name, and follow curators you find interesting.
          </p>
        </div>

        <PeopleClient initialSuggestions={(suggestions ?? []) as PersonResult[]} />
      </div>
    </div>
  );
}
