'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Avatar } from '@/components/UI';

export interface ActivityItem {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  activity_type: 'url_submitted' | 'url_rated' | 'collection_created' | 'collection_updated';
  subject_id: string | null;
  subject_title: string | null;
  subject_url: string | null;
  collection_slug: string | null;
  created_at: string;
}

interface Props {
  initialActivities: ActivityItem[];
  followingCount: number;
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function activityText(item: ActivityItem): { verb: string; link: React.ReactNode } {
  const displayName = item.display_name || item.username;

  switch (item.activity_type) {
    case 'url_rated':
      return {
        verb: 'liked',
        link: item.subject_url
          ? <a href={item.subject_url} target="_blank" rel="noopener noreferrer" className="font-medium text-zinc-900 dark:text-white hover:underline">{item.subject_title || item.subject_url}</a>
          : <span className="font-medium text-zinc-900 dark:text-white">{item.subject_title}</span>,
      };
    case 'url_submitted':
      return {
        verb: 'submitted',
        link: item.subject_url
          ? <a href={item.subject_url} target="_blank" rel="noopener noreferrer" className="font-medium text-zinc-900 dark:text-white hover:underline">{item.subject_title || item.subject_url}</a>
          : <span className="font-medium text-zinc-900 dark:text-white">{item.subject_title}</span>,
      };
    case 'collection_created':
      return {
        verb: 'created a collection',
        link: item.collection_slug
          ? <Link href={`/c/${item.collection_slug}`} className="font-medium text-zinc-900 dark:text-white hover:underline">{item.subject_title}</Link>
          : <span className="font-medium text-zinc-900 dark:text-white">{item.subject_title}</span>,
      };
    case 'collection_updated':
      return {
        verb: 'made a collection public',
        link: item.collection_slug
          ? <Link href={`/c/${item.collection_slug}`} className="font-medium text-zinc-900 dark:text-white hover:underline">{item.subject_title}</Link>
          : <span className="font-medium text-zinc-900 dark:text-white">{item.subject_title}</span>,
      };
    default:
      return { verb: 'did something', link: null };
  }
}

export function ActivityFeedClient({ initialActivities, followingCount }: Props) {
  const supabase = createClient();
  const [activities, setActivities] = useState<ActivityItem[]>(initialActivities);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialActivities.length === 50);

  const loadMore = async () => {
    if (loading) return;
    setLoading(true);
    const oldest = activities[activities.length - 1]?.created_at;

    const { data } = await supabase.rpc('get_activity_feed', {
      p_limit: 50,
      p_offset: 0,
      p_before: oldest ?? null,
    });

    const newItems = (data ?? []) as ActivityItem[];
    setActivities(prev => [...prev, ...newItems]);
    setHasMore(newItems.length === 50);
    setLoading(false);
  };

  if (followingCount === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-4">🧭</p>
        <p className="text-base font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          Follow curators to see their discoveries
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          When people you follow like or submit URLs, it shows up here.
        </p>
        <Link
          href="/join"
          className="inline-block px-4 py-2 rounded-lg text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 transition-opacity"
        >
          Discover curators
        </Link>
      </div>
    );
  }

  if (activities.length === 0 && !loading) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-4">📡</p>
        <p className="text-base font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          Nothing yet from people you follow
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Activity appears here when people you follow like or submit URLs.
        </p>
      </div>
    );
  }

  return (
    <div>
      <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
        {activities.map(item => {
          const { verb, link } = activityText(item);
          return (
            <li key={item.id} className="py-4 flex items-start gap-3">
              <Link href={`/u/${item.username}`} className="shrink-0">
                <Avatar name={item.display_name || item.username} size="sm" />
              </Link>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  <Link href={`/u/${item.username}`} className="font-medium text-zinc-900 dark:text-white hover:underline">
                    {item.display_name || item.username}
                  </Link>
                  {' '}{verb}{' '}
                  {link}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">{timeAgo(item.created_at)}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
