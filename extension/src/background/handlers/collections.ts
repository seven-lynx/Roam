// collections.ts — collection list and mutations.
//
// Create and add-item go through the collection Edge Function (limits and
// duplicate handling live there); rename, delete and visibility are direct
// PostgREST updates on rows the RLS policy already restricts to the owner.

import { getSupabase } from '../../lib/supabase';
import type { Collection, Response } from '../../lib/messages';
import { normalizeUrl } from '../../lib/url';

export async function getCollections(): Promise<Response<Collection[]>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: "You're not signed in. Please sign in and try again." };
  const { data, error } = await getSupabase().from('collections').select('id,name,slug,is_public,item_count:collection_items(count)').eq('user_id', session.user.id).order('name');
  if (error) return { ok: false, error: error.message };
  type CollectionRow = { id: string; name: string; slug: string; is_public: boolean; item_count?: { count: number }[] | null };
  const collections = ((data ?? []) as CollectionRow[]).map((c) => ({ id: c.id, name: c.name, slug: c.slug, is_public: c.is_public, item_count: c.item_count?.[0]?.count ?? 0 }));
  return { ok: true, data: collections };
}

export async function createCollection(name: string): Promise<Response<Collection>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: "You're not signed in. Please sign in and try again." };
  const { data, error } = await getSupabase().functions.invoke('collection', {
    body: { action: 'create', name },
  });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  if (!data?.id) return { ok: false, error: "Couldn't create collection." };
  return { ok: true, data: { id: data.id, name: data.name, slug: data.slug, is_public: data.is_public, item_count: 0 } };
}

export async function addUrlToCollection(url: string, collectionId: string): Promise<Response<null>> {
  const normalized = normalizeUrl(url);
  if (!normalized) return { ok: false, error: "That doesn't look like a valid URL." };
  const { data: urlData, error: urlError } = await getSupabase().from('urls').select('id').eq('url', normalized).eq('approved', true).maybeSingle();
  if (urlError) return { ok: false, error: "Couldn't add to collection. Please try again." };
  let urlId = urlData?.id;
  if (!urlId) {
    const { data: newUrl, error: createError } = await getSupabase().from('urls').insert({ url: normalized, original_url: normalized, approved: false, source: 'user_submission' }).select('id').single();
    if (createError) return { ok: false, error: "Couldn't add to collection. Please try again." };
    urlId = newUrl.id;
  }
  const { data, error: addError } = await getSupabase().functions.invoke('collection', {
    body: { action: 'add_item', collection_id: collectionId, url_id: urlId },
  });
  if (addError) return { ok: false, error: addError.message };
  if (data?.error) {
    if (data.error.includes('already in collection')) return { ok: true, data: null };
    return { ok: false, error: data.error };
  }
  return { ok: true, data: null };
}

export async function deleteCollection(collectionId: string): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };
  const { error } = await getSupabase().from('collections').delete().eq('id', collectionId).eq('user_id', session.user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function renameCollection(collectionId: string, name: string): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };
  const { error } = await getSupabase().from('collections').update({ name }).eq('id', collectionId).eq('user_id', session.user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function updateCollectionPublic(collectionId: string, isPublic: boolean): Promise<Response<null>> {
  const session = (await getSupabase().auth.getSession()).data.session;
  if (!session) return { ok: false, error: 'Not signed in.' };
  const { error } = await getSupabase().from('collections').update({ is_public: isPublic }).eq('id', collectionId).eq('user_id', session.user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}
