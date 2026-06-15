import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { ProfileClient } from './ProfileClient';
import type { CollectionRow } from './CollectionsManager';
import type { SavedUrlRow } from './SavedUrlsManager';

export const metadata: Metadata = { title: 'Profile' };

function thirtyDaysAgoISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
}

export default async function ProfilePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/join?mode=signin');

  const thirtyDaysAgo = thirtyDaysAgoISO();

  // Use Promise.allSettled so that if the migration hasn't run yet and
  // the new columns / RPC don't exist, the page still loads gracefully.
  const results = await Promise.allSettled([
    supabase.from('profiles').select('id, username, display_name, bio, avatar_url, is_public, xp_total, level, streak_days, max_streak, badge_count').eq('id', user.id).single(),
    supabase.from('categories').select('id, name, icon, sort_order').order('sort_order'),
    supabase.from('subcategories').select('id, name, category_id, sort_order').order('sort_order'),
    supabase.from('user_categories').select('category_id, subcategory_id').eq('user_id', user.id),
    supabase.from('collections').select('id, name, slug, is_public, item_count:collection_items(count)').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('saved_urls').select('id, url, title, saved_at').eq('user_id', user.id).gt('saved_at', thirtyDaysAgo).order('saved_at', { ascending: false }).limit(50),
    supabase.rpc('get_user_badges', { p_user_id: user.id }),
  ]);

  // Helper: safely unwrap a settled promise result
  const unwrap = (index: number) => {
    const r = results[index];
    return r.status === 'fulfilled' ? (r.value as NonNullable<unknown>) : { data: null, error: null };
  };

  const profileResult = unwrap(0) as Record<string, unknown>;
  const categoriesResult = unwrap(1) as Record<string, unknown>;
  const subcategoriesResult = unwrap(2) as Record<string, unknown>;
  const userCategoriesResult = unwrap(3) as Record<string, unknown>;
  const collectionsResult = unwrap(4) as Record<string, unknown>;
  const savedUrlsResult = unwrap(5) as Record<string, unknown>;
  const badgesResult = unwrap(6) as Record<string, unknown>;

  const profile = profileResult.data;
  const allCategories = ((categoriesResult.data ?? []) as Record<string, unknown>[]).map((c: Record<string, unknown>) => ({ id: c.id, label: c.name, emoji: c.icon }));
  const allSubcategories = ((subcategoriesResult.data ?? []) as Record<string, unknown>[]).map((s: Record<string, unknown>) => ({ id: s.id, name: s.name, category_id: s.category_id }));
  const userCategoryRows = (userCategoriesResult.data ?? []) as Record<string, unknown>[];
  const userCategoryIds = userCategoryRows.filter(r => r.subcategory_id == null).map(r => r.category_id as string);
  const userTopicIds = userCategoryRows.filter(r => r.subcategory_id != null).map(r => r.subcategory_id as string);

  const collections: CollectionRow[] = ((collectionsResult.data ?? []) as Record<string, unknown>[]).map(c => ({
    id: c.id as string,
    name: c.name as string,
    slug: c.slug as string,
    is_public: c.is_public as boolean,
    item_count: Array.isArray(c.item_count) && (c.item_count as Record<string, unknown>[])[0]?.count ? Number((c.item_count as Record<string, unknown>[])[0].count) : 0,
  }));

  const savedUrls: SavedUrlRow[] = (savedUrlsResult.data ?? []) as SavedUrlRow[];

  return (
    <ProfileClient
      userId={user.id}
      email={user.email ?? ''}
      profile={profile as Record<string, unknown> | null}
      allCategories={allCategories}
      allSubcategories={allSubcategories}
      initialCategoryIds={userCategoryIds}
      initialTopicIds={userTopicIds}
      initialCollections={collections}
      initialSavedUrls={savedUrls}
      initialBadges={(badgesResult.data ?? []) as Record<string, unknown>[]}
    />
  );
}