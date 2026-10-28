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
    <div className="flex flex-col items-center px-6 py-24 text-center bg-screen">
      <div className="max-w-3xl mx-auto flex flex-col gap-16">
        {/* Hero */}
        <section className="flex flex-col items-center gap-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-ink">
            Roam for your browser
          </h1>
          <p className="text-lg text-muted max-w-xl leading-relaxed">
            One click from anywhere on the web sends you somewhere new —
            curated by community ratings, filtered by your interests.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <a
              href={EXTENSION_URLS.chrome}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              Add to Chrome
            </a>
            <a
              href={EXTENSION_URLS.firefox}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              Add to Firefox
            </a>
          </div>
        </section>

        {/* How it works */}
        <section className="text-left">
          <h2 className="text-2xl font-bold text-ink mb-6 text-center">
            How it works
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="rounded-xl border border-line p-5"
              >
                <div className="text-xs font-semibold text-gold uppercase tracking-wider mb-2">
                  Step {i + 1}
                </div>
                <h3 className="font-semibold text-ink mb-1">
                  {step.title}
                </h3>
                <p className="text-sm text-muted leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="flex flex-col items-center gap-4">
          <p className="text-lg text-muted">
            Prefer your phone?
          </p>
          <Link
            href="/android"
            className="btn btn-secondary"
          >
            Get the Android app
          </Link>
        </section>
      </div>
    </div>
  );
}
