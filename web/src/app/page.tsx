"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import FeedbackWidget from "@/components/FeedbackWidget";
import { createClient } from "@/lib/supabase/client";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Header />
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-24 text-center bg-white dark:bg-zinc-950">
      <div className="max-w-2xl mx-auto flex flex-col items-center gap-10">
        {/* Logo / wordmark */}
        <div className="flex flex-col items-center gap-3">
          <Image src="/icon-512.png" alt="Roam logo" width={80} height={80} priority />
          <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Roam
          </h1>
          <p className="text-xl text-zinc-500 dark:text-zinc-400">
            Discover a random corner of the web.
          </p>
        </div>

        {/* Description */}
        <p className="text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-lg">
          Roam is a community-driven web discovery platform. Every tap or click sends you somewhere new — curated by real ratings, filtered by your interests. No algorithms, no feeds, no noise.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Link
            href="/join"
            className="flex items-center justify-center rounded-full bg-zinc-900 dark:bg-white px-8 py-3 text-white dark:text-zinc-900 font-semibold text-base hover:opacity-90 transition-opacity"
          >
            Get started
          </Link>
          <a
            href="#get-the-app"
            className="flex items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-700 px-8 py-3 text-zinc-800 dark:text-zinc-200 font-semibold text-base hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          >
            Browser extension ↓
          </a>
        </div>

        {/* Downloads */}
        <div
          id="get-the-app"
          className="w-full border-t border-zinc-200 dark:border-zinc-800 pt-10 mt-4 grid sm:grid-cols-2 gap-6 text-left"
        >
          <div className="flex flex-col gap-2">
            <h2 className="font-semibold text-zinc-900 dark:text-white text-lg">
              Browser extension
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm">
              Click the roam button while browsing to discover new pages. Rate pages with 👍👎 to personalize your recommendations.
            </p>
            <div className="flex gap-2 mt-auto">
              {/* Chrome extension link: coming soon once published to Web Store */}
              {false ? (
                <a
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm font-semibold"
                >
                  Chrome →
                </a>
              ) : (
                <span className="text-zinc-400 text-sm">Chrome (coming soon)</span>
              )}
              <a
                href="https://addons.mozilla.org/firefox/addon/roam/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm font-semibold"
              >
                Firefox →
              </a>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="font-semibold text-zinc-900 dark:text-white text-lg">
              Android app
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm">
              Swipe to discover. Tap to save. Read offline. The full Roam experience in your pocket.
            </p>
            <div className="flex gap-2 mt-auto">
              <a
                href="https://play.google.com/store/apps/details?id=com.roam"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm font-semibold"
              >
                Google Play →
              </a>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="w-full border-t border-zinc-200 dark:border-zinc-800 pt-10 mt-4">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-8">Why Roam?</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="text-left">
              <div className="text-3xl mb-3">🎯</div>
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">Your interests</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Select categories that match what you care about. Discovery is personalized, not algorithmic.
              </p>
            </div>
            <div className="text-left">
              <div className="text-3xl mb-3">⭐</div>
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">Real ratings</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Pages are ranked by genuine user votes, not engagement metrics or ad revenue.
              </p>
            </div>
            <div className="text-left">
              <div className="text-3xl mb-3">🚫</div>
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">No feeds</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                One button = one page. No infinite scrolling, no rabbit holes, no notifications.
              </p>
            </div>
            <div className="text-left">
              <div className="text-3xl mb-3">👥</div>
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">Community</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Follow friends, discover what they're reading, and share collections.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="w-full border-t border-zinc-200 dark:border-zinc-800 pt-10 mt-4 flex justify-center items-center text-sm text-zinc-600 dark:text-zinc-400">
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-white">
              Terms
            </Link>
            <a href="https://github.com/seito/roam" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900 dark:hover:text-white">
              GitHub
            </a>
          </div>
        </div>
      </div>

      <FeedbackWidget />
    </main>
    </>
  );
}
