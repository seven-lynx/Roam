import Link from "next/link";
import Image from "next/image";
import FeedbackWidget from "@/components/FeedbackWidget";

export default function Home() {
  return (
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
          Roam is a StumbleUpon-style web discovery engine. Every tap or click
          sends you somewhere new — curated by real ratings, filtered by your
          interests.
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
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              Hit Roam from your toolbar. Works in Chrome and Firefox.
            </p>
            <span className="mt-2 text-sm text-zinc-400 italic">Coming soon</span>
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="font-semibold text-zinc-900 dark:text-white text-lg">
              Android app
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              Swipe through the web on mobile.
            </p>
            <span className="mt-2 text-sm text-zinc-400 italic">Coming soon</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-24 flex gap-6 text-sm text-zinc-400 dark:text-zinc-600">
        <Link href="/privacy" className="hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors">
          Terms
        </Link>
        <a
          href="https://github.com/seven-lynx/Roam"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
        >
          GitHub
        </a>
        <FeedbackWidget />
      </footer>
    </main>
  );
}
