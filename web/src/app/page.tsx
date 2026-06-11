import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SiteShowcase } from "@/components/SiteShowcase";
import { TopSites } from "@/components/TopSites";
import { AuthErrorBanner } from "@/components/AuthErrorBanner";
import { RandomPageButton } from "@/components/RandomPageButton";

export default async function Home() {
  let user: null | { id: string } = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user ?? null;
  } catch {
    // Supabase unavailable — render the page without auth state
  }

  return (
    <>
      {/* Auth error banner */}
      <Suspense fallback={null}>
        <AuthErrorBanner />
      </Suspense>

      {/* ── Hero Section ──────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-amber-50 via-white to-white dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-950">
        {/* Subtle decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-amber-200/20 dark:bg-amber-500/5 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-blue-200/20 dark:bg-blue-500/5 blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-16 md:pt-28 md:pb-20">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            {/* Left: Hero text */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Community-curated discovery
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-zinc-900 dark:text-white leading-tight">
                Discover a random corner of the web.
              </h1>

              <p className="mt-4 text-lg text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                One tap or click sends you somewhere new — curated by real ratings, filtered by your interests. No algorithms, no feeds, no noise.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mt-8 justify-center lg:justify-start">
                {user ? (
                  <>
                    <Link
                      href="/profile"
                      className="inline-flex items-center justify-center rounded-full bg-amber-500 hover:bg-amber-400 px-8 py-3 text-white font-semibold text-base transition-colors"
                    >
                      Go to profile
                    </Link>
                    <Link
                      href="/how-it-works"
                      className="inline-flex items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-700 px-8 py-3 text-zinc-800 dark:text-zinc-200 font-semibold text-base hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                    >
                      How it works →
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/signup"
                      className="inline-flex items-center justify-center rounded-full bg-amber-500 hover:bg-amber-400 text-white px-8 py-3 font-semibold text-base transition-colors"
                    >
                      Get started
                    </Link>
                    <a
                      href="#downloads"
                      className="inline-flex items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-700 px-8 py-3 text-zinc-800 dark:text-zinc-200 font-semibold text-base hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                    >
                      Get the extension ↓
                    </a>
                  </>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 mt-10 justify-center lg:justify-start">
                <div className="text-center">
                  <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                    1.6 million
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">Curated URLs</div>
                </div>
                <div className="w-px h-10 bg-zinc-200 dark:bg-zinc-800" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-zinc-900 dark:text-white">72+</div>
                  <div className="text-xs text-zinc-400 mt-0.5">Topics</div>
                </div>
                <div className="w-px h-10 bg-zinc-200 dark:bg-zinc-800" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-zinc-900 dark:text-white">4.2 million</div>
                  <div className="text-xs text-zinc-400 mt-0.5">Total page ratings</div>
                </div>
              </div>
            </div>

            {/* Right: Slideshow */}
            <div className="w-full max-w-md lg:max-w-lg">
              <Suspense fallback={
                <div className="animate-pulse rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
                  <div className="aspect-video bg-zinc-200 dark:bg-zinc-800 rounded-xl mb-4" />
                  <div className="h-5 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded mb-2" />
                  <div className="h-4 w-1/3 bg-zinc-200 dark:bg-zinc-800 rounded" />
                </div>
              }>
                <SiteShowcase />
              </Suspense>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works (3 steps) ────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-zinc-900 dark:text-white text-center mb-12">
          How it works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: '01', icon: '🎯', title: 'Pick your interests', desc: 'Select categories that match what you care about. Your discovery feed becomes personal.' },
            { step: '02', icon: '🔄', title: 'Get a random page', desc: 'Tap the Roam button in your browser or Android app. One click = one new page, every time.' },
            { step: '03', icon: '⭐', title: 'Rate and refine', desc: '👍 or 👎 to tell Roam what you like. Your votes shape what you see next.' },
          ].map((item) => (
            <div key={item.step} className="text-center p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 card-hover">
              <div className="text-4xl mb-4">{item.icon}</div>
              <div className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-2">{item.step}</div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">{item.title}</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Top-rated sites ──────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <Suspense fallback={<TopSitesSkeleton />}>
          <TopSites userId={user?.id} />
        </Suspense>
      </section>

      {/* ── Featured Collections ─────────────────────────── */}
      <Suspense fallback={null}>
        <FeaturedCollections />
      </Suspense>

      {/* ── Try a random page (non-logged-in visitors) ────── */}
      {!user && (
        <section className="max-w-6xl mx-auto px-6 pb-20 text-center">
          <div className="rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/10 p-10">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3">
              Ready to explore?
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-md mx-auto">
              Sign up to get personalised recommendations, or try a random curated page right now.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-full bg-amber-500 hover:bg-amber-400 px-8 py-3 text-white font-semibold text-base transition-colors"
              >
                Get started
              </Link>
              <RandomPageButton />
            </div>
          </div>
        </section>
      )}

      {/* ── Downloads ─────────────────────────────────────── */}
      <section id="downloads" className="max-w-6xl mx-auto px-6 pb-20 scroll-mt-20">
        <h2 className="text-3xl font-bold text-zinc-900 dark:text-white text-center mb-10">
          Get the app
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Extension card */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 card-hover">
            <div className="flex items-start gap-4">
              <span className="text-3xl">🌐</span>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Browser Extension</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  Click the Roam button while browsing to discover new pages. Rate with 👍👎 to personalize your recommendations.
                </p>
                <div className="flex gap-3 mt-4">
                  <a
                    href="https://chromewebstore.google.com/detail/ojgphkdgkefokhjnojkddhalnlbajfpc?utm_source=roam-web"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
                    Chrome
                  </a>
                  <a
                    href="https://addons.mozilla.org/firefox/addon/roam-the-web/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5.98 14.68c-.08.23-.22.44-.42.6-.2.16-.44.26-.7.28l-.14.02c-.2 0-.4-.04-.58-.12l-4.47-1.77c-.25-.1-.46-.28-.6-.5s-.23-.48-.23-.74V9.5c0-.55.45-1 1-1s1 .45 1 1v4.77l3.88 1.54c.5.2.75.77.56 1.27l-.3.6z"/></svg>
                    Firefox
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Android card */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 card-hover">
            <div className="flex items-start gap-4">
              <span className="text-3xl">📱</span>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Android App</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  Swipe to discover. Tap to save. Read offline. The full Roam experience in your pocket.
                </p>
                <div className="mt-4">
                  <a
                    href="https://play.google.com/store/apps/details?id=app.roam.android"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Download on Google Play
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why Roam ────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-zinc-900 dark:text-white text-center mb-10">
          Why Roam?
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            { icon: '🎯', title: 'Your interests', desc: 'Select categories that match what you care about. Discovery is personalized, not algorithmic.' },
            { icon: '⭐', title: 'Real ratings', desc: 'Pages are ranked by genuine user votes, not engagement metrics or ad revenue.' },
            { icon: '🚫', title: 'No feeds', desc: 'One button = one page. No infinite scrolling, no rabbit holes, no notifications.' },
            { icon: '🌐', title: 'Community-curated', desc: 'Real people submit and rate pages. The best content rises; the noise disappears.' },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-4 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 card-hover">
              <span className="text-2xl shrink-0">{item.icon}</span>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">{item.title}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

/** Shimmer skeleton shown while TopSites loads */
function TopSitesSkeleton() {
  return (
    <div className="w-full pt-10 animate-pulse">
      <div className="h-7 w-40 bg-zinc-200 dark:bg-zinc-800 rounded mb-6" />
      <div className="grid gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3"
          >
            <div className="w-5 h-5 rounded bg-zinc-200 dark:bg-zinc-800 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="h-4 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded mb-1" />
              <div className="h-3 w-1/3 bg-zinc-200 dark:bg-zinc-800 rounded" />
            </div>
            <div className="h-4 w-8 bg-zinc-200 dark:bg-zinc-800 rounded shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Featured collections carousel — server-side fetch */
async function FeaturedCollections() {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return null; // silently skip if Supabase is down
  }

  const { data: collections } = await supabase
    .from('collections')
    .select('id, name, slug, profiles(username, display_name)')
    .order('created_at', { ascending: false })
    .limit(6);

  if (!collections || collections.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-6 pb-20">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">Featured Collections</h2>
        <Link
          href="/collections"
          className="text-sm font-medium text-amber-600 dark:text-amber-400 hover:underline"
        >
          View all →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {collections.map((col) => {
          const owner = col.profiles as unknown as { username: string; display_name: string } | null;
          return (
            <Link
              key={col.id}
              href={`/collections/${col.slug}`}
              className="flex flex-col justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors group"
            >
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-white group-hover:underline">
                  {col.name}
                </h3>
                {owner && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    by {owner.display_name || owner.username}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

