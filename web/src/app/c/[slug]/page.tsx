import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

interface UrlItem {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  og_image_url: string | null;
  added_at: string;
}

interface CollectionData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_public: boolean;
  owner: { username: string; display_name: string | null };
  items: UrlItem[];
}

async function getCollection(slug: string): Promise<CollectionData | null> {
  const supabase = await createClient();

  const { data: col, error } = await supabase
    .from("collections")
    .select(`
      id, name, slug, description, is_public,
      owner:profiles!collections_owner_id_fkey ( username, display_name ),
      collection_items (
        added_at,
        urls ( id, url, title, description, og_image_url )
      )
    `)
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (error || !col) return null;

  const items: UrlItem[] = (col.collection_items ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((ci: any) => {
      const u = Array.isArray(ci.urls) ? ci.urls[0] : ci.urls;
      return u ? { ...u, added_at: ci.added_at } : null;
    })
    .filter(Boolean) as UrlItem[];

  return {
    id: col.id,
    name: col.name,
    slug: col.slug,
    description: col.description,
    is_public: col.is_public,
    owner: Array.isArray(col.owner) ? col.owner[0] : col.owner,
    items,
  };
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const col = await getCollection(slug);
  if (!col) return { title: "Collection not found" };
  return {
    title: col.name,
    description: col.description ?? `A Roam collection by @${col.owner.username}`,
  };
}

export default async function CollectionPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const col = await getCollection(slug);
  if (!col) notFound();

  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950 px-6 py-16">
      <div className="max-w-2xl mx-auto flex flex-col gap-10">

        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">{col.name}</h1>
          {col.description && (
            <p className="text-zinc-500 dark:text-zinc-400">{col.description}</p>
          )}
          <p className="text-sm text-zinc-400">
            by{" "}
            <Link
              href={`/u/${col.owner.username}`}
              className="text-zinc-600 dark:text-zinc-300 hover:underline"
            >
              @{col.owner.username}
            </Link>
            {" · "}
            {col.items.length} {col.items.length === 1 ? "link" : "links"}
          </p>
        </div>

        {/* Items */}
        {col.items.length === 0 ? (
          <p className="text-zinc-400 text-sm">This collection is empty.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {col.items.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-4 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              >
                {item.og_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.og_image_url}
                    alt=""
                    className="w-20 h-14 object-cover rounded-lg shrink-0 bg-zinc-200"
                  />
                )}
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="font-medium text-zinc-900 dark:text-white line-clamp-1">
                    {item.title ?? item.url}
                  </span>
                  {item.description && (
                    <span className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
                      {item.description}
                    </span>
                  )}
                  <span className="text-xs text-zinc-400 truncate">{item.url}</span>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Back */}
        <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
          ← Back to Roam
        </Link>
      </div>
    </main>
  );
}
