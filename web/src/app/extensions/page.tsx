import type { Metadata } from "next";
import Link from "next/link";
import { EXTENSION_URLS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Browser Extension — Roam for Chrome & Firefox",
  description:
    "Install the Roam browser extension for Chrome or Firefox and discover a random corner of the web with one click.",
};

const STEPS = [
  {
    title: "Install the extension",
    desc: "Add Roam from the Chrome Web Store or Firefox Add-ons. It takes seconds.",
  },
  {
    title: "Sign in",
    desc: "Link your Roam account so your ratings and interests sync across devices.",
  },
  {
    title: "Click Roam",
    desc: "Hit the Roam button while browsing and land on a real page curated by real people.",
  },
  {
    title: "Rate what you see",
    desc: "👍 or 👎 on any page to shape what you discover next.",
  },
];

export default function ExtensionsPage() {
  return (
    <div className="flex flex-col items-center px-6 py-24 text-center bg-white dark:bg-zinc-950">
      <div className="max-w-3xl mx-auto flex flex-col gap-16">
        {/* Hero */}
        <section className="flex flex-col items-center gap-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Roam for your browser
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-xl leading-relaxed">
            One click from anywhere on the web sends you somewhere new —
            curated by community ratings, filtered by your interests.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <a
              href={EXTENSION_URLS.chrome}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-zinc-900 dark:bg-white px-8 py-3 text-white dark:text-zinc-900 font-semibold text-base hover:opacity-90 transition-opacity"
            >
              Add to Chrome
            </a>
            <a
              href={EXTENSION_URLS.firefox}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-700 px-8 py-3 text-zinc-800 dark:text-zinc-200 font-semibold text-base hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
            >
              Add to Firefox
            </a>
          </div>
        </section>

        {/* How it works */}
        <section className="text-left">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6 text-center">
            How it works
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5"
              >
                <div className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-2">
                  Step {i + 1}
                </div>
                <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">
                  {step.title}
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="flex flex-col items-center gap-4">
          <p className="text-lg text-zinc-600 dark:text-zinc-300">
            Prefer your phone?
          </p>
          <Link
            href="/android"
            className="inline-flex items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-700 px-8 py-3 text-zinc-800 dark:text-zinc-200 font-semibold text-base hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          >
            Get the Android app
          </Link>
        </section>
      </div>
    </div>
  );
}
