import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { CollectionItemsHeader, CollectionItemsList, CollectionItemsEmpty } from './CollectionItemsClient';
import type { CollectionData, CollectionItem } from './types';

export const revalidate = 60;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('collections')
    .select('name, profiles(username)')
    .eq('slug', slug)
    .single();

  if (!data) return { title: 'Collection not found' };
  const owner = (data.profiles as unknown as { username: string } | null)?.username;
  return {
    title: data.name,
    description: owner ? `A collection by ${owner} on Roam` : 'A collection on Roam',
  };
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: collection } = await supabase
    .from('collections')
    .select('id, name, user_id, created_at, profiles(username, display_name)')
    .eq('slug', slug)
    .single();

  if (!collection) notFound();

  const { data: items } = await supabase
    .from('collection_items')
    .select('id, added_at, urls(id, title, original_url, description, og_image_url, upvotes, downvotes)')
    .eq('collection_id', collection.id)
    .order('added_at', { ascending: false });

  const owner = collection.profiles as unknown as { username: string; display_name: string } | null;
  const itemCount = items?.length ?? 0;
  const typedCollection: CollectionData = {
    id: collection.id,
    name: collection.name,
    user_id: collection.user_id,
    created_at: collection.created_at,
    profiles: owner,
  };
  const typedItems: CollectionItem[] = (items ?? []).map(item => ({
    id: item.id,
    added_at: item.added_at,
    urls: item.urls as unknown as CollectionItem['urls'],
  }));

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-white dark:bg-zinc-950">
      <div className="max-w-2xl mx-auto px-6 py-12 flex flex-col gap-10">

        <CollectionItemsHeader name={typedCollection.name} itemCount={itemCount} owner={owner} />

        {items && items.length > 0 ? (
          <CollectionItemsList items={typedItems} />
        ) : (
          <CollectionItemsEmpty />
        )}

      </div>
    </div>
  );
}
