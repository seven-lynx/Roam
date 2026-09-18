'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Avatar } from '@/components/UI';
import { FollowButton } from '@/app/u/[username]/FollowButton';

export interface PersonResult {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  follower_count: number;
  is_following: boolean;
}

function PersonRow({ person }: { person: PersonResult }) {
  return (
    <li className="py-4 flex items-center gap-3">
      <Link href={`/u/${person.username}`} className="shrink-0">
        <Avatar name={person.display_name || person.username} size="md" />
      </Link>
      <Link href={`/u/${person.username}`} className="flex-1 min-w-0 group">
        <p className="text-sm font-medium text-zinc-900 dark:text-white truncate group-hover:underline">
          {person.display_name || person.username}
        </p>
        <p className="text-xs text-zinc-400 truncate">@{person.username}</p>
        {person.bio && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">{person.bio}</p>
        )}
        <p className="text-[11px] text-zinc-400 mt-0.5 tabular-nums">
          {person.follower_count} {person.follower_count === 1 ? 'follower' : 'followers'}
        </p>
      </Link>
      <FollowButton
        targetUserId={person.user_id}
        initialStatus={person.is_following ? 'following' : 'none'}
      />
    </li>
  );
}

export function PeopleClient({ initialSuggestions }: { initialSuggestions: PersonResult[] }) {
  const supabase = createClient();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc('search_users', { p_query: q, p_limit: 30 });
    if (error) {
      setError('Search failed. Please try again.');
      setResults([]);
    } else {
      setResults((data ?? []) as PersonResult[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    const timer = setTimeout(() => void runSearch(trimmed), 300);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  const searching = query.trim().length > 0;

  return (
    <div>
      <div className="relative mb-6">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by username or name…"
          autoFocus
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-600 dark:text-red-400 mb-4">
          {error}
        </div>
      )}

      {searching ? (
        <section>
          {loading ? (
            <p className="py-8 text-sm text-zinc-400 text-center">Searching…</p>
          ) : results.length === 0 ? (
            <p className="py-8 text-sm text-zinc-400 text-center">
              No one found for “{query.trim()}”.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
              {results.map(p => <PersonRow key={p.user_id} person={p} />)}
            </ul>
          )}
        </section>
      ) : (
        <section>
          <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
            People you may like
          </h2>
          {initialSuggestions.length === 0 ? (
            <p className="py-8 text-sm text-zinc-400 text-center">
              No suggestions yet — try searching for someone by name.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
              {initialSuggestions.map(p => <PersonRow key={p.user_id} person={p} />)}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
