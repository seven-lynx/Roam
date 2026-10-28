import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PublicProfileHeader } from './PublicProfileHeader';
import { BadgeDisplay } from '@/components/badges/BadgeDisplay';
import type { BadgeData } from '@/components/badges/BadgeDisplay';
import { LevelProgress } from '@/components/badges/LevelProgress';

export const dynamic = 'force-dynamic';

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
  return { title: data.display_name || username, description: data.bio ?? `${username}'s profile on Roam` };
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
  const supabase = await createClient();

  // Fetch core profile using only existing columns
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, created_at')
    .eq('username', username)
    .eq('is_public', true)
    .single();

  if (!profile) notFound();

  const { data: { user: viewer } } = await supabase.auth.getUser();

  const [followerCount, followingCount, followStatus] = viewer
    ? await (async () => {
        const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const profileUrl = `${baseUrl}/functions/v1/profile?username=${encodeURIComponent(username)}`;
        const profileRes = await fetch(profileUrl, {
          headers: { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? anonKey}` },
        });
        const profileData = profileRes.ok ? await profileRes.json() : null;
        const { data: followRow } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', viewer.id)
          .eq('following_id', profile.id)
          .maybeSingle();
        const status: 'none' | 'following' = followRow ? 'following' : 'none';
        return [profileData?.follower_count ?? 0, profileData?.following_count ?? 0, status] as const;
      })()
    : [0, 0, 'none' as const];

  // Try to fetch gamification data — these RPC/columns may not exist yet
  const [gamificationResult, badgesResult] = await Promise.allSettled([
    supabase.from('profiles')
      .select('xp_total, level, streak_days, max_streak, badge_count')
      .eq('id', profile.id)
      .single(),
    supabase.rpc('get_user_badges', { p_user_id: profile.id }),
  ]);

  const gamification = gamificationResult.status === 'fulfilled' ? gamificationResult.value.data : null;
  const badgesRaw = badgesResult.status === 'fulfilled' ? badgesResult.value.data : null;
  const badges: BadgeData[] = (badgesRaw ?? []) as unknown as BadgeData[];
  const unlockedBadges = badges.filter(b => b.is_unlocked);

  const { data: collections } = await supabase
    .from('collections')
    .select('id, name, slug, created_at')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false });

  const { data: userCategories } = await supabase
    .from('user_categories')
    .select('categories(name, icon)')
    .eq('user_id', profile.id);

  const interests = [...new Map(
    (userCategories ?? [])
      .flatMap(r => r.categories ? [r.categories as unknown as { name: string; icon: string }] : [])
      .map(c => [c.name, c] as [string, { name: string; icon: string }])
  ).values()];

  const joinedDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
    : null;

  const xpTotal = gamification?.xp_total ?? 0;
  const level = gamification?.level ?? 1;
  const streakDays = gamification?.streak_days ?? 0;
  const maxStreak = gamification?.max_streak ?? 0;
  const badgeCount = unlockedBadges.length;

  return (
    <div className="min-h-full bg-screen">
      <div className="max-w-2xl mx-auto px-6 py-12 flex flex-col gap-10">

        <PublicProfileHeader
          profile={{ id: profile.id, username: profile.username, display_name: profile.display_name ?? null }}
          viewer={viewer}
          initialStatus={followStatus}
          followerCount={followerCount}
          followingCount={followingCount}
        />

        {xpTotal > 0 && (
          <LevelProgress
            level={level}
            xpTotal={xpTotal}
            streakDays={streakDays}
            maxStreak={maxStreak}
            badgeCount={badgeCount}
          />
        )}

        {joinedDate && (
          <section className="text-sm">
            <div className="text-center"><p className="font-semibold text-ink">{joinedDate}</p><p className="text-muted">joined</p></div>
          </section>
        )}

        {profile.bio && (
          <section><p className="text-sm text-muted leading-relaxed">{profile.bio}</p></section>
        )}

        {interests.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-ink mb-3">Interests</h2>
            <div className="flex flex-wrap gap-2">
              {interests.map(cat => (
                <span key={cat.name} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-panel-2 text-muted">
                  <span>{cat.icon}</span><span>{cat.name}</span>
                </span>
              ))}
            </div>
          </section>
        )}

        {unlockedBadges.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-ink">Badges ({unlockedBadges.length})</h2>
            </div>
            <BadgeDisplay badges={badges} showLocked={false} compact />
          </section>
        )}

        {collections && collections.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-ink mb-3">Collections</h2>
            <ul className="flex flex-col gap-2">
              {collections.map(col => (
                <li key={col.id}>
                  <Link href={`/collections/${col.slug}`} className="flex items-center justify-between px-4 py-3 rounded-lg border border-line hover:bg-panel-2 transition-colors group">
                    <span className="text-sm font-medium text-ink">{col.name}</span>
                    <span className="text-xs text-muted group-hover:text-muted group-hover:text-s => s >= 800 ? 'ink' : 'muted' transition-colors">View →</span>
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