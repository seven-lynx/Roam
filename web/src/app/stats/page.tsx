import type { Metadata } from "next";
import Link from "next/link";
import { getHomeStats } from "@/lib/home-stats";
import { formatCount } from "@/lib/format";

export const metadata: Metadata = {
  title: "Stats — Roam by the Numbers",
  description:
    "Live community stats for Roam: total users, curated URLs, topics, ratings, and pages discovered.",
};

const PILLARS = [
  { icon: "🔬", label: "Science & Nature" },
  { icon: "💻", label: "Technology" },
  { icon: "🎨", label: "Arts & Culture" },
  { icon: "📜", label: "History & Ideas" },
  { icon: "🎮", label: "Games & Hobbies" },
  { icon: "🌀", label: "Weird & Wonderful" },
  { icon: "🌍", label: "People & Places" },
  { icon: "🧠", label: "Mind & Body" },
];

export default async function StatsPage() {
  let stats = null;
  try {
    stats = await getHomeStats();
  } catch {
    // Supabase unavailable — render the page without live numbers.
  }

  const counters = stats
    ? [
        { label: "Total users", value: formatCount(stats.totalUsers), hint: "Registered members" },
        { label: "Curated URLs", value: formatCount(stats.activeUrls), hint: "Active pages in the discovery pool" },
        { label: "Topics", value: formatCount(stats.activeTags), hint: "Interest tags powering personalization" },
        { label: "Total page ratings", value: formatCount(stats.totalRatings), hint: "Community votes that rank content" },
        { label: "Pages discovered", value: formatCount(stats.totalServes), hint: "Times a page has been served" },
      ]
    : null;

  return (
    <div className="flex flex-col items-center px-6 py-24 text-center bg-white dark:bg-zinc-950">
      <div className="max-w-3xl mx-auto flex flex-col gap-16">
        {/* Hero */}
        <section className="flex flex-col items-center gap-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Roam by the numbers
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-xl leading-relaxed">
            A community-curated corner of the web, measured by real people and
            real votes — not engagement metrics.
          </p>
        </section>

        {/* Counters */}
        {counters ? (
          <section>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {counters.map((c) => (
                <div
                  key={c.label}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col items-center gap-1"
                >
                  <div className="text-3xl font-bold text-zinc-900 dark:text-white">{c.value}</div>
                  <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{c.label}</div>
                  <div className="text-xs text-zinc-400">{c.hint}</div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-zinc-400">Updated daily.</p>
          </section>
        ) : (
          <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 text-sm text-zinc-500 dark:text-zinc-400">
            Live stats are temporarily unavailable. Please check back shortly.
          </section>
        )}

        {/* Topics */}
        <section className="text-left">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4 text-center">
            Eight pillars, thousands of rabbit holes
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PILLARS.map((p) => (
              <div
                key={p.label}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col items-center gap-2 text-center"
              >
                <span className="text-2xl">{p.icon}</span>
                <span className="text-xs text-zinc-600 dark:text-zinc-300">{p.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="flex flex-col items-center gap-4">
          <p className="text-lg text-zinc-600 dark:text-zinc-300">
            Want to be part of the numbers?
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-full bg-zinc-900 dark:bg-white px-8 py-3 text-white dark:text-zinc-900 font-semibold text-base hover:opacity-90 transition-opacity"
          >
            Get started
          </Link>
        </section>
      </div>
    </div>
  );
}
