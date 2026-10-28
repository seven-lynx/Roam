import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getHomeStats, type HomeStats } from "@/lib/home-stats";
import { formatCount } from "@/lib/format";
import { SiteShowcase } from "@/components/SiteShowcase";
import { TopSites } from "@/components/TopSites";
import { AuthErrorBanner } from "@/components/AuthErrorBanner";
import { RandomPageButton } from "@/components/RandomPageButton";
import { ChallengeWidget } from "@/components/challenges/ChallengeWidget";
import { BuyMeACoffeeButton } from "@/components/BuyMeACoffeeButton";
import { GlitchText } from "@/components/GlitchText";
import { RadarSweep } from "@/components/RadarSweep";

const STEPS = [
  { step: "01", icon: "🎯", title: "Pick your interests", desc: "Select categories that match what you care about. Your discovery feed becomes personal." },
  { step: "02", icon: "🔄", title: "Get a random page", desc: "Tap the Roam button in your browser or Android app. One click = one new page, every time." },
  { step: "03", icon: "⭐", title: "Rate and refine", desc: "👍 or 👎 to tell Roam what you like. Your votes shape what you see next." },
];

const FEATURES = [
  { icon: "🎯", title: "Your interests", desc: "Select categories that match what you care about. Discovery is personalized, not algorithmic." },
  { icon: "⭐", title: "Real ratings", desc: "Pages are ranked by genuine user votes, not engagement metrics or ad revenue." },
  { icon: "🚫", title: "No feeds", desc: "One button = one page. No infinite scrolling, no rabbit holes, no notifications." },
  { icon: "🌐", title: "Community-curated", desc: "Real people submit and rate pages. The best content rises; the noise disappears." },
];

export default async function Home() {
  let user: null | { id: string } = null;
  let stats: HomeStats | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user ?? null;
    stats = await getHomeStats();
  } catch {
    // Supabase unavailable
  }

  const counters = stats
    ? [
        { label: "Curated URLs", value: formatCount(stats.activeUrls) },
        { label: "Topics", value: formatCount(stats.activeTags) },
        { label: "Page ratings", value: formatCount(stats.totalRatings) },
        { label: "Pages discovered", value: formatCount(stats.totalServes) },
        { label: "Explorers", value: formatCount(stats.totalUsers) },
      ]
    : [
        { label: "Curated URLs", value: "1.6 million" },
        { label: "Topics", value: "72+" },
        { label: "Page ratings", value: "4.2 million" },
      ];

  return (
    <>
      <Suspense fallback={null}><AuthErrorBanner /></Suspense>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 pt-20 pb-16 md:pt-28 md:pb-24">
          <div className="flex flex-col lg:flex-row items-center gap-14">
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 tag mb-6">
                <span className="led animate-pulse" />
                Wanderer&rsquo;s workstation · live
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-ink leading-tight">
                Scan the <GlitchText text="forgotten web" />
              </h1>
              <p className="mt-5 text-lg text-muted max-w-lg mx-auto lg:mx-0 leading-relaxed">
                Roam is a wanderer&rsquo;s terminal for the dead internet. One press
                scans a random corner of the old web — curated by real
                ratings, filtered by your interests. No feeds, no noise.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mt-8 justify-center lg:justify-start">
                {user ? (
                  <>
                    <Link href="/profile" className="btn btn-primary">Go to profile</Link>
                    <Link href="/how-it-works" className="btn btn-secondary">How it works →</Link>
                  </>
                ) : (
                  <>
                    <Link href="/signup" className="btn btn-primary">Begin scanning</Link>
                    <a href="#downloads" className="btn btn-secondary">Get the extension ↓</a>
                  </>
                )}
              </div>

              <div className="mt-12 flex flex-wrap items-start justify-center lg:justify-start gap-x-10 gap-y-6">
                {counters.map((c) => (
                  <div key={c.label} className="text-center lg:text-left">
                    <div className="font-mono text-2xl phosphor tabular-nums">{c.value}</div>
                    <div className="kicker mt-1">{c.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-full max-w-md lg:max-w-lg shrink-0">
              <Suspense fallback={<ShowcaseSkeleton />}><SiteShowcase /></Suspense>
              <div className="flex items-center justify-center mt-8"><RadarSweep /></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center mb-12">
          <div className="kicker mb-2">[ field manual ]</div>
          <h2 className="text-3xl font-bold text-ink">How it works</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((item) => (
            <div key={item.step} className="text-center panel p-6 card-hover">
              <div className="text-4xl mb-4">{item.icon}</div>
              <div className="kicker mb-2">step {item.step}</div>
              <h3 className="text-lg font-semibold text-ink mb-2">{item.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {user && (
        <section className="max-w-6xl mx-auto px-6 pb-20">
          <div className="panel p-8 md:p-10 flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold text-ink mb-2">Found something worth sharing?</h2>
              <p className="text-muted max-w-md">Submit a page to our community-curated catalog. Real people review every submission to keep quality high.</p>
            </div>
            <Link href="/submit" className="btn btn-primary shrink-0"><span className="text-lg">+</span> Submit a URL</Link>
          </div>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-6 pb-20">
        <Suspense fallback={<TopSitesSkeleton />}><TopSites userId={user?.id} /></Suspense>
        <ChallengeWidget />
      </section>

      <Suspense fallback={null}><FeaturedCollections /></Suspense>

      {/* ── Downloads ── */}
      <section id="downloads" className="max-w-6xl mx-auto px-6 pb-20 scroll-mt-20">
        <div className="text-center mb-10">
          <div className="kicker mb-2">[ equipment ]</div>
          <h2 className="text-3xl font-bold text-ink">Get the app</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="panel p-8 card-hover">
            <div className="flex items-start gap-4">
              <span className="text-3xl">🌐</span>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-ink">Browser Extension</h3>
                <p className="text-sm text-muted mt-1 leading-relaxed">Click the Roam button while browsing to discover new pages. Rate with 👍👎 to personalize your recommendations.</p>
                <div className="flex gap-3 mt-4">
                  <a href="https://chromewebstore.google.com/detail/ojgphkdgkefokhjnojkddhalnlbajfpc?utm_source=roam-web" target="_blank" rel="noopener noreferrer" className="btn btn-primary text-sm">Chrome</a>
                  <a href="https://addons.mozilla.org/firefox/addon/roam-the-web/" target="_blank" rel="noopener noreferrer" className="btn btn-secondary text-sm">Firefox</a>
                </div>
              </div>
            </div>
          </div>
          <div className="panel p-8 card-hover">
            <div className="flex items-start gap-4">
              <span className="text-3xl">📱</span>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-ink">Android App</h3>
                <p className="text-sm text-muted mt-1 leading-relaxed">Swipe to discover. Tap to save. Read offline. The full Roam experience in your pocket.</p>
                <div className="mt-4">
                  <a href="https://play.google.com/store/apps/details?id=app.roam.android" target="_blank" rel="noopener noreferrer" className="btn btn-primary text-sm">Download on Google Play</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why Roam ── */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center mb-10">
          <div className="kicker mb-2">[ field notes ]</div>
          <h2 className="text-3xl font-bold text-ink">Why Roam?</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {FEATURES.map((item) => (
            <div key={item.title} className="flex items-start gap-4 panel p-5 card-hover">
              <span className="text-2xl shrink-0">{item.icon}</span>
              <div>
                <h3 className="font-semibold text-ink mb-1">{item.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Support ── */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="panel p-8 md:p-10 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-ink mb-2">Support Roam</h2>
            <p className="text-muted leading-relaxed max-w-xl mx-auto md:mx-0">
              Roam is free, open source, and ad-free. If it&rsquo;s helped you discover something new, help keep it running.
            </p>
            <Link href="/support-roam" className="inline-block mt-2 text-sm font-medium text-gold hover:underline">See our running costs →</Link>
          </div>
          <BuyMeACoffeeButton />
        </div>
      </section>

      {!user && (
        <section className="max-w-6xl mx-auto px-6 pb-20 text-center">
          <div className="panel p-10">
            <h2 className="text-2xl font-bold text-ink mb-3">Ready to explore?</h2>
            <p className="text-muted mb-6 max-w-md mx-auto">Sign up to get personalised recommendations, or try a random curated page right now.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/signup" className="btn btn-primary">Get started</Link>
              <RandomPageButton />
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function TopSitesSkeleton() {
  return (
    <div className="w-full pt-10 animate-pulse">
      <div className="h-7 w-40 bg-panel-3 mb-6" />
      <div className="grid gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 panel px-4 py-3">
            <div className="w-5 h-5 bg-panel-3 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="h-4 w-3/4 bg-panel-3 mb-1" />
              <div className="h-3 w-1/3 bg-panel-3" />
            </div>
            <div className="h-4 w-8 bg-panel-3 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ShowcaseSkeleton() {
  return (
    <div className="animate-pulse panel p-6">
      <div className="aspect-video bg-panel-3 mb-4" />
      <div className="h-5 w-3/4 bg-panel-3 mb-2" />
      <div className="h-4 w-1/3 bg-panel-3" />
    </div>
  );
}

async function FeaturedCollections() {
  let supabase;
  try { supabase = await createClient(); } catch { return null; }
  const { data: collections } = await supabase
    .from('collections')
    .select('id, name, slug, profiles(username, display_name)')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(6);
  if (!collections || collections.length === 0) return null;
  return (
    <section className="max-w-6xl mx-auto px-6 pb-20">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-ink">Featured Collections</h2>
        <Link href="/collections" className="text-sm font-medium text-gold hover:underline">View all →</Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {collections.map((col) => {
          const owner = col.profiles as unknown as { username: string; display_name: string } | null;
          return (
            <Link key={col.id} href={`/collections/${col.slug}`} className="panel p-5 hover:bg-panel-2 transition-colors group">
              <div>
                <h3 className="text-base font-semibold text-ink group-hover:underline">{col.name}</h3>
                {owner && <p className="text-xs text-muted mt-1">by {owner.display_name || owner.username}</p>}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}



