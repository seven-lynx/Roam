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

  const [profileResult, categoriesResult, subcategoriesResult, userCategoriesResult, collectionsResult, savedUrlsResult] =
    await Promise.all([
      supabase.from('profiles').select('id, username, display_name, bio, avatar_url, is_public').eq('id', user.id).single(),
      supabase.from('categories').select('id, name, icon, sort_order').order('sort_order'),
      supabase.from('subcategories').select('id, name, category_id, sort_order').order('sort_order'),
      supabase.from('user_categories').select('category_id, subcategory_id').eq('user_id', user.id),
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
  const allSubcategories = (subcategoriesResult.data ?? []).map(s => ({ id: s.id, name: s.name, category_id: s.category_id }));
  const userCategoryRows = userCategoriesResult.data ?? [];
  const userCategoryIds = userCategoryRows.filter(r => r.subcategory_id == null).map(r => r.category_id);
  const userTopicIds = userCategoryRows.filter(r => r.subcategory_id != null).map(r => r.subcategory_id as string);

  const collections: CollectionRow[] = (collectionsResult.data ?? []).map((c: { id: string; name: string; slug: string; is_public: boolean; item_count: { count: number }[] | number }) => ({
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
      allSubcategories={allSubcategories}
      initialCategoryIds={userCategoryIds}
      initialTopicIds={userTopicIds}
      initialCollections={collections}
      initialSavedUrls={savedUrls}
    />
  );
}


