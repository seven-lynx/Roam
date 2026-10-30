import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Changelog — What's New in Roam",
  description:
    "Notable updates to Roam across the Android app, browser extension, web, and backend.",
};

type Entry = { version: string; date: string; items: string[] };

const ANDROID_ENTRIES: Entry[] = [
  {
    version: "1.4.0",
    date: "2026-10-29",
    items: [
      "Diegetic control deck — a handheld hardware chassis with a physical Roam/thumbs/nav key deck, latched keys, click sounds, and a mute/comms key pair.",
      "System readout — a scrolling message pager with READY/BUFFER queue LEDs, plus an e-ink style (default) and the original 7-segment LED as an option.",
      "Hardware customization — chassis/deck material textures (metal, plastic, wood, leather), deck layout/size/shape, button labels, and a bezel fisheye toggle.",
      "Separate OS (display/terminal) and hardware (chassis/deck) color schemes, a theme-locked launcher icon, and boot/standby animations.",
      "ROAM-OS is now the default theme, with Linux-flavored flavor text.",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-10-28",
    items: [
      "ROAM-OS theme — a retro-futuristic ROAM-OS handheld look with CRT scanlines, film grain, and a phosphor-teal and gold palette.",
      "Appearance settings — theme switcher (Roam Classic / ROAM-OS), device-frame toggle, and CRT-effects toggle.",
      "Boot/scan loading screen with themed messages and an OS status bar showing the current category, subcategory, and domain.",
    ],
  },
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

const EXTENSION_ENTRIES: Entry[] = [
  {
    version: "0.5.0",
    date: "2026-08-05",
    items: [
      "Faster discovery (algorithm v31–v35) with fewer false “you've seen everything” states.",
      "Prefetch focus-mode fix — category filters are now respected.",
      "Better badge text readability across all platforms.",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-07-29",
    items: [
      "Discovery algorithm v29+v30 with broader coverage and domain cooldowns.",
      "OAuth sign-in fixed on Chrome and Firefox.",
      "Chrome Web Store compliance and reduced Sentry noise.",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-06-06",
    items: [
      "Compact popup UI with inline notifications, browsing history, and stats.",
      "Prefetch validation and feature parity with Android.",
    ],
  },
];

const WEB_ENTRIES: Entry[] = [
  {
    version: "Workstation redesign",
    date: "2026-10-27",
    items: [
      "Retro-futuristic workstation landing page — interactive gadgets, boot sequence, radar sweep, glitch text, and ambient sound.",
      "New pages: /android, /extensions, /stats, /changelog, and /support-roam.",
      "Live community counters and a monthly showcase on the homepage.",
      "“Buy Me a Coffee” support button.",
    ],
  },
  {
    version: "Challenges",
    date: "2026-10-09",
    items: [
      "Challenges UI with daily challenges and consolidated rewards.",
    ],
  },
  {
    version: "Platform",
    date: "2026",
    items: [
      "Tag-based topics, challenge system and leaderboards, badge gallery, public profiles, follows, activity feed, and shareable collections.",
      "Browser extension for Chrome and Firefox.",
    ],
  },
];

const BACKEND_ENTRIES: Entry[] = [
  {
    version: "Tag graph & home stats",
    date: "2026-10-24",
    items: [
      "Tag graph schema with seeded tags, subcategory mappings, and backfilled URL tags.",
      "Home-stats materialized view powering the public community counters.",
    ],
  },
  {
    version: "Challenges",
    date: "2026-08-05",
    items: [
      "Challenge system with daily challenges, XP rewards, and real-time progress tracking.",
      "User-actions event table for engagement tracking.",
    ],
  },
  {
    version: "Discovery v31–v35",
    date: "2026-08-04",
    items: [
      "Inline scoring eliminates per-row sub-queries for dramatically faster discovery.",
      "Hoisted domain checks and recent-subcategory fixes.",
    ],
  },
  {
    version: "Platform",
    date: "2026",
    items: [
      "Gamification (~150 badges, levels, streaks), social graph (follows, activity, shares), collections, and moderation.",
      "27 Deno Edge Functions and 164 schema migrations.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="flex flex-col items-center px-6 py-24 text-center bg-screen">
      <div className="max-w-3xl mx-auto flex flex-col gap-16">
        {/* Hero */}
        <section className="flex flex-col items-center gap-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-ink">
            Changelog
          </h1>
          <p className="text-lg text-muted max-w-xl leading-relaxed">
            A summary of notable updates across the Roam Android app, browser
            extension, and web. For the full commit history, see{' '}
            <a
              href="https://github.com/seven-lynx/Roam"
              target="_blank"
              rel="noopener noreferrer"
              className="text-phosphor hover:underline"
            >
              GitHub
            </a>
            .
          </p>
        </section>

        {/* Android */}
        <section className="text-left">
          <h2 className="text-2xl font-bold text-ink mb-6">Android app</h2>
          <div className="flex flex-col gap-4">
            {ANDROID_ENTRIES.map((entry) => (
              <div
                key={entry.version}
                className="rounded-xl border border-line p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-ink">
                    v{entry.version}
                  </h3>
                  <span className="text-xs text-muted">{entry.date}</span>
                </div>
                <ul className="text-sm text-muted space-y-1.5 list-disc list-inside">
                  {entry.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Browser extension */}
        <section className="text-left">
          <h2 className="text-2xl font-bold text-ink mb-6">Browser extension</h2>
          <div className="flex flex-col gap-4">
            {EXTENSION_ENTRIES.map((entry) => (
              <div
                key={`extension-${entry.version}`}
                className="rounded-xl border border-line p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-ink">v{entry.version}</h3>
                  <span className="text-xs text-muted">{entry.date}</span>
                </div>
                <ul className="text-sm text-muted space-y-1.5 list-disc list-inside">
                  {entry.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Web */}
        <section className="text-left">
          <h2 className="text-2xl font-bold text-ink mb-6">Web</h2>
          <div className="flex flex-col gap-4">
            {WEB_ENTRIES.map((entry) => (
              <div
                key={`web-${entry.version}`}
                className="rounded-xl border border-line p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-ink">{entry.version}</h3>
                  <span className="text-xs text-muted">{entry.date}</span>
                </div>
                <ul className="text-sm text-muted space-y-1.5 list-disc list-inside">
                  {entry.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Backend */}
        <section className="text-left">
          <h2 className="text-2xl font-bold text-ink mb-6">Backend (Supabase)</h2>
          <div className="flex flex-col gap-4">
            {BACKEND_ENTRIES.map((entry) => (
              <div
                key={`backend-${entry.version}`}
                className="rounded-xl border border-line p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-ink">{entry.version}</h3>
                  <span className="text-xs text-muted">{entry.date}</span>
                </div>
                <ul className="text-sm text-muted space-y-1.5 list-disc list-inside">
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
          <p className="text-lg text-muted">
            Want the newest features first?
          </p>
          <Link
            href="/extensions"
            className="btn btn-primary"
          >
            Get the extension
          </Link>
        </section>
      </div>
    </div>
  );
}
