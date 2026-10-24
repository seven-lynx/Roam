import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Changelog — What's New in Roam",
  description:
    "Notable updates to Roam across the Android app, browser extension, and web.",
};

type Entry = { version: string; date: string; items: string[] };

const ANDROID_ENTRIES: Entry[] = [
  {
    version: "1.2.1",
    date: "2026-10-10",
    items: [
      "Full-screen celebration animations for badge unlocks, level-ups, and challenge completions.",
      "Sound effects and a new “Feedback & Effects” settings screen for sounds, haptics, and celebrations.",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-08-05",
    items: [
      "Daily challenges with XP rewards and real-time progress tracking.",
      "Faster discovery (algorithm v31–v35) with significantly fewer false “you've seen everything” states.",
    ],
  },
  {
    version: "1.1.9",
    date: "2026-07-29",
    items: [
      "Discovery algorithm v29+v30: broader coverage, domain cooldowns, and serendipity mode.",
      "Collections load on demand, and the last viewed URL survives process restarts.",
    ],
  },
];

const WEB_ENTRIES: Entry[] = [
  {
    version: "Web",
    date: "2026",
    items: [
      "Tag-based topics: 200+ interest tags power personalization and discovery.",
      "Challenge system and weekly/monthly/all-time leaderboards.",
      "Badge gallery with 150+ badges and leveling.",
      "Public profiles, follows, activity feed, and shareable collections.",
      "Browser extension for Chrome and Firefox.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="flex flex-col items-center px-6 py-24 text-center bg-white dark:bg-zinc-950">
      <div className="max-w-3xl mx-auto flex flex-col gap-16">
        {/* Hero */}
        <section className="flex flex-col items-center gap-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Changelog
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-xl leading-relaxed">
            A summary of notable updates across the Roam Android app, browser
            extension, and web. For the full commit history, see{' '}
            <a
              href="https://github.com/seven-lynx/Roam"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              GitHub
            </a>
            .
          </p>
        </section>

        {/* Android */}
        <section className="text-left">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">Android app</h2>
          <div className="flex flex-col gap-4">
            {ANDROID_ENTRIES.map((entry) => (
              <div
                key={entry.version}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-zinc-900 dark:text-white">
                    v{entry.version}
                  </h3>
                  <span className="text-xs text-zinc-400">{entry.date}</span>
                </div>
                <ul className="text-sm text-zinc-600 dark:text-zinc-300 space-y-1.5 list-disc list-inside">
                  {entry.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Web & extension */}
        <section className="text-left">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">
            Web &amp; extension
          </h2>
          <div className="flex flex-col gap-4">
            {WEB_ENTRIES.map((entry) => (
              <div
                key={entry.version}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-zinc-900 dark:text-white">
                    {entry.version}
                  </h3>
                  <span className="text-xs text-zinc-400">{entry.date}</span>
                </div>
                <ul className="text-sm text-zinc-600 dark:text-zinc-300 space-y-1.5 list-disc list-inside">
                  {entry.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="flex flex-col items-center gap-4">
          <p className="text-lg text-zinc-600 dark:text-zinc-300">
            Want the newest features first?
          </p>
          <Link
            href="/extensions"
            className="inline-flex items-center justify-center rounded-full bg-zinc-900 dark:bg-white px-8 py-3 text-white dark:text-zinc-900 font-semibold text-base hover:opacity-90 transition-opacity"
          >
            Get the extension
          </Link>
        </section>
      </div>
    </div>
  );
}
