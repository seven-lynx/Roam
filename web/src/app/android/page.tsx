import type { Metadata } from "next";
import Link from "next/link";
import { EXTENSION_URLS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Android App — Roam in Your Pocket",
  description:
    "Download the Roam Android app from Google Play. Swipe to discover, tap to save, and read offline.",
};

const FEATURES = [
  {
    icon: "🔄",
    title: "Swipe to discover",
    desc: "Swipe through a queue of curated pages, prefetched so discovery feels instant.",
  },
  {
    icon: "💾",
    title: "Save & read offline",
    desc: "Save pages to collections and read them later, even without a connection.",
  },
  {
    icon: "👍",
    title: "Rate on the go",
    desc: "Thumbs up or down to personalize what you see next.",
  },
  {
    icon: "🏆",
    title: "Challenges & badges",
    desc: "Earn XP, unlock badges, and climb the leaderboard right from your phone.",
  },
];

export default function AndroidPage() {
  return (
    <div className="flex flex-col items-center px-6 py-24 text-center bg-screen">
      <div className="max-w-3xl mx-auto flex flex-col gap-16">
        {/* Hero */}
        <section className="flex flex-col items-center gap-4">
          <div className="text-6xl">📱</div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-ink">
            Roam for Android
          </h1>
          <p className="text-lg text-muted max-w-xl leading-relaxed">
            The full Roam experience in your pocket — swipe to discover, tap to
            save, and read offline with an in-app browser.
          </p>
          <a
            href={EXTENSION_URLS.android}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary mt-2"
          >
            Download on Google Play
          </a>
        </section>

        {/* Features */}
        <section className="text-left">
          <div className="grid sm:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex items-start gap-4 rounded-xl border border-line p-5"
              >
                <span className="text-2xl shrink-0">{f.icon}</span>
                <div>
                  <h3 className="font-semibold text-ink mb-1">
                    {f.title}
                  </h3>
                  <p className="text-sm text-muted leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="flex flex-col items-center gap-4">
          <p className="text-lg text-muted">
            Want to know what changed recently?
          </p>
          <Link
            href="/changelog"
            className="btn btn-secondary"
          >
            View the changelog
          </Link>
        </section>
      </div>
    </div>
  );
}
