import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { ProfileClient } from './ProfileClient';
import type { CollectionRow } from './CollectionsManager';
import type { SavedUrlRow } from './SavedUrlsManager';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/join?mode=signin');

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [profileResult, categoriesResult, userCategoriesResult, collectionsResult, savedUrlsResult] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('categories').select('id, name, icon, sort_order').order('sort_order'),
      supabase.from('user_categories').select('category_id').eq('user_id', user.id),
      supabase
        .from('collections')
        .select('id, name, slug, is_public, item_count:collection_items(count)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('saved_urls')
        .select('id, url, title, saved_at')
        .eq('user_id', user.id)
        .gt('saved_at', thirtyDaysAgo)
        .order('saved_at', { ascending: false })
        .limit(50),
    ]);

  const profile = profileResult.data;
  const allCategories = (categoriesResult.data ?? []).map(c => ({ id: c.id, label: c.name, emoji: c.icon }));
  const userCategoryIds = (userCategoriesResult.data ?? []).map(r => r.category_id);

  const collections: CollectionRow[] = (collectionsResult.data ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    is_public: c.is_public,
    item_count: Array.isArray(c.item_count) && c.item_count[0]?.count ? Number(c.item_count[0].count) : 0,
  }));

  const savedUrls: SavedUrlRow[] = (savedUrlsResult.data ?? []) as SavedUrlRow[];

  return (
    <ProfileClient
      userId={user.id}
      email={user.email ?? ''}
      profile={profile}
      allCategories={allCategories}
      initialCategoryIds={userCategoryIds}
      initialCollections={collections}
      initialSavedUrls={savedUrls}
    />
  );
}


