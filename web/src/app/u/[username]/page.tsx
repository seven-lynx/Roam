import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

const FUNCTIONS_URL = process.env.NEXT_PUBLIC_SUPABASE_URL + "/functions/v1";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  item_count: number;
}

interface ProfileData {
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  follower_count: number;
  following_count: number;
  collections: Collection[];
}

async function getProfile(username: string): Promise<ProfileData | null> {
  const res = await fetch(`${FUNCTIONS_URL}/profile?username=${encodeURIComponent(username)}`, {
    headers: { Authorization: `Bearer ${ANON_KEY}` },
    next: { revalidate: 60 },
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const { data } = await res.json();
  return data as ProfileData;
}

export async function generateMetadata(
  { params }: { params: Promise<{ username: string }> }
): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) return { title: "User not found" };
  return {
    title: profile.display_name ?? profile.username,
    description: profile.bio ?? `${profile.username}'s profile on Roam`,
  };
}

export default async function ProfilePage(
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) notFound();

  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950 px-6 py-16">
      <div className="max-w-2xl mx-auto flex flex-col gap-10">

        {/* Header */}
        <div className="flex items-start gap-5">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={profile.username}
              className="w-16 h-16 rounded-full object-cover bg-zinc-200"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-2xl font-bold text-zinc-500 select-none">
              {(profile.display_name ?? profile.username)[0].toUpperCase()}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {profile.display_name ?? profile.username}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">@{profile.username}</p>
            {profile.bio && (
              <p className="mt-1 text-zinc-600 dark:text-zinc-300 text-sm max-w-sm">{profile.bio}</p>
            )}
            <div className="flex gap-4 mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              <span><strong className="text-zinc-900 dark:text-white">{profile.follower_count}</strong> followers</span>
              <span><strong className="text-zinc-900 dark:text-white">{profile.following_count}</strong> following</span>
            </div>
          </div>
        </div>

        {/* Collections */}
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Collections</h2>
          {profile.collections.length === 0 ? (
            <p className="text-zinc-400 text-sm">No public collections yet.</p>
          ) : (
            <div className="grid gap-3">
              {profile.collections.map((col) => (
                <Link
                  key={col.id}
                  href={`/c/${col.slug}`}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-zinc-900 dark:text-white">{col.name}</span>
                    {col.description && (
                      <span className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-1">{col.description}</span>
                    )}
                  </div>
                  <span className="text-sm text-zinc-400 shrink-0 ml-4">{col.item_count} links</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Back */}
        <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
          ← Back to Roam
        </Link>
      </div>
    </main>
  );
}
