import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { TopSitesList } from './TopSitesList';

export interface TopSite {
  id: string;
  title: string;
  original_url: string;
  domain: string;
  wilson_score: number;
  upvotes: number;
  og_image_url: string | null;
}

async function getTopSites(): Promise<TopSite[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('urls')
    .select('id, title, original_url, domain, wilson_score, upvotes, og_image_url')
    .eq('approved', true)
    .eq('inactive', false)
    .order('wilson_score', { ascending: false })
    .limit(10);

  return (data ?? []) as TopSite[];
}

export async function TopSites({ userId }: { userId?: string | null }) {
  const sites = await getTopSites();

  if (sites.length === 0) return null;

  return <TopSitesList sites={sites} userId={userId} />;
}
