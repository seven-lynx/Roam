import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Help & FAQ",
  description:
    "Answers to common questions about accounts, discovery, collections, profiles, and Roam's platforms.",
};

function FaqItem({ q, a }: { q: string; a: ReactNode }) {
  return (
    <div className="mb-6">
      <p className="text-lg font-semibold text-ink">{q}</p>
      <div className="mt-1 text-sm leading-relaxed text-muted">{a}</div>
    </div>
  );
}

export default function HelpPage() {
  return (
    <div className="flex flex-col items-center px-6 py-24 bg-screen">
      <div className="max-w-4xl mx-auto w-full flex flex-col gap-12 text-left">
        {/* Hero */}
        <section className="flex flex-col gap-5">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-ink">
            Help &amp; FAQ
          </h1>
          <p className="text-lg text-muted leading-relaxed max-w-2xl">
            Common questions about accounts, discovery, collections, profiles,
            and Roam&rsquo;s platforms. Still stuck? See where to get help
            below.
          </p>
        </section>

        {/* Section nav */}
        <nav className="text-left" aria-label="Page sections">
          <ul className="flex flex-wrap gap-2 text-sm">
            {[
              ["#accounts", "Accounts"],
              ["#discovery", "Discovery"],
              ["#collections", "Collections"],
              ["#profiles", "Profiles"],
              ["#platforms", "Platforms"],
              ["#help", "Where to get help"],
            ].map(([href, label]) => (
              <li key={href}>
                <a
                  href={href}
                  className="inline-block px-3 py-1.5 rounded-full bg-panel-2 text-muted hover:bg-panel-3 hover:text-ink transition-colors"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Accounts */}
        <section id="accounts" className="scroll-mt-20 text-left bg-panel-2 rounded-2xl border border-line p-6">
          <h2 className="text-2xl font-bold text-ink mb-6">Accounts</h2>
          <FaqItem
            q="How do I sign up?"
            a={
              <>
                Sign up with Google OAuth or with your email and password. From
                the web app, open the &ldquo;Join&rdquo; screen from the header
                or /join. You can also create an account from the Android app
                and the browser extension.
              </>
            }
          />
          <FaqItem
            q="Do I need to verify my email?"
            a={
              <>
                Yes, if you sign up with email. You&rsquo;ll get a confirmation
                link; follow it to activate your account. Re-send the email from
                the verification screen if it doesn&rsquo;t arrive.
              </>
            }
          />
          <FaqItem
            q="How do I reset my password?"
            a={
              <>
                Go to <strong>Settings &rarr; Security</strong> (or the
                /forgot-password page) and follow the email link. From there you
                can also change your password, download your data, or delete
                your account permanently.
              </>
            }
          />
          <FaqItem
            q="Which account do I use when I switch between the extension, Android, and web?"
            a={
              <>
                You use the same account everywhere. Sign in with the same
                provider (Google or email) on each surface. If you registered
                with email, use that email + password; if you registered with
                Google, sign in with Google.
              </>
            }
          />
          <FaqItem
            q="Why can't I see my collections/profiles on another platform?"
            a={
              <>
                Collections, profiles, and ratings are stored on your account in
                the Supabase backend, so they&rsquo;re shared across web,
                extension, and Android. Sign in with the same account on each
                platform. Pushing a page, rating, or following someone on one
                platform appears on the others.
              </>
            }
          />
        </section>

        {/* Discovery */}
        <section id="discovery" className="scroll-mt-20 text-left bg-panel-2 rounded-2xl border border-line p-6">
          <h2 className="text-2xl font-bold text-ink mb-6">Discovery</h2>
          <FaqItem
            q="What happens when I press the &ldquo;Roam&rdquo; button?"
            a={
              <>
                The discovery function runs in PostgreSQL and balances five
                signals to pick a page you&rsquo;re likely to enjoy:
              </>
            }
          />
          <ul className="mt-3 list-disc list-inside text-sm text-muted space-y-2">
            <li>Community quality (Wilson score, so small vote counts are treated fairly)</li>
            <li>Editorial signal (source reputation such as HN score, citations, Reddit karma)</li>
            <li>Your taste (topics you upvote surface more; downvotes dial them back)</li>
            <li>Freshness (recent pages get a small boost; old ones fade)</li>
            <li>Exploration bonus (newly seeded pages get a small boost)</li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            It then fetches and validates candidate URLs in parallel and retries
            with wider sampling if the initial pool is exhausted.
          </p>
          <FaqItem
            q="Why did I see the same site twice in a row?"
            a={
              <>
                Each domain gets a 30-minute cooldown in discovery mode after you
                discover it, so you won&rsquo;t see the same site twice in a row
                under normal circumstances. If it happens, it&rsquo;s usually the
                first discovery of that domain or a cooldown edge case.
              </>
            }
          />
          <FaqItem
            q="What&rsquo;s the difference between Focus mode and Collection mode?"
            a={
              <>
                <strong className="text-ink">Focus mode</strong> narrows
                discovery to the topics/categories you selected (or the broad
                category pillars + subcategories the system tracks).{" "}
                <strong className="text-ink">Collection mode</strong> stays
                inside a saved list of URLs that you (or others) have added to a
                collection.
              </>
            }
          />
          <FaqItem
            q="Do my downvotes hide a domain?"
            a={
              <>
                Downvoting doesn&rsquo;t hide anything &mdash; it dials the
                topic&rsquo;s weight back, so pages like it rank lower for you
                while staying visible to everyone else. The only automatic
                suppression is the discovery-mode 30-minute domain cooldown.
              </>
            }
          />
          <FaqItem
            q="My page felt off. How do I give feedback?"
            a={
              <>
                Rate it up or down. Every vote recalculates the page&rsquo;s
                Wilson score, so the community ranking updates in real time. You
                can also report broken/dead links from the URL detail flow, which
                feeds the moderation queue.
              </>
            }
          />
          <FaqItem
            q="What does &ldquo;adjacent topic&rdquo; mean in discovery mode?"
            a={
              <>
                Occasional adjacent topics are intentional serendipity: the
                system surfaces a related topic outside your usual set so you
                discover something new without completely breaking your focus.
              </>
            }
          />
        </section>

        {/* Collections */}
        <section id="collections" className="scroll-mt-20 text-left bg-panel-2 rounded-2xl border border-line p-6">
          <h2 className="text-2xl font-bold text-ink mb-6">Collections</h2>
          <FaqItem
            q="What is a collection?"
            a={
              <>
                A collection is a saved list of URLs. You can make one{" "}
                <strong>public</strong> (visible to anyone and browseable at
                /collections/[slug]) or <strong>private</strong> (only you can
                see it).
              </>
            }
          />
          <FaqItem
            q="How do I save a page to a collection?"
            a={
              <>
                From the web app, Android app, or extension, use the
                &ldquo;Save/collect&rdquo; action on a page to add it to an
                existing collection or create a new one. Saved URLs stay with
                your account and sync across platforms.
              </>
            }
          />
          <FaqItem
            q="Can I share a collection with someone?"
            a={
              <>
                Public collections can be shared by sending their link (the
                /collections/[slug] URL). Collections can also be part of what
                you share when you share a URL to a user (which may trigger a
                push notification).
              </>
            }
          />
        </section>

        {/* Profiles */}
        <section id="profiles" className="scroll-mt-20 text-left bg-panel-2 rounded-2xl border border-line p-6">
          <h2 className="text-2xl font-bold text-ink mb-6">Profiles</h2>
          <FaqItem
            q="What do public profiles show?"
            a={
              <>
                Public profile pages ({" "}
                <code className="text-ink font-medium">/u/[username]</code>
                {" "})
                show activity, collections, badges, and XP stats such as pages
                rated, URLs submitted, and follower count.
              </>
            }
          />
          <FaqItem
            q="How do I follow someone?"
            a={
              <>
                From any public profile, use the follow button. Following adds
                that person&rsquo;s activity to your{" "}
                <strong className="text-ink">Following</strong> feed (web only).
              </>
            }
          />
          <FaqItem
            q="How do I see my own stats?"
            a={
              <>
                Visit your profile ({" "}
                <code className="text-ink font-medium">/profile</code>
                {", or use the Activities tab in Settings. Badge unlocks, "}
                level ups, and challenge completions also send push/email
                notifications if you&rsquo;ve enabled them.
              </>
            }
          />
        </section>

        {/* Platform-specific behavior */}
        <section id="platforms" className="scroll-mt-20 text-left bg-panel-2 rounded-2xl border border-line p-6">
          <h2 className="text-2xl font-bold text-ink mb-6">
            Platform-specific behavior
          </h2>
          <FaqItem
            q="Web / Roam-OS desktop"
            a={
              <>
                The web app is the ROAM-OS desktop experience (3D cyberdeck,
                window manager, in-device programs) plus the account hub.
                Settings live in the <strong>Settings</strong> route and include
                discovery mode, notifications, appearance, security, and the
                Danger Zone (data export &amp; account deletion).
              </>
            }
          />
          <FaqItem
            q="Browser extension (Chrome &amp; Firefox)"
            a={
              <>
                <ul className="mt-3 list-disc list-inside text-sm text-muted space-y-2">
                  <li>
                    One-click discovery: click, roam, rate, close &mdash; nothing
                    is injected into the pages you visit.
                  </li>
                  <li>Prefetch cache (chrome.storage.session) for near-instant navigation.</li>
                  <li>It detects and rates the page you&rsquo;re currently viewing.</li>
                  <li>Published: Chrome Web Store and Firefox AMO.</li>
                </ul>
              </>
            }
          />
          <FaqItem
            q="Android app"
            a={
              <>
                <ul className="mt-3 list-disc list-inside text-sm text-muted space-y-2">
                  <li>In-app browser so you don&rsquo;t leave the app.</li>
                  <li>Prefetch pipeline for instant card-to-card navigation.</li>
                  <li>Browsing history screen with search and filtering.</li>
                  <li>
                    Push notifications for new features, badge unlocks, level-ups,
                    shared URLs, and challenge completions.
                  </li>
                  <li>
                    Leaderboard, badge gallery, public profiles, follows, and
                    URL sharing.
                  </li>
                </ul>
              </>
            }
          />
        </section>

        {/* Where to get help */}
        <section id="help" className="scroll-mt-20 text-left bg-panel-2 rounded-2xl border border-line p-6">
          <h2 className="text-2xl font-bold text-ink mb-6">Where to get help</h2>
          <p className="text-lg leading-relaxed text-muted mb-4">
            We follow GitHub&rsquo;s community support guidance for routing users:
          </p>
          <ul className="list-disc list-inside text-sm text-muted space-y-3">
            <li>
              <strong>Product questions, how-tos, and FAQs</strong> &rarr; this
              guide and the product pages ({" "}
              <code className="text-ink font-medium">/how-it-works</code>,{" "}
              <code className="text-ink font-medium">/settings</code>,{" "}
              <code className="text-ink font-medium">/collections/[slug]</code>
              {". If something isn"}
              &rsquo;t covered here, use the in-app feedback widget (top-right)
              or email{" "}
              <code>support@roamtheweb.app</code>
              {". "}
            </li>
            <li>
              <strong>Bugs and feature requests</strong> &rarr; open a{" "}
              <strong>GitHub Issue</strong> with steps to reproduce, expected vs.
              actual behavior, and the affected platform (web / extension /
              Android / backend). See{" "}
              <code className="text-ink font-medium">CONTRIBUTING.md</code>
              {". "}
            </li>
            <li>
              <strong>Security vulnerabilities</strong> &rarr; do <strong>not</strong>
              open a public issue. See{" "}
              <code className="text-ink font-medium">SECURITY.md</code>
              {", report via email at "}
              <code>developer@roamtheweb.app</code>
              {" (with PGP encryption for sensitive details). "}
            </li>
            <li>
              <strong>GitHub platform issues</strong> (for example, problems using
              GitHub itself) &rarr; contact <strong>GitHub Support</strong>.
            </li>
          </ul>
        </section>

        <p className="text-center text-xs text-zinc-400">
          Roam is open source (MIT) and free forever &mdash; no ads, no data
          selling. Made by 7 Lynx.
        </p>
      </div>
    </div>
  );
}
