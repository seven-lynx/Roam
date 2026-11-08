# Help & FAQ

Roam is a web-discovery platform: a browser extension, an Android app, and a web
portal (Roam-OS desktop + account hub). Use this guide to answer the questions we
hear most often. Still stuck? See the **Where to get help** section below.

---

## Accounts

**How do I sign up?**
Sign up with Google OAuth or with your email and password. From the web app,
open the "Join" screen from the header or `/join`. You can also create an
account from the Android app and the browser extension.

**Do I need to verify my email?**
Yes, if you sign up with email. You'll get a confirmation link; follow it to
activate your account. Re-send the email from the verification screen if it
doesn't arrive.

**How do I reset my password?**
Go to **Settings → Security** (or the `/forgot-password` page) and follow the
email link. From there you can also change your password, download your data,
or delete your account permanently.

**Which account do I use when I switch between the extension, Android, and web?**
You use the same account everywhere. Sign in with the same provider (Google or
email) on each surface. If you registered with email, use that email + password;
if you registered with Google, sign in with Google.

**Why can't I see my collections/profiles on another platform?**
Collections, profiles, and ratings are stored on your account in the Supabase
backend, so they're shared across web, extension, and Android. Sign in with the
same account on each platform. Pushing a page, rating, or following someone on
one platform appears on the others.

## Discovery

**What happens when I press the "Roam" button?**
The discovery function runs in PostgreSQL and balances five signals to pick a
page you're likely to enjoy:

- Community quality (Wilson score, so small vote counts are treated fairly)
- Editorial signal (source reputation such as HN score, citations, Reddit karma)
- Your taste (topics you upvote surface more; downvotes dial them back)
- Freshness (recent pages get a small boost; old ones fade)
- Exploration bonus (newly seeded pages get a small boost)

It then fetches and validates candidate URLs in parallel and retries with wider
sampling if the initial pool is exhausted.

**Why did I see the same site twice in a row?**
Each domain gets a 30-minute cooldown in discovery mode after you discover it,
so you won't see the same site twice in a row under normal circumstances. If it
happens, it's usually the first discovery of that domain or a cooldown edge
case.

**What's the difference between Focus mode and Collection mode?**
- **Focus mode** narrows discovery to the topics/categories you selected (or
  the broad category pillars + subcategories the system tracks).
- **Collection mode** stays inside a saved list of URLs that you (or others)
  have added to a collection.

**Do my downvotes hide a domain?**
Downvoting doesn't hide anything — it dials the topic's weight back, so pages
like it rank lower for you while staying visible to everyone else. The only
automatic suppression is the discovery-mode 30-minute domain cooldown.

**My page felt off. How do I give feedback?**
Rate it up or down. Every vote recalculates the page's Wilson score, so the
community ranking updates in real time. You can also report broken/dead links
from the URL detail flow, which feeds the moderation queue.

**What does "adjacent topic" mean in discovery mode?**
Occasional adjacent topics are intentional serendipity: the system surfaces a
related topic outside your usual set so you discover something new without
completely breaking your focus.

---

## Collections

**What is a collection?**
A collection is a saved list of URLs. You can make one **public** (visible to
anyone and browseable at `/collections/[slug]`) or **private** (only you can
see it).

**How do I save a page to a collection?**
From the web app, Android app, or extension, use the "Save/collect" action on a
page to add it to an existing collection or create a new one. Saved URLs stay
with your account and sync across platforms.

**Can I share a collection with someone?**
Public collections can be shared by sending their link (the `/collections/[slug]`
URL). Collections can also be part of what you share when you share a URL to a
user (which may trigger a push notification).

## Profiles

**What do public profiles show?**
Public profile pages (`/u/[username]`) show activity, collections, badges, and
XP stats such as pages rated, URLs submitted, and follower count.

**How do I follow someone?**
From any public profile, use the follow button. Following adds that person's
activity to your **Following** feed (web only).

**How do I see my own stats?**
Visit your profile (`/profile`), or use the Activities tab in Settings. Badge
unlocks, level-ups, and challenge completions also send push/email
notifications if you've enabled them.

---

## Platform-specific behavior

**Web / Roam-OS desktop**
The web app is the ROAM-OS desktop experience (3D cyberdeck, window manager,
in-device programs) plus the account hub. Settings live in the **Settings**
route and include discovery mode, notifications, appearance, security, and the
Danger Zone (data export & account deletion).

**Browser extension (Chrome & Firefox)**
- One-click discovery: click, roam, rate, close — nothing is injected into the
  pages you visit.
- Prefetch cache (`chrome.storage.session`) for near-instant navigation.
- It detects and rates the page you're currently viewing.
- Save for later, collections (create, rename, delete, make public, copy link),
  share-with-a-friend, feedback, and broken-link reports. Pages saved while
  signed out are kept locally and pushed to your account the next time the saved
  list loads.
- Badges, challenges, level, XP and day streak, with notifications that open the
  same page the web app would.
- Desktop notifications (opt-in) for follows, shares and unlocks, plus a
  Community tab with your activity feed, followers and following.
- Profile editing: claim a username, set a display name and bio, and change your
  password on email accounts.
- Discovery settings: focus mode, deep-dive mode, paywalled-site skipping,
  multi-language filtering, and optional page translation.
- Published: Chrome Web Store and Firefox AMO.

**Android app**
- In-app browser so you don't leave the app.
- Prefetch pipeline for instant card-to-card navigation.
- Browsing history screen with search and filtering.
- Push notifications for new features, badge unlocks, level-ups, shared URLs,
  and challenge completions.
- Leaderboard, badge gallery, public profiles, follows, and URL sharing.

## Where to get help

We follow GitHub's community support guidance for routing users:

- **Product questions, how-tos, and FAQs** → this guide and the product pages
  (`/how-it-works`, `/settings`, `/collections/[slug]`). If something isn't
  covered here, use the in-app feedback widget (top-right) or email
  `support@roamtheweb.app`.
- **Bugs and feature requests** → open a **GitHub Issue** with steps to
  reproduce, expected vs. actual behavior, and the affected platform
  (web / extension / Android / backend). See [`CONTRIBUTING.md`](../CONTRIBUTING.md).
- **Security vulnerabilities** → do **not** open a public issue. See
  [`SECURITY.md`](../SECURITY.md) — report via email at
  `developer@roamtheweb.app` (with PGP encryption for sensitive details).
- **GitHub platform issues** (for example, problems using GitHub itself) →
  contact **GitHub Support**.


*Roam is open source (MIT) and free forever — no ads, no data selling. Made by 7 Lynx.*



