import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { ProfileClient } from './ProfileClient';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/join?mode=signin');

  const [profileResult, categoriesResult, userCategoriesResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('categories').select('id, name, icon, sort_order').order('sort_order'),
    supabase.from('user_categories').select('category_id').eq('user_id', user.id),
  ]);

  const profile = profileResult.data;
  const allCategories = (categoriesResult.data ?? []).map(c => ({ id: c.id, label: c.name, emoji: c.icon }));
  const userCategoryIds = (userCategoriesResult.data ?? []).map(r => r.category_id);

  return (
    <ProfileClient
      userId={user.id}
      email={user.email ?? ''}
      profile={profile}
      allCategories={allCategories}
      initialCategoryIds={userCategoryIds}
    />
  );
}


