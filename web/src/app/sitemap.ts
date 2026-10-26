import type { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://roamtheweb.app';

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/how-it-works`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    },
    {
      url: `${baseUrl}/stats`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/changelog`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    },
    {
      url: `${baseUrl}/support-roam`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
    {
      url: `${baseUrl}/extensions`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/android`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
  ];

  // Dynamic: public collections (top 100 by item count)
  try {
    const supabase = await createClient();
    const { data: collections } = await supabase
      .from('collections')
      .select('slug, updated_at')
      .eq('is_public', true)
      .order('item_count', { ascending: false, foreignTable: 'collection_items' })
      .limit(100);

    if (collections) {
      for (const col of collections) {
        staticPages.push({
          url: `${baseUrl}/collections/${col.slug}`,
          lastModified: new Date(col.updated_at || Date.now()),
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        });
      }
    }

    // Dynamic: public user profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('username, created_at')
      .eq('is_public', true)
      .not('username', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500);

    if (profiles) {
      for (const p of profiles) {
        staticPages.push({
          url: `${baseUrl}/u/${p.username}`,
          lastModified: new Date(p.created_at || Date.now()),
          changeFrequency: 'weekly' as const,
          priority: 0.5,
        });
      }
    }
  } catch {
    // sitemap generation should not fail — skip dynamic entries
  }

  return staticPages;
}