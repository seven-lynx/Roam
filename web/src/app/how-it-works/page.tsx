import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How Roam Works — Rediscover the Web",
  description:
    "Roam balances community quality, editorial signal, your taste, freshness, and exploration to pick pages you'll enjoy. No algorithms, no feeds, no noise.",
};

export default function HowItWorks() {
  return (
    <div className="flex flex-col items-center px-6 py-24 text-center bg-white dark:bg-zinc-950">
      <div className="max-w-3xl mx-auto flex flex-col gap-16">
        {/* Hero */}
        <section className="flex flex-col items-center gap-6">
          <Image
            src="/icon-512.png"
            alt="Roam logo"
            width={64}
            height={64}
            priority
          />
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
            How Roam Works
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-xl leading-relaxed">
            One button. One page. A discovery engine that balances community
            quality, your taste, and serendipity — without any algorithmic feed.
          </p>
        </section>

        {/* The basics */}
        <section className="text-left">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">
            The basics
          </h2>
          <div className="grid gap-5 text-zinc-600 dark:text-zinc-300 leading-relaxed">
            <div className="flex gap-3">
              <span className="text-2xl shrink-0">🔘</span>
              <p>
                <strong className="text-zinc-900 dark:text-white">
                  Press the button.
                </strong>{" "}
                In the browser extension or mobile app, tap &ldquo;Roam&rdquo; and
                land on a real page curated by real people.
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-2xl shrink-0">👍</span>
              <p>
                <strong className="text-zinc-900 dark:text-white">
                  Rate what you see.
                </strong>{" "}
                Thumbs up or down on any page. Your votes shape what you see
                next and help the community surface great content.
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-2xl shrink-0">💾</span>
              <p>
                <strong className="text-zinc-900 dark:text-white">
                  Save for later.
                </strong>{" "}
                Found something worth keeping? Save it to a collection. Read
                offline on Android, or revisit anytime.
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-2xl shrink-0">🔁</span>
              <p>
                <strong className="text-zinc-900 dark:text-white">
                  Roam again.
                </strong>{" "}
                Each press sends you somewhere new. The hot queue pre-fetches
                pages so discovery feels instant.
              </p>
            </div>
          </div>
        </section>

        {/* The algorithm */}
        <section className="text-left">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">
            How the algorithm picks a page
          </h2>
          <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-6">
            The discovery function runs directly in PostgreSQL. When you press
            the button, it balances five independent signals to pick a page
            you&rsquo;ll likely enjoy:
          </p>
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <div className="text-2xl mb-2">🏆</div>
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">
                Community quality
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Statistically-correct ranking (Wilson score) that handles small
                vote counts fairly. A page with 10/10 upvotes ranks accurately
                against one with 800/1000.
              </p>
            </div>
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <div className="text-2xl mb-2">📰</div>
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">
                Editorial signal
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Source reputation — HN score, citation count, Reddit karma, and
                more — gives an independent quality baseline before any Roam
                user even votes.
              </p>
            </div>
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <div className="text-2xl mb-2">🎯</div>
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">
                Your taste
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Topics you upvote appear more often (up to 2× weight).
                Downvoting doesn&rsquo;t hide a topic — it just dials the weight
                back slightly. Calibrated per subcategory.
              </p>
            </div>
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <div className="text-2xl mb-2">🕐</div>
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">
                Freshness
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Recently published pages get a mild boost; very old ones fade
                gradually. You won&rsquo;t get stale content, but timeless gems
                still surface.
              </p>
            </div>
          </div>
          <div className="mt-5 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
            <div className="text-2xl mb-2">🎲</div>
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">
              Exploration bonus
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Newly seeded pages receive a small boost to keep fresh content
              circulating. A 12% chance of an adjacent topic in discovery mode
              adds intentional serendipity.
            </p>
          </div>
        </section>

        {/* Personalization */}
        <section className="text-left">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">
            How personalization works
          </h2>
          <div className="grid sm:grid-cols-2 gap-5 text-zinc-600 dark:text-zinc-300">
            <div className="flex gap-3">
              <span className="text-2xl shrink-0">🎚️</span>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">
                  Topic affinity
                </h3>
                <p className="text-sm leading-relaxed">
                  Your upvotes and downvotes calibrate how often each
                  subcategory appears. Fine-grained — the system tracks
                  preferences across 70+ subcategories like Science, Art, and
                  Gaming.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-2xl shrink-0">🔇</span>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">
                  Domain muting
                </h3>
                <p className="text-sm leading-relaxed">
                  Two downvotes from the same domain triggers a 30-day
                  auto-mute. That site won&rsquo;t appear again until the
                  cooldown expires.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-2xl shrink-0">⏱️</span>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">
                  Domain cooldown
                </h3>
                <p className="text-sm leading-relaxed">
                  A 30-minute per-session cooldown prevents seeing the same site
                  twice in a row, keeping discovery diverse.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-2xl shrink-0">🎯</span>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">
                  Focus & collection modes
                </h3>
                <p className="text-sm leading-relaxed">
                  Narrow discovery to specific categories with Focus mode, or
                  browse within a saved collection with Collection mode.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Community */}
        <section className="text-left">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">
            The community layer
          </h2>
          <div className="grid gap-4 text-zinc-600 dark:text-zinc-300 leading-relaxed">
            <div className="flex gap-3">
              <span className="text-2xl shrink-0">📤</span>
              <p>
                <strong className="text-zinc-900 dark:text-white">
                  Submit pages.
                </strong>{" "}
                Anyone can submit a URL. It goes through a moderation queue with
                duplicate detection before entering the discovery pool.
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-2xl shrink-0">📊</span>
              <p>
                <strong className="text-zinc-900 dark:text-white">
                  Wilson score ranking.
                </strong>{" "}
                Every vote recalculates the page&rsquo;s community score
                automatically. No cron jobs, no batch processing — rankings are
                always live.
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-2xl shrink-0">📂</span>
              <p>
                <strong className="text-zinc-900 dark:text-white">
                  Public and private collections.
                </strong>{" "}
                Curate lists that others can follow, or keep them to yourself.
              </p>
            </div>
              <div className="flex gap-3">
              <span className="text-2xl shrink-0">👥</span>
              <p>
                <strong className="text-zinc-900 dark:text-white">
                  Follow users.
                </strong>{" "}
                See their public collections, interests, and profile on Roam.
                Discover new curators through the people you follow.
              </p>
            </div>
          </div>
        </section>

        {/* Platforms */}
        <section className="text-left">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">
            Where you can roam
          </h2>
          <div className="grid sm:grid-cols-3 gap-5">
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <div className="text-3xl mb-3">🧩</div>
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
                Browser extension
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
                Click the roam button while browsing to discover new pages. Rate
                pages with 👍👎 to personalize your recommendations. Deliberately
                non-intrusive — nothing is injected into pages you visit.
              </p>
              <div className="flex gap-2">
                <a
                  href="https://chromewebstore.google.com/detail/ojgphkdgkefokhjnojkddhalnlbajfpc?utm_source=item-share-cb"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm font-semibold"
                >
                  Chrome →
                </a>
                <a
                  href="https://addons.mozilla.org/firefox/addon/roam-the-web/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm font-semibold"
                >
                  Firefox →
                </a>
              </div>
            </div>
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <div className="text-3xl mb-3">📱</div>
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
                Android app
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
                Swipe to discover. Tap to save. Read offline. The full Roam
                experience in your pocket with an in-app browser.
              </p>
              <span className="text-sm text-zinc-400 font-semibold">
                Coming soon to Google Play
              </span>
            </div>
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <div className="text-3xl mb-3">🌐</div>
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
                Web
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Manage your account, set your interests, browse collections, and
                moderate submissions — all from the web dashboard.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="text-left">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">
            Frequently asked questions
          </h2>

          <details className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 mb-3 group">
            <summary className="font-medium text-zinc-900 dark:text-white cursor-pointer list-none">
              <span className="mr-2 text-zinc-400 group-open:hidden">→</span>
              <span className="mr-2 text-zinc-400 hidden group-open:inline">↓</span>
              Why did I see the same page twice?
            </summary>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Roam tracks pages you&rsquo;ve seen and excludes them for 30 days. If you saw
              the same page twice in one session, it may have come from a different URL
              (e.g., with/without www). Report it via the feedback form and we&rsquo;ll
              investigate.
            </p>
          </details>

          <details className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 mb-3 group">
            <summary className="font-medium text-zinc-900 dark:text-white cursor-pointer list-none">
              <span className="mr-2 text-zinc-400 group-open:hidden">→</span>
              <span className="mr-2 text-zinc-400 hidden group-open:inline">↓</span>
              How do I stop seeing a particular site?
            </summary>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Downvote two pages from the same domain and it&rsquo;s automatically muted for
              30 days. You can also enable &ldquo;Skip paywalled sites&rdquo; in Settings to
              hide NYT, WSJ, and similar publications entirely.
            </p>
          </details>

          <details className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 mb-3 group">
            <summary className="font-medium text-zinc-900 dark:text-white cursor-pointer list-none">
              <span className="mr-2 text-zinc-400 group-open:hidden">→</span>
              <span className="mr-2 text-zinc-400 hidden group-open:inline">↓</span>
              How do I submit a URL?
            </summary>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Click &ldquo;Submit URL&rdquo; from your profile, or use the 👍 button on an
              unknown page in the browser extension or Android app. All submissions go
              through moderation before appearing in the discovery pool. Max 10 per hour.
            </p>
          </details>

          <details className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 mb-3 group">
            <summary className="font-medium text-zinc-900 dark:text-white cursor-pointer list-none">
              <span className="mr-2 text-zinc-400 group-open:hidden">→</span>
              <span className="mr-2 text-zinc-400 hidden group-open:inline">↓</span>
              What happens if I downvote everything?
            </summary>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Downvoting doesn&rsquo;t block topics — it just slightly reduces how often
              they appear (the weight goes from 1× to 0.8×). If you truly dislike a site,
              two downvotes from the same domain mutes it for 30 days.
            </p>
          </details>

          <details className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 mb-3 group">
            <summary className="font-medium text-zinc-900 dark:text-white cursor-pointer list-none">
              <span className="mr-2 text-zinc-400 group-open:hidden">→</span>
              <span className="mr-2 text-zinc-400 hidden group-open:inline">↓</span>
              Is Roam really open source?
            </summary>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Yes — the source code for the website, browser extension, and Android app is
              available under the MIT license on{' '}
              <a
                href="https://github.com/seven-lynx/Roam"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                GitHub
              </a>
              . The URL catalogue and ratings database are not public (that&rsquo;s the
              secret sauce), but the code that powers discovery is fully open.
            </p>
          </details>

          <details className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 mb-3 group">
            <summary className="font-medium text-zinc-900 dark:text-white cursor-pointer list-none">
              <span className="mr-2 text-zinc-400 group-open:hidden">→</span>
              <span className="mr-2 text-zinc-400 hidden group-open:inline">↓</span>
              Can I use Roam without an account?
            </summary>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              You can browse public collections and profiles without an account, but to roam
              (discover pages), rate content, save URLs, or create collections you&rsquo;ll
              need to sign up. It&rsquo;s free and takes about 30 seconds.
            </p>
          </details>
        </section>

        {/* CTA */}
        <section className="flex flex-col items-center gap-5 border-t border-zinc-200 dark:border-zinc-800 pt-10">
          <p className="text-lg text-zinc-600 dark:text-zinc-300">
            Ready to discover something new?
          </p>
          <Link
            href="/join"
            className="inline-flex items-center justify-center rounded-full bg-zinc-900 dark:bg-white px-8 py-3 text-white dark:text-zinc-900 font-semibold text-base hover:opacity-90 transition-opacity"
          >
            Get started
          </Link>
        </section>
      </div>
    </div>
  );
}