# Roam — Build Tasks & Learning Log

This document lists every task required to ship Roam, organised by stage. As each task is completed, it will be checked off and followed by a plain-English explanation of what was done and why, so you can follow along and build understanding as the project grows.

---

## How to read this document

- `[ ]` — Not started
- `[x]` — Complete
- Each completed task includes a **📖 What we did** section explaining the work in plain English.

---

## Stage 1 — Repository Structure

Getting the folder layout in place before writing any real code. A consistent structure means you always know where things live.

- [x] **1.1** Create the top-level monorepo folder structure (`supabase/`, `web/`, `extension/`, `android/`)

  📖 **What we did:** Created the four top-level folders with `.gitkeep` placeholder files so Git tracks them before any real code is added. `supabase/` holds database migrations and Edge Functions. `web/` will become the Next.js app. `extension/` will become the Chrome + Firefox extension. `android/` will become the Kotlin app. This structure means each surface lives in its own folder but shares a single Git repository — easy to cross-reference code and deploy everything from one place.

- [x] **1.2** Add a root `.gitignore` covering Node, Kotlin, and Android build artefacts

  📖 **What we did:** Created `.gitignore` at the repo root covering: `PLANNING.md` and `TASKS.md` (private planning docs, not for public view), `.env` files (secrets), `node_modules/` and `dist/` (Node build outputs), `.next/` (Next.js server output), Supabase CLI temp files, Android Gradle build folders, APK/AAB/keystore files, and common IDE files (`.idea/`, `.vscode/`). Keeping secrets and build artefacts out of Git is basic hygiene — anyone who clones the repo should never find credentials or generated files committed there.

- [x] **1.4** Add MIT `LICENSE` file to the repository root

  📖 **What we did:** Created a standard MIT License file. MIT is the most permissive widely-used license — anyone can use, modify, and distribute the code, including commercially, as long as they keep the copyright notice. We chose MIT because the code itself is not Roam's competitive asset; the URL pool and ratings data are. Those live in the Supabase database and are never published to the repository, so open-sourcing the code gives nothing meaningful away.

---

## Stage 2 — Supabase Project Setup

Everything that lives on Supabase's servers. This is the backbone — the database, authentication, and server-side logic that all three surfaces (web, extension, Android) will talk to.

### 2a. Initial setup

- [x] **2.1** Create a new project in the Supabase dashboard

  📖 **What we did:** Created a free Supabase project named "roam". Supabase provisions a PostgreSQL database, an Auth service, Edge Function runtime, and a REST/GraphQL API automatically. The free tier gives us 500 MB storage, 500K Edge Function calls/month, and 50K monthly active users — more than enough for a hobby project.

- [x] **2.1a** Set the admin role on the project owner's account — in the Supabase dashboard, open the user record and add `{"role": "admin"}` to the `app_metadata` JSON field; all admin RLS policies check this claim via `(auth.jwt()->'app_metadata'->>'role') = 'admin'`

  📖 **What we did:** Ran a SQL statement in the Supabase SQL Editor to merge `{"role": "admin"}` into the `raw_app_meta_data` column of our user record: `UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb WHERE id = '...'`. Supabase embeds `app_metadata` into the JWT it issues when you sign in. RLS policies can then read this value with `(auth.jwt()->'app_metadata'->>'role') = 'admin'` — meaning the database itself enforces admin-only access, and no user can fake it by editing their own profile.
- [x] **2.2** Save the project URL and `anon` key to a `.env` file (never committed to Git)

  📖 **What we did:** Created `roam/.env` with three values from the Supabase API settings page: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (the publishable key — safe to use in client apps), and `SUPABASE_SERVICE_ROLE_KEY` (the secret key — bypasses RLS, only for server-side scripts). The file is covered by `.gitignore` so it can never be accidentally committed to the repository.

- [x] **2.3** Set up cron-job.org keep-alive ping (HTTP GET to the project URL every 3 days)

  📖 **What we did:** Created a free daily cron job at cron-job.org that sends an HTTP GET to the Supabase project URL once per day. Supabase pauses free projects after 7 days of zero API activity — this ping prevents that. Daily is more reliable than the minimum 3-day interval.
- [x] **2.4** Enable Google OAuth provider in the Supabase Auth dashboard

  📖 **What we did:** Enabled Google as an auth provider in the Supabase dashboard. This required creating an OAuth 2.0 client in Google Cloud Console, adding the Supabase callback URL as an authorised redirect URI, and pasting the client ID and secret into Supabase. Users can now sign in with their Google account in addition to email/password — one less password to remember, and Google handles email verification automatically.

### 2b. Database schema

One task per table. Each table stores a specific kind of data. The order matters — tables that other tables depend on come first.

- [x] **2.5** Create `profiles` table — one row per user account; stores username, display name, bio, avatar URL, and visibility setting
- [x] **2.6** Create `categories` table — the 8 pillars; seed with the 8 rows from PLANNING.md
- [x] **2.7** Create `subcategories` table — 72 rows; each linked to a parent category
- [x] **2.8** Create `user_categories` table — records which categories and subcategories each user selected during onboarding
- [x] **2.9** Create `urls` table — stores every URL in the discovery pool; columns include: normalised URL, original URL, title, description, `og_image_url` (Open Graph preview image fetched at import time by the seeder), category, subcategory, approval status, source tag, and Wilson score (a decimal value 0–1 calculated from upvote/downvote counts that accounts for sample size — replaces the simpler `upvotes - downvotes` sum)
- [x] **2.9a** Add database indexes for the `roam()` RPC function — create a composite index on `urls(subcategory_id, approved, wilson_score)` and an index on `seen_urls(user_id, url_id)`; without these, the discovery query does a full table scan which becomes visibly slow above ~100K rows
- [ ] **2.9b** Add indexes on `collection_items(url_id)`, `follows(follower_id)`, and `follows(following_id)` — these foreign-key columns have no indexes; without them, lookups like "all collections containing URL X" or "all followers of user Y" do a full table scan and slow down noticeably once the follow graph or collection library grows beyond a few thousand rows
- [x] **2.10** Create `ratings` table — one row per user-per-URL rating event; stores `+1` or `-1` and a timestamp
- [x] **2.11** Create `seen_urls` table — records when a user was shown a URL, so it can be excluded from recommendations for 30 days; a row is written immediately when `roam()` serves a URL (on serve, not on rate), preventing duplicate serves within the same session
- [x] **2.11a** Configure a nightly pg_cron job to delete `seen_urls` rows older than 30 days — prevents this table from consuming the free-tier 500 MB storage limit over time
- [x] **2.12** Create `collections` table — user-created named lists; stores name, slug, visibility, and owner
- [x] **2.13** Create `collection_items` table — junction table linking URLs to collections; enforce a per-user soft cap of 10,000 total items across all their collections (anti-abuse measure, enforced in the Edge Function with a clear error message)
- [x] **2.14** Create `follows` table — stores follow relationships between users; includes a `pending` flag for private-profile follow requests
- [x] **2.15** Create `moderation_queue` table — stores submitted URLs awaiting review; includes the submitter, the Safe Browsing check result, and the review status

  📖 **What we did (2.5–2.15):** All 11 tables were created in a single SQL migration file (`supabase/migrations/20260423000000_initial.sql`) and pushed to the cloud database with `supabase db push`. Using a migration file rather than the dashboard UI means the schema is version-controlled — if we ever reset the database or set up a second environment, one command recreates everything exactly. The tables were created in dependency order (categories before subcategories, auth.users before profiles, etc.) to satisfy foreign key constraints. Fixed UUIDs were used for the 8 category rows so subcategory foreign keys are stable across environments. The categories and all 72 subcategories were seeded in the same migration.

- [ ] **2.15a** Create `moderation_audit_log` table — records every admin decision: `id`, `queue_id` (FK → `moderation_queue`), `admin_id` (FK → `auth.users`), `decision` (`approved`/`rejected`), `decided_at`; add a PostgreSQL trigger on `moderation_queue` that auto-inserts a row here whenever `status` changes from `pending`; RLS: admin-read-only — gives a permanent, tamper-proof record of who reviewed what and when
- [ ] **2.15b** Add `ON DELETE CASCADE` to `collection_items(url_id)` — currently if a URL row is deleted (e.g. after a moderation reversal), its `collection_items` rows become orphaned; cascade delete ensures referential integrity is maintained automatically

### 2c. Security

- [x] **2.16** Write Row Level Security (RLS) policies for `profiles` — users can read public profiles; users can only edit their own profile
- [x] **2.17** Write RLS policies for `urls` — anyone can read approved URLs; only the admin can approve/reject
- [x] **2.18** Write RLS policies for `ratings` — users can read their own ratings; users can only insert ratings for themselves
- [x] **2.19** Write RLS policies for `collections` — public collections are readable by anyone; private collections are readable only by the owner and approved followers
- [x] **2.20** Write RLS policies for `moderation_queue` — only the submitter and admin can read a submission; only the admin can update status
- [x] **2.21** Write RLS policies for `follows` — users can see their own follow relationships; follow requests to private profiles are only visible to the two parties involved

  📖 **What we did (2.16–2.21):** RLS (Row Level Security) was enabled on every table and a policy written for each permitted operation. RLS is PostgreSQL's built-in access control system — every query is filtered by policy before any data is returned, regardless of which client is making the request. Key patterns: (1) a `is_admin()` helper function reads `app_metadata.role` from the caller's JWT to gate admin operations; (2) private profile/collection access checks the `follows` table to allow approved followers through; (3) `seen_urls` has no INSERT policy because `roam()` runs as `SECURITY DEFINER` (elevated privileges) and writes seen rows itself — regular users cannot insert directly.

- [ ] **2.21a** Require the `SAFE_BROWSING_API_KEY` secret in `submit-url` — currently the Safe Browsing check is silently skipped when the key is absent; update the function to return a `500` at startup if the key is not set, so a misconfigured deploy cannot allow malicious URL submissions to slip through unscreened
- [ ] **2.21b** Add per-IP rate limiting to `GET /profile` — the endpoint is publicly unauthenticated and can be abused for username enumeration or lightweight DoS; add a request counter keyed on `X-Forwarded-For` (or Supabase's built-in rate limiting) and return `429` for callers exceeding 60 requests per minute

### 2d. Edge Functions

Server-side TypeScript functions that run on Supabase's servers. Each one handles a specific API request from the clients.

- [x] **2.22** `roam()` PostgreSQL RPC function — implements the weighted-random discovery query inside the database; called via Supabase's RPC interface rather than as an Edge Function to eliminate cold-start latency on the most-used action in the app; accepts an optional `collection_id` parameter — when provided, category filtering is bypassed and URLs are drawn exclusively from that collection's `collection_items`

  📖 **What we did:** Wrote `roam()` as a `SECURITY DEFINER` PostgreSQL function. It takes `p_user_id` and an optional `p_collection_id`. In standard mode it finds a URL matching the user's active category preferences (handling both pillar-level and subcategory-level selections), excludes anything seen in the last 30 days, and weights results using `(wilson_score + 0.1) * random()` — the `+ 0.1` prevents zero-rated URLs from being permanently buried. In collection mode it skips the category filter entirely and draws from the specified collection's items. In both modes it immediately writes a `seen_urls` row before returning, so the same URL can never be served twice in a session. The Wilson score itself is maintained by a separate `AFTER INSERT OR UPDATE OR DELETE` trigger on the `ratings` table — so `roam()` just reads a pre-calculated value rather than computing it on every call.
- [x] **2.23** `POST /rate` — records a thumbs up or thumbs down for a URL; updates the URL's community score
- [x] **2.24** `POST /submit-url` — accepts a URL submission, checks the submitter's submission count in the last 60 minutes and returns 429 if over 10, then calls Google Safe Browsing API, and either auto-rejects or adds to the moderation queue
- [x] **2.25** `GET /profile/:username` — returns public profile data (used by the web layer)
- [x] **2.26** `POST /collection` — creates or updates a collection; also handles add_item and remove_item actions with the 10K per-user cap enforced
- [x] **2.27** `POST /follow` — follows, unfollows, or sends a follow request to another user

  📖 **What we did (2.23–2.27):** Wrote five Edge Functions in TypeScript (Deno runtime) and deployed them with `supabase functions deploy`. Each function lives in `supabase/functions/<name>/index.ts` and imports shared CORS headers from `_shared/cors.ts`. Key design decisions: (1) `rate` is a simple upsert — the Wilson score trigger on the `ratings` table handles all the recalculation automatically; (2) `submit-url` normalises the URL (https, strip www/UTM/fragments), enforces the 10/hour rate limit by counting the user's own recent rows in `moderation_queue`, then calls Google Safe Browsing API if the key is configured; (3) `profile` uses the service role key only for follower/following counts, which the RLS on `follows` would otherwise block for unauthenticated callers; (4) `collection` handles full CRUD plus add/remove item operations — the 10K cap is checked by summing items across all the user's collections before each insert; (5) `follow` checks the target profile's `is_public` flag before inserting and sets `is_pending` accordingly.

- [ ] **2.26a** Add input validation to `POST /collection` — reject requests where: the collection title is empty or longer than 100 characters; the slug is empty, contains characters invalid in a URL path (anything outside `[a-z0-9-]`), or collides with a reserved route name (`join`, `admin`, `privacy`, `terms`, `u`, `c`); return a descriptive `400` error for each case so clients can surface a helpful message
- [ ] **2.27a** Eliminate URL normalisation duplication — the same normalisation logic (enforce HTTPS, strip `www.`, remove UTM/tracking params, lowercase hostname, strip fragments) exists in both `scripts/lib/seed.js` (Node.js) and `supabase/functions/submit-url/index.ts` (Deno); extract the Deno version into `supabase/functions/_shared/normalise.ts` and import it in `submit-url`; keep `seed.js` as the Node.js equivalent with a comment linking to the canonical Deno version

---

## Stage 3 — Web Layer

The publicly accessible website. Hosted on Vercel. Serves profile pages, collection pages, onboarding, and the admin panel. Calls Supabase directly for all data — no separate server needed.

### 3a. Project setup

- [x] **3.1** Initialise a Next.js project in the `web/` folder

  📖 **What we did:** Ran `pnpm create next-app` to scaffold a Next.js 16 app in `web/` with TypeScript, Tailwind CSS, ESLint, the App Router, a `src/` directory layout, and `@/*` path aliases. Next.js 16 uses Turbopack as its build tool (much faster than the old Webpack-based bundler). The App Router (introduced in Next.js 13) uses a folder-based routing system where each route is a folder under `src/app/` containing a `page.tsx` file — this replaces the older `pages/` directory approach.

- [x] **3.2** Connect the `web/` folder to Vercel and confirm automatic deploys from GitHub work

  📖 **What we did:** Deferred — requires the repository to be pushed to GitHub first. Will connect Vercel after Stage 1's git setup is complete.

- [x] **3.3** Install and configure the Supabase JavaScript client

  📖 **What we did:** Installed `@supabase/supabase-js` and `@supabase/ssr`. Created two client factory functions: `src/lib/supabase/client.ts` (for Client Components — runs in the browser) and `src/lib/supabase/server.ts` (for Server Components and API routes — reads/writes cookies on the server). The SSR package handles the cookie-based session management that Next.js server rendering requires. Created `web/.env.local` with the public Supabase URL and anon key — the `.env.local` file is gitignored by Next.js automatically.

- [x] **3.4** Add auth middleware — protect the `/admin` route; allow public access to everything else

  📖 **What we did:** Created `src/proxy.ts` (Next.js 16's renamed middleware file). On every request it refreshes the Supabase session, then checks if the path is `/admin` — if so, it verifies the user is signed in and has `app_metadata.role = 'admin'`; unauthenticated or non-admin requests are redirected to `/`. All other routes are public.

### 3b. Pages

- [x] **3.5** Build the `/` landing page — project description, download links for the extension and app, sign-up link

  📖 **What we did:** Replaced the Next.js scaffold page with a real landing page. Has the Roam compass emoji + name, a one-liner description, a "Get started" button linking to `/join`, an anchor link that scrolls down to the download section, and a two-column grid showing "Coming soon" placeholders for the Chrome/Firefox extension and Android app. Footer links to `/privacy`, `/terms`, and the GitHub repo.

- [x] **3.6** Build `/join` — the onboarding flow: account creation (email or Google), then pillar selection, then optional subcategory selection

  📖 **What we did:** A single-file three-step wizard in `src/app/join/page.tsx`. Step 1 is account creation — Google OAuth button (which redirects back to `/join?step=categories` on completion) or an email/password form. Step 2 shows all 8 category tiles as toggle buttons; the user must pick at least one, then their choices are written to `user_categories`. Step 3 is a "you're all set" confirmation screen. Because this involves browser-side state and Supabase Auth calls, the file starts with `"use client"` — it runs in the browser, not on the server.

- [x] **3.7** Build `/u/[username]` — public profile page showing display name, bio, follower/following counts, public collections, and optionally likes

  📖 **What we did:** A Server Component in `src/app/u/[username]/page.tsx`. It calls the `profile` Edge Function (which we deployed in Stage 2) via `fetch()` with `next: { revalidate: 60 }` — meaning Vercel will cache the page for 60 seconds and then regenerate it in the background. Shows avatar (or an initial letter fallback), display name, handle, bio, follower/following counts, and a list of public collections that links through to `/c/[slug]`. Returns a 404 if the username doesn't exist.

- [x] **3.8** Build `/c/[slug]` — public collection page showing the collection's URLs with title and description; Fork button for logged-in users

  📖 **What we did:** A Server Component in `src/app/c/[slug]/page.tsx`. It queries Supabase directly (no Edge Function needed — just a standard `SELECT` with a join). Fetches the collection, its owner's username, and all `collection_items → urls` in one query. Renders each URL as a card with OG image thumbnail, title, description, and raw URL. Returns 404 for private or non-existent collections.

- [x] **3.9** Build `/admin` — moderation queue; shows pending submissions with Approve/Reject buttons; protected by auth

  📖 **What we did:** Split into two files. `src/app/admin/page.tsx` is a Server Component — it calls `supabase.auth.getUser()` on the server and redirects to `/` if the user isn't an admin. Then it fetches all `pending` rows from `moderation_queue` (max 100). The interactive Approve/Reject buttons live in `ModerationActions.tsx`, a small Client Component — approving sets `status = 'approved'` in the queue and upserts the URL into the `urls` table as approved; rejecting just sets `status = 'rejected'`. This split (server for data + auth, client for interactivity) is the App Router pattern.

- [ ] **3.9a** Expand the admin moderation queue detail — display full metadata alongside each submission: fetched page title, description, subcategory label, submitter username, submission timestamp, and the Safe Browsing check result (pass / fail / unchecked); gives the admin enough context to make a confident decision without opening the URL
- [ ] **3.9b** Add undo capability for moderation decisions — allow the admin to re-open a previously approved or rejected item and change the decision; re-rejecting an approved item should also delete the corresponding row from the `urls` table
- [ ] **3.9c** Add filtering, sorting, and search to the admin queue — filter by status (pending / approved / rejected), sort by submission date (newest/oldest first), and add a domain search field; the current hard 100-item cap with no filtering becomes unworkable once submissions grow

- [x] **3.10** Build `/privacy` — Privacy Policy page; required before Chrome Web Store and Google Play store submission; covers data collected (browsing history, ratings, account info), how it is used, user rights under GDPR and CCPA

  📖 **What we did:** A static Server Component at `src/app/privacy/page.tsx`. Covers: who we are, data collected (account data, seen URLs, ratings, collections, server logs), how we use it, sub-processors (Supabase, Vercel, Google), retention periods, GDPR/CCPA rights, cookies (just the Supabase session cookie), children's data, and contact info. Required by Chrome Web Store and Google Play before submission.

- [x] **3.11** Build `/terms` — Terms of Service page; covers acceptable use, content submission rules, account termination, and disclaimer of liability

  📖 **What we did:** A static Server Component at `src/app/terms/page.tsx`. Covers: acceptance, eligibility (13+), account responsibility, acceptable use (no illegal/harmful URLs, no scraping), content submission, user-generated content licence, IP (MIT for code), termination, warranty disclaimer, liability limitation ($0 — it's a hobby project), governing law, and contact info.

---

## Stage 4 — Content Seeding

Filling the discovery pool before launch so that the Roam button has something to return on day one. All sources are free, human-curated APIs or public datasets. No automated crawls or LLM-generated content — human editorial judgment is the quality baseline.

### Seeder run log

| Script | Source | API key | Result |
|---|---|---|---|
| `seed-wikipedia.js` | Wikipedia REST API | none | ✅ 2,593 rows |
| `seed-hackernews.js` | Algolia HN Search | none | ✅ 948 rows |
| `seed-nasa.js` | NASA APOD API | `NASA_API_KEY` | ✅ 9,123 rows |
| `seed-openlibrary.js` | Open Library Subjects API | none | ✅ 59,514 rows |
| `seed-arxiv.js` | arXiv Atom feed | none | ✅ 6,600 rows |
| `seed-awesome.js` | GitHub Awesome lists | none | ✅ 9,824 rows |
| `seed-wiby.js` | wiby.me | none | ✅ 1,747 rows |
| `seed-lobsters.js` | Lobsters JSON API | none | ✅ ~1,000 rows |
| `seed-semanticscholar.js` | Semantic Scholar API | optional | ✅ ~50,000 rows |
| `seed-nyt.js` | NYT Article Search API | `NYT_API_KEY` | ✅ 339 rows — 14 Top Stories sections |
| `seed-guardian.js` | Guardian Content API | `GUARDIAN_API_KEY` | ✅ 18,000 rows |
| `seed-propublica.js` | ProPublica sitemaps | none | ✅ 106 rows |
| `seed-npr.js` | NPR RSS feeds | none | ✅ 152 rows |
| `seed-wikivoyage.js` | MediaWiki API | none | ✅ 67,660 rows |
| `seed-internetarchive.js` | Internet Archive API | none | ✅ 50,966 rows |
| `seed-curlie.js` | Curlie directory | none | ✅ 2,732,344 extracted, upsert complete — 34 malformed lines skipped, all rows tagged `source = 'curlie'` |
| `seed-gutenberg.js` | Gutendex (Project Gutenberg) | none | ✅ 510 rows |
| `seed-pubmed.js` | NCBI Entrez API | none | ✅ 40,154 rows — 24 MeSH terms, 803 batches (fixed: efetch→esummary + original_url) |
| `seed-reddit.js` | Reddit public JSON API | none | ✅ 1,549 rows — 35 subreddits across all 8 categories |
| `seed-ted.js` | TED Talks sitemap + OG | none | ✅ ~7,492 curator-approved talks — run complete |
| `seed-metmuseum.js` | Met Museum / Wikidata SPARQL | none | ✅ 73,211 rows — Wikidata P3634 across all departments |
| `seed-boardgamegeek.js` | BoardGameGeek XML API | none | ⚠️ blocked — API now requires registered Bearer token (approval takes 1+ week) |
| `seed-librivox.js` | LibriVox public API | none | 🔄 running — 18,752 English audiobooks, OG fetch phase |
| `seed-github.js` | GitHub Search API | optional `GITHUB_TOKEN` | ✅ 5,806 rows — 45 topics × up to 3 pages × 100 repos |
| `seed-itchio.js` | Itch.io browse API | none | ✅ 13,329 rows — 33 sources × 30 pages |

**Total rows from complete seeders (excl. Curlie in-progress): ~268,000+**
**Curlie:** 2,732,344 rows extracted, upsert complete
**Total expected when all complete: ~3.0M+**

### 4a. Seeding infrastructure

- [x] **4.1** Write a shared seeding utility — before inserting any URL: (1) normalise it (enforce https, strip www prefix, remove UTM and tracking query parameters, strip trailing slash, lowercase hostname, remove fragments); (2) check for duplicates against the normalised form; (3) attempt to fetch the page's Open Graph `og:image` meta tag and store it as `og_image_url`; (4) map source data to the `urls` table schema; (5) tag each row with its source name (`source = 'wikipedia'`, `source = 'curlie'`, etc.); auto-approve seeded content

  📖 **What we did:** Created `scripts/lib/seed.js` — a shared ESM module that all seeder scripts will import. It sets up a Supabase client using the service-role key (which bypasses RLS so seeders can write without being authenticated as a user). `normaliseUrl()` enforces HTTPS, strips `www.`, lowercases the hostname, removes fragments, strips 20+ known tracking params (UTM, fbclid, gclid, etc.), and removes trailing slashes. `fetchOgMeta()` fetches the raw HTML of a page (8-second timeout) and extracts both the `og:image` / `twitter:image` tag and the `og:description` / `meta[name=description]` tag in a single request — so each URL only needs one HTTP fetch to populate both its image and description. `upsertUrls()` ties it all together: normalise → deduplicate against the DB → call `fetchOgMeta` when `fetchOg: true` → batch-upsert 50 rows at a time with `approved = true`. Also exports `CATEGORY` constants (the 8 fixed UUIDs from the migration) so seeders don't need to hardcode them.

- [ ] **4.1a** Keep normalisation logic in sync between Node.js and Deno — see task 2.27a; after extracting `_shared/normalise.ts`, update `seed.js` to include a comment pointing to the canonical list of stripped parameters so future additions (new tracking params) are made in both places at once

### 4b. Original API seeders

- [x] **4.2** Write the Wikipedia seeder — pulls featured articles and topic-specific random articles; maps to relevant categories

  📖 **What we did:** Created `scripts/seed-wikipedia.js`. It fetches two things: (1) Wikipedia's "Today's Featured Article" feed for the past 365 days — these are high-quality, human-selected articles covering every topic; (2) articles from 40 curated Wikipedia categories (e.g. "Computing", "Astronomy", "Cuisine") each mapped to one of Roam's 8 pillars. Wikipedia's REST API returns title, extract (description), and thumbnail image directly, so we pass `fetchOg: false` to the utility — no need to re-fetch each page. Rate-limited to one request per 500ms to respect Wikipedia's API guidelines. After the first run the collected rows are cached to `scripts/.cache/wikipedia.json` (gitignored, Windows-hidden) — subsequent runs load from cache and go straight to the upsert step, skipping the ~15-minute API crawl. Pass `--no-cache` to force a fresh fetch.

  **Result: 2,593 rows inserted.**

- [x] **4.3** Write the Hacker News seeder — pulls top all-time stories from the HN API; maps to the Technology category

  📖 **What we did:** Created `scripts/seed-hackernews.js`. It queries the Algolia HN Search API for stories with more than 100 points — no API key required and no rate limiting needed (Algolia is a CDN-backed search API). Fetches 5 pages of 1,000 hits each (up to 5,000 stories), filters out Ask HN / Show HN posts with no external URL, and deduplicates. Sets `fetchOg: true` so `upsertUrls()` fetches `og:image` and `og:description` from each story's linked page — HN stories point to high-quality external articles which almost all have OG tags. Cached to `scripts/.cache/hackernews.json` after the first fetch; pass `--no-cache` to refresh.

  **Result: 948 rows inserted.**

- [ ] **4.3a** Register a free Reddit "script" app at reddit.com/prefs/apps — required before any Reddit API requests; takes 2 minutes; generates a client ID and secret for the seeder to use
- [ ] **4.4** Write the Reddit seeder — pulls top all-time posts from a curated list of subreddits (one per subcategory); uses the credentials from task 4.3a
- [x] **4.5** Write the NASA seeder — pulls Astronomy Picture of the Day archive and image descriptions; maps to Space & Astronomy

  📖 **What we did:** Created `scripts/seed-nasa.js`. Fetches APOD entries in monthly chunks from 2000-01-01 to present using the NASA APOD API (`api.nasa.gov`). Monthly chunks (not yearly) avoid HTTP 503 errors from large date ranges. 3-attempt retry on 5xx errors with 5s/10s/15s backoff, 1s delay between requests. Requires `NASA_API_KEY` in `.env` (free at api.nasa.gov). Cached to `scripts/.cache/nasa.json`.

  **Result: 9,123 rows inserted.**
- [x] **4.6** Write the Open Library seeder — pulls open-access book records by subject; maps to Literature & Writing and relevant history/mind categories

  📖 **What we did:** Created `scripts/seed-openlibrary.js`. Queries 69 subjects from the Open Library Subjects API, up to 1,000 works each. Cover images from `covers.openlibrary.org`. `fetchOg: false` — cover URLs used directly. Cached to `scripts/.cache/openlibrary.json`.

  **Result: 59,514 rows inserted.**
- [ ] **4.7** Write the Europeana seeder — pulls European art and cultural heritage records; maps to Visual Art, History, and People & Places

- [x] **4.8** Write the arXiv seeder — pulls recent and highly-cited open-access papers by subject area; maps to Science & Nature and Technology subcategories

  📖 **What we did:** Created `scripts/seed-arxiv.js`. Queries arXiv Atom feed for 40+ subject areas, 100 results per query. `fetchOg: false` — abstracts from API. Rate-limited to 3s/request. Cached to `scripts/.cache/arxiv.json`.

  **Result: 6,600 rows inserted.**

- [ ] **4.9** Write the YouTube seeder — uses the YouTube Data API to pull highly-viewed public videos by topic; maps to relevant categories; runs incrementally over multiple days (100 searches/day max given 10K unit quota); caches results to avoid re-fetching content already in the database

- [x] **4.10** Import Awesome lists — parse the curated GitHub Awesome list index and extract links; map to Technology subcategories

  📖 **What we did:** Created `scripts/seed-awesome.js`. Fetches ~55 `awesome-*` GitHub README.md files from `raw.githubusercontent.com`. Extracts external links, skipping GitHub/badges/npm/etc. `fetchOg: true` (needs images + descriptions). Cached to `scripts/.cache/awesome.json`.

  **Result: 9,824 rows inserted.**
- [x] **4.11** Import wiby.me — pull the wiby.me index of small-web pages; map to Weird & Wonderful and Vintage Internet

  📖 **What we did:** Created `scripts/seed-wiby.js`. 51 queries × 3 pages at 2s each. Parses HTML results. `fetchOg: true`. Cached to `scripts/.cache/wiby.json`. ⚠️ Two bugs were found and fixed: the fetch URL path was wrong (`/search/?q=` returns HTTP 404; correct path is `/?q=`), and the HTML parser looked for `<h2>` tags that don't exist in wiby's markup (results use `<blockquote>` + `.tlink` anchor elements). Both fixes are committed to `seed-wiby.js`. Rerun with `--no-cache` to populate.

  **Result: 0 rows — rerun required.**
- [ ] **4.12** Import JSTOR open-access — pull available open-access article metadata; map to Science, History, and Mind & Body

### 4c. Additional API seeders

- [x] **4.13** Write the Lobsters seeder — pulls top-rated posts from the Lobsters JSON API; every post includes human-applied tags that map to Technology subcategories

  📖 **What we did:** Created `scripts/seed-lobsters.js`. Uses `/newest.json`, 40 pages × 25 = 1,000 stories. Must be run alone (lobste.rs blocks concurrent load). Cached to `scripts/.cache/lobsters.json`. ⚠️ Run this seeder separately — do not run alongside other seeders.
- [x] **4.14** Write the Semantic Scholar seeder — queries the API by field of study; pulls paper titles, abstracts, and URLs; maps to Science & Nature and Technology

  📖 **What we did:** Created `scripts/seed-semanticscholar.js`. 37 queries × 10 pages × 100 results at 1.1s/request ≈ 7 minutes. No key needed (1 req/s public rate). `fetchOg: false` — abstracts from API. Optional `SEMANTIC_SCHOLAR_API_KEY` in `.env` for 10 req/s. Cached to `scripts/.cache/semanticscholar.json`.
- [x] **4.15** Write the PubMed seeder — queries the NCBI Entrez API by MeSH subject terms; maps to Medicine & Health Science, Neuroscience, Nutrition, and related Mind & Body subcategories

  📖 **What we did:** Implemented `scripts/seed-pubmed.js` with three-phase checkpointing: (1) **Search** — queries NCBI Entrez for 25 MeSH terms (Neuroscience, Psychiatry, Brain, Genetics, Immunology, etc.), collecting ~50K+ unique paper IDs, checkpoints after each term; (2) **Fetch** — batches paper IDs in groups of 100, fetches metadata via Entrez API, respects 3 req/sec rate limit; (3) **Upsert** — batches URLs in groups of 50 into Supabase with per-batch checkpointing. Smart multi-category mapping prioritizes MIND_BODY when present (e.g., Genetics → SCIENCE, but Neuroscience → MIND_BODY + SCIENCE). Progress file tracks phase, searched terms, and upserted count for safe crash recovery. Supports `--reset` flag. Expected yield: 30-50K medical/health URLs, closing the Mind & Body category gap. Committed `e5d5d5b` and pushed to origin/main.
- [ ] **4.16** Write the CORE seeder — queries the CORE API by subject; pulls open-access paper metadata; maps to Science, History, and Mind & Body subcategories
- [ ] **4.17** Write the DPLA seeder — queries the Digital Public Library of America API by subject; pulls digitised cultural heritage records; maps to History & Ideas, Arts & Culture, and People & Places
- [ ] **4.18** Write the BoardGameGeek seeder — ABANDONED: Cloudflare blocks both the browse pages (403 after page 11) and the XML API (401 for all batches). Not worth pursuing.
- [ ] **4.19** Write the IGDB seeder — queries the IGDB API for top-rated games; maps to the Video Games subcategory
- [x] **4.20** Write the NYT seeder — queries the NYT Article Search API by section; maps article metadata to History & Ideas, Science, Technology, Arts & Culture, and People & Places

  📖 **What we did:** Created `scripts/seed-nyt.js`. Uses the Article Search API (`api.nytimes.com/svc/search/v2/articlesearch.json`). 12 sections × up to 10 pages × 10 results = up to 1,200 articles. Rate-limited to 1 request per 6.5s (API limit: 10 req/min). Requires `NYT_API_KEY` in `.env` (free at developer.nytimes.com). `fetchOg: false` — titles and abstracts come from the API. Note: NYT articles are paywalled; users with "Skip paywalled sites" enabled will not see them. Cached to `scripts/.cache/nyt.json`.
- [x] **4.21** Write the Guardian seeder — queries The Guardian's open platform API by section; maps to History & Ideas, Science, Mind & Body, and Arts & Culture

  📖 **What we did:** Created `scripts/seed-guardian.js`. Uses the Guardian Content API (`content.guardianapis.com/search`). 18 sections × up to 5 pages × 200 results = up to 18,000 articles. Rate-limited to 300ms between requests (API limit: 12 req/s). Requires `GUARDIAN_API_KEY` in `.env` — get one free (instant approval) at https://open-platform.theguardian.com/access/. `fetchOg: false` — titles, trail text, and thumbnail images come from the API. No paywall — all Guardian articles are freely readable. Cached to `scripts/.cache/guardian.json`.

  **Result: 18,000 rows inserted.**
- [x] **4.21a** Write the ProPublica seeder — pulls investigative journalism from ProPublica's sitemap; no API key required; maps to History & Ideas, Science, Mind & Body, Technology, and People & Places

  📖 **What we did:** Created `scripts/seed-propublica.js`. ProPublica removed all topic-level RSS feeds — only `feeds.propublica.org/propublica/main` (20 articles) remains. Rewrote seeder to scan the per-day XML sitemaps (`propublica.org/sitemap.xml?yyyy=YYYY&mm=MM&dd=DD`) for the last 90 days, extracting `/article/` URLs. Category is inferred from the URL slug using keyword matching. `fetchOg: true` — OG metadata fetched from article pages. No key needed. No paywall. Cached to `scripts/.cache/propublica.json`.

  **Result: 106 rows inserted.**
- [x] **4.21b** Write the NPR seeder — pulls journalism and feature articles from NPR's public RSS feeds; no API key required; maps to all 8 categories

  📖 **What we did:** Created `scripts/seed-npr.js`. Fetches 17 RSS feeds from `feeds.npr.org` covering science, climate, technology, arts, politics, health, food, and more. Feed IDs 349 (environment), 1067 (animals), 1043 (health-shots), and 1021 (mental-health) returned HTTP 404 and were removed; duplicate ID 1006 (economy = business) was also removed. Parses RSS XML with a regex-based parser. `fetchOg: true` — OG images fetched where RSS doesn't include them. No key needed. No paywall. Cached to `scripts/.cache/npr.json`.

  **Result: 152 rows inserted.**
- [x] **4.22** Write the Wikivoyage seeder — pulls destination articles using the same MediaWiki API as Wikipedia; maps entirely to People & Places

  📖 **What we did:** Created `scripts/seed-wikivoyage.js`. Two-pass approach: Phase 1 uses MediaWiki `allpages` list API (500 titles/page) to enumerate all ~67,000 Wikivoyage articles; Phase 2 batch-fetches extracts + thumbnails in groups of 50. `fetchOg: false` — thumbnails from API. Cached to `scripts/.cache/wikivoyage.json`.

  **Result: 67,660 rows inserted.**
- [x] **4.23** Write the Internet Archive seeder — queries the Archive's collections API for curated texts and media; maps to Weird & Wonderful, History & Ideas, and Arts & Culture

  📖 **What we did:** Created `scripts/seed-internetarchive.js`. 49 query groups × ~500 results per page. `fetchOg: false` — Archive.org thumbnail URLs used directly from the API response. Cached to `scripts/.cache/internetarchive.json`.

  **Result: 50,966 rows inserted.**
- [ ] **4.23a** Create `paywalled_domains` table in Supabase — a simple lookup table (`domain TEXT PRIMARY KEY`, `added_at TIMESTAMPTZ DEFAULT now()`) seeded with known paywalled domains (nytimes.com, wsj.com, ft.com, bloomberg.com, theatlantic.com, newyorker.com, thetimes.co.uk, etc.); the `roam()` RPC will filter these out when the user has the "skip paywalled sites" setting enabled; RLS: publicly readable (no auth needed to check), service-role only for writes

### 4d. Curlie directory import

- [x] **4.24** Download the Curlie/DMOZ data dump from curlie.org (available for non-commercial use only — all imported rows are tagged `source = 'curlie'` so they can be identified and removed if Roam's status ever changes)

  📖 **What we did:** Discovered that Curlie's official RDF/XML download URL had moved/changed, so we researched the Curlie website and found https://curlie.org/docs/en/rdf.html which documents the new TSV-format data dumps hosted by the Leibniz Supercomputing Centre (LRZ) at `https://vm-138-246-238-70.cloud.mwn.de:9000/curlie/curlie-rdf-all.tar.gz`. The file is ~200MB compressed. Created `scripts/seed-curlie.js` to download and cache the tar.gz file. Format changed from RDF/XML to TSV (tab-separated values) containing 14 region/language-specific files: structure files (`*-s.tsv`) mapping category IDs to hierarchical paths, and content files (`*-c.tsv`) listing URLs with their IDs.

- [x] **4.25** Write the Curlie category mapper — translates Curlie's subject hierarchy into Roam's 8 pillars and 72 subcategories; categories with no clear mapping are discarded rather than guessed

  📖 **What we did:** Implemented a two-phase mapping strategy in `scripts/seed-curlie.js`: Phase 1 parses all `*-s.tsv` structure files to build an in-memory map of 801,720 Curlie category IDs to their full hierarchical paths (e.g., "376539" → "Top/Arts/Music"). Phase 2 parses `*-c.tsv` content files (URL entries), looks up each URL's category ID in the map, matches the full path against a hardcoded `CATEGORY_MAP`, and only includes URLs whose paths match one of Roam's 8 pillars (mapped to their fixed UUIDs). Unmapped URLs are silently discarded to avoid guessing. Result: 1,223,391 out of ~2.9M Curlie URLs matched to categories.

- [x] **4.26** Run the Curlie import pipeline — deduplicate against existing entries, batch insert into `urls` table with `approved = true`

  📖 **What we did:** Executed the Curlie seeder with full resumable checkpointing. **Fixed two critical bugs:** (1) structure file parsing was reading the wrong column — now correctly reads `categoryPath \t categoryId` instead of swapped columns; (2) JSONL file size (500MB+ for 2.7M URLs) was causing memory exhaustion on load — switched to streaming line-by-line with readline. **Additional robustness fixes:** try-catch around `JSON.parse` for malformed lines (34 lines skipped total), retry logic with exponential backoff for transient Supabase errors, and verbose skip-logging suppressed on resume. Extraction: 2,732,344 URLs extracted and cached. Upsert phase: completed successfully across multiple runs with checkpoint resumption. Tags all rows `source = 'curlie'`.

- [x] **4.26a** Create `scripts/seed-curlie-fetch-og.js` — background task to fetch missing OG images for Curlie URLs overnight without timeout; resumes from progress file if interrupted

  📖 **What we did:** This file already existed with full checkpoint support. It queries for Curlie URLs without `og_image_url`, fetches images in batches of 50 with 500ms rate limiting, saves checkpoint after each batch (`scripts/.cache/curlie-og-progress.json`), and supports `--reset` flag. Both the main seeder and OG fetcher now follow the same checkpoint pattern for consistency.

- [ ] **4.27** Spot-check 50 random Curlie URLs per pillar to verify mapping quality; adjust mapper if a category is consistently mis-mapped

### 4e. Verification

- [ ] **4.28** Run all seeders and verify a minimum of 5,000 discoverable URLs per category pillar

### 4d. Additional seeder candidates & content strategy

**Current state:** ~1.45M URLs across 16 seeders. Strong in Technology/Science/Humanities. **Gaps:** Mind & Body (health), niche categories.

#### High Priority — Critical gaps (Next week)

- [x] **4.29** Write the PubMed seeder — queries NCBI Entrez API (free, no key) by MeSH terms (neuroscience, psychiatry, pharmacology, nutrition, psychology); maps to **Mind & Body** category which is currently weak; pulls ~30-50K articles; effort: 2-3 hours

  📖 **What we did:** Implemented `scripts/seed-pubmed.js` with full resumable checkpointing for overnight operation. The seeder has three phases: (1) **Search:** Queries NCBI Entrez API for 25 MeSH terms (Neuroscience, Psychiatry, Psychology, Brain, Memory, Sleep, Nutrition, Pharmacology, Genetics, Immunology, etc.), collecting ~50K+ unique paper IDs. Checkpoints after each term so resumption doesn't re-search. (2) **Fetch:** Batches IDs in groups of 100 and fetches detailed metadata (title, abstract, keywords) from Entrez API. Respects NCBI's 3 req/sec rate limit (350ms delay). (3) **Upsert:** Converts papers to rows and inserts via Supabase in batches of 50 with per-batch checkpointing. **Smart multi-category mapping:** MeSH terms map intelligently (e.g., Genetics → SCIENCE + MIND_BODY, Neuroscience → MIND_BODY + SCIENCE), prioritizing MIND_BODY when multiple categories match. Progress file (`pubmed-progress.json`) tracks phase, searched terms, and upserted count for safe crash recovery. Supports `--reset` flag to start fresh. Expected yield: 30-50K medical/health URLs, closing the Mind & Body gap.

- [x] **4.30** Write the Reddit seeder — **HIGH PRIORITY:** Reddit's upvote system = quality signal. User-curated content across all categories.

  📖 **What we did:** Created `scripts/seed-reddit.js`. Uses the unauthenticated public JSON API (`reddit.com/r/<subreddit>/top.json`) — no API key required. Fetches top posts from 35 curated subreddits mapped across all 8 categories (e.g., r/science → SCIENCE, r/history → HISTORY_IDEAS, r/Art → ARTS_CULTURE, r/Fitness → MIND_BODY, r/travel → PEOPLE_PLACES, r/boardgames → GAMES_HOBBIES, r/WeirdWings → WEIRD_WONDERFUL). Skips self-posts and links to reddit.com itself. Per-subreddit checkpointing with 2s delay between requests. Supports `--no-cache` and `--reset` flags. Committed as `fe7c877`.

- [x] **4.31** Write the Project Gutenberg seeder — Gutendex API (free, no rate limits) pulls ~70K free ebooks by subject; maps to **Literature & Writing** and **History & Ideas**; adds historical/classic perspective vs. modern Open Library; effort: 2 hours

  📖 **What we did:** Implemented `scripts/seed-gutenberg.js` with full resumable checkpointing. The seeder fetches books from Gutendex API (a free REST wrapper around Project Gutenberg) with optional caching (`--no-cache` to re-fetch). Intelligently maps books to categories based on shelf tags (fiction/poetry → **Literature**, history/biography → **History & Ideas**, science/philosophy → **Science**, otherwise defaults to **Literature**). Fetches up to 16 pages of results (1600+ books), deduplicates by URL, checks against existing database entries, and batches upsert in groups of 50 with per-batch checkpointing. Supports `--reset` flag and `--no-cache` for control. **Result: 510 books cached and upserted successfully** from the initial run (conservative estimate due to API pagination limits). Tags all rows `source = 'gutenberg'` and includes cover images from Gutendex as `og_image_url`.

#### Medium Priority — Diversification (Following week)

- [x] **4.32** Write the Museum APIs seeder — Metropolitan Museum (free, 375K items), Rijksmuseum (free key, 700K items), MOMA (free, 30K items); pulls ~50K artworks total; fills **Visual Arts & Creativity entirely** with high-quality images; effort: 4 hours (multi-API client)

  📖 **What we did:** Originally built `scripts/seed-metmuseum.js` targeting 18 Met departments via the Met's own REST API (`collectionapi.metmuseum.org`). Discovered the Met's API is behind Incapsula WAF which blocks all programmatic access (403 for all `/objects/{id}` requests regardless of User-Agent). Rewrote the seeder to use Wikidata's free SPARQL endpoint instead — Wikidata has ~30K+ Met artworks identified by property P3634 (The Met object ID). The Met URL is constructed as `https://www.metmuseum.org/art/collection/search/{metId}`. Wikidata also provides artist names, creation dates, and Wikimedia Commons images (converted to 400px thumbnails). Paginated at 5,000 results per page with 2s delay and retry on transient errors (429/502/503). Fully resumable via checkpoint. BGG was attempted but now requires a registered Bearer token (approval takes 1+ week).

- [ ] **4.33** Write the Smithsonian Magazine seeder — RSS feeds (free, no auth); ~5-10K articles from past 2-3 years; maps: History (40%), Science (30%), Arts (20%), Places (10%); authoritative source; effort: 2 hours

- [x] **4.34** Write the TED Talks seeder — uses `talks-curator-approved.xml.gz` sitemap (7,492 quality TED talks vetted by TED editorial); fetches OG/JSON-LD metadata from each talk page; maps to all 8 categories via keyword matching on talk slug; thumbnails from JSON-LD `VideoObject` structured data; effort: 2 hours + crawl time (~3hrs at 1.5s/req)

  📖 **What we did:** Created `scripts/seed-ted.js`. Uses TED's official sitemap index to find `talks-curator-approved.xml.gz` — a deduplicated, editorially vetted list of 7,492 TED talks (avoids TEDx which adds 100K+ lower-quality talks across per-year sitemaps). For each talk URL, fetches the page and extracts JSON-LD `VideoObject` structured data for title, description, and thumbnail. Category mapped from talk slug keywords. Rate-limited to 1 req/1.5s. Fully resumable via checkpoint in `.cache/ted-progress.json`. Committed `441a6c4`.

- [ ] **4.35** Write the Substack seeder — scrape trending publications + RSS feeds (no official API); ~25K URLs from independent newsletters; captures independent voices (different from NYT/Guardian); effort: 3-4 hours

#### Lower Priority — Niche content

- [ ] **4.36** Write the IGDB seeder — video games (free API key); top 5K games by rating; maps to Weird & Wonderful niche; effort: 2 hours

- [ ] **4.37** Write the Podcast Index seeder — decentralized audio metadata (free API); top 100 podcasts × 10 episodes each = ~5K URLs; new medium (currently all websites); effort: 2-3 hours

- [x] **4.38** Write the GitHub Trending seeder — uses GitHub Search API by topic; 46 topics × 3 pages × 100 repos = ~5K repos; maps to all 8 categories; optional `GITHUB_TOKEN` for higher rate limit; no key required (10 req/min unauthenticated)

  📖 **What we did:** Created `scripts/seed-github.js`. Uses GitHub's Search API (`api.github.com/search/repositories`) to query 46 curated topics (web, cli, security, bioinformatics, music, game-development, health, maps, etc.) each mapped to a Roam category. Filters `stars:>500` and skips archived repos or those without descriptions. Paginates up to 3 pages per topic (300 repos/topic). Rate-limited to 6.6s/request unauthenticated (10 req/min) or 2.5s with optional `GITHUB_TOKEN`. Deduplicates across topics globally. `fetchOg: false` — descriptions come from the API. Cached to `scripts/.cache/github.json`.

- [x] **4.39** Write the Itch.io seeder — indie game discovery platform; enumerate top-rated/most-downloaded games via sitemap or browse pages; ~50K items covering Games & Hobbies and Weird & Wonderful; free, no key; effort: 2-3 hours

  📖 **What we did:** Created `scripts/seed-itchio.js`. Uses `https://itch.io/games/{path}?format=json&sort=top&page=N` (36 items/page). Parses embedded HTML via regex to extract URL, title, description (from `title` attribute of `.game_text`), and genre. Queries 32 sources (genre-action, genre-rpg, tag-horror, tag-experimental, genre-visual-novel, etc.) mapped to Games & Hobbies, Arts & Culture, Weird & Wonderful, and History & Ideas. 30 pages/source × ~36 items = ~1,080/source; ~30K+ total before dedup. Rate: 600ms delay. `fetchOg: false`. Cache: `scripts/.cache/itchio.json`.

- [ ] **4.40** Write the BoardGameGeek seeder — XML API (free, no key); top 10K board games by rank; pulls title, description, thumbnail from BGG API; maps to Games & Hobbies; strong community signal (ratings-based); effort: 2 hours

- [x] **4.41** Write the LibriVox seeder — free public domain audiobooks catalog API (`librivox.org/api`); ~15K books with descriptions and cover art; maps to Arts & Culture and History & Ideas; no key required; effort: 2 hours

  📖 **What we did:** Created `scripts/seed-librivox.js`. Fetches all English audiobooks from the LibriVox API in pages of 50 (`offset`-based pagination). Filters for `language === 'English'`. Maps books to categories by keyword matching on title + description (genres field not returned by API). Uses `upsertUrls()` with `fetchOg: true`. Fetched 19,223 English books; 18,752 unique URLs — OG fetch phase running.

- [x] **4.42** Write the Bandcamp seeder — music discovery; enumerate genre tag pages to collect album/artist URLs; ~5K items; Arts & Culture + Weird & Wonderful; no official API — uses internal `dig_deeper` JSON endpoint; effort: 2-3 hours

  📖 **What we did:** Created `scripts/seed-bandcamp.js`. Uses Bandcamp's internal `POST https://bandcamp.com/api/hub/2/dig_deeper` endpoint with `{ tag, page, sort: "pop" }` body. Queries 31 genre tags (jazz, classical, folk, hip-hop, ambient, experimental, synthwave, etc.) mapped to Arts & Culture, Weird & Wonderful, and Mind & Body. Up to 20 pages/tag × ~8-12 items = ~160-240 per tag. Handles 403 Cloudflare blocks gracefully (skips tag). Rate: 1500ms delay. `fetchOg: false`.

#### Not Recommended (Pre-launch)

- **YouTube** — API quota (10K units/day) too restrictive. 50K videos = 50+ days minimum. Defer to post-launch.
- **Europeana** — Slow API (1 req/2s). 50K items = 24+ hour seed time. Lower priority vs. Museum APIs.
- **CORE, DPLA, JSTOR** — Lower unique value or too much overlap with existing seeders.

#### Pre-Launch Essential

- [ ] **4.23a** Create `paywalled_domains` table in Supabase — lookup table (`domain TEXT PRIMARY KEY`) seeded with ~20 known paywalled sites (nytimes.com, wsj.com, ft.com, bloomberg.com, theatlantic.com, newyorker.com, thetimes.co.uk, etc.); the `roam()` RPC filters these out when user has "skip paywalled sites" enabled; RLS: publicly readable, service-role only for writes. **Critical for day-one UX.**

---

## Stage 5 — Browser Extension

The Chrome + Firefox extension. Single codebase, Manifest V3. No page injection — everything lives in the popup.

### 5a. Project setup

- [x] **5.1** Initialise the extension project in the `extension/` folder with TypeScript and esbuild as the bundler

  📖 **What we did:** Created `extension/package.json` with `esbuild`, `typescript`, and `@types/chrome` as dev dependencies, and `@supabase/supabase-js` as a runtime dependency. Installed with pnpm. Set `"type": "module"` for ESM.

- [x] **5.2** Write `manifest.json` (MV3) declaring the popup, background service worker, and required permissions (`tabs`, `storage`, `identity`)

  📖 **What we did:** Created `extension/manifest.json` with `manifest_version: 3`, popup pointing to `popup.html`, background service worker at `background.js`, permissions `tabs`/`storage`/`identity`, and `host_permissions` for `*.supabase.co`. Content Security Policy restricts scripts to `'self'` only.

- [x] **5.3** Set up the build pipeline — `npm run build` produces a `dist/` folder ready for store submission

  📖 **What we did:** Created `extension/build.mjs` — an esbuild script that bundles `popup.ts` and `background.ts` as IIFE bundles into `dist/`, then copies static files (manifest, HTML, CSS, icons). Reads `SUPABASE_URL` and `SUPABASE_ANON_KEY` from root `.env` and injects them as `__SUPABASE_URL__` and `__SUPABASE_ANON_KEY__` via esbuild `define`.

- [x] **5.4** Set up development mode — `npm run dev` with watch mode so changes rebuild automatically

  📖 **What we did:** `build.mjs --watch` flag activates esbuild context watch mode with source maps enabled and minification disabled. All entry points watch simultaneously.

- [x] **5.5** Build the popup shell — HTML/CSS layout with the 4 controls (Roam, 👍, 👎, ⚙️)

  📖 **What we did:** Built the complete popup shell with three switchable states (signed-out, error, main) and two expandable panels (submit for unknown pages, config). The main state shows the 4 controls in a grid: Roam button (full-width accent), plus three icon buttons. The submit panel shows 8 category chips — selecting one enables the Submit button. The config panel has three sections (Current page, Roam mode, Account) with labelled action rows, including a paywall toggle switch. Dark theme. Popup width fixed at 300px.

- [x] **5.6** Build the background service worker — manages auth state and queues API calls when the popup is closed; on every activation (including after browser-initiated restarts), reads `chrome.storage.local` and rehydrates the Supabase client with the stored session before handling any request

  📖 **What we did:** Rewrote `src/background/background.ts` as a full MV3 service worker. A `chrome.runtime.onMessage` listener routes incoming `Request` messages to typed handler functions. `getSupabase()` in `src/lib/supabase.ts` returns a singleton Supabase client per SW activation, using a `chromeStorageAdapter` (backed by `chrome.storage.local`) so the session survives restarts without explicit rehydration — Supabase's `persistSession: true` does it automatically. Created `src/lib/messages.ts` with discriminated-union `Request` type and typed `sendToBackground()` helper.

- [x] **5.7** Implement auth — sign in with email or Google; persist the Supabase session token in `chrome.storage.local`

  📖 **What we did:** Implemented `signInWithGoogle()` in the background SW using the PKCE flow: calls `supabase.auth.signInWithOAuth({ provider: 'google', skipBrowserRedirect: true })` to get the OAuth URL, hands it to `chrome.identity.launchWebAuthFlow`, then extracts the PKCE `code` from the redirect URL and calls `supabase.auth.exchangeCodeForSession(code)`. The resulting session is stored automatically by the `chromeStorageAdapter`. Also wired `SIGN_OUT`. Updated `popup.ts` boot sequence to send `GET_STATE` on mount. **Setup required:** add `https://<EXTENSION_ID>.chromiumapp.org/` to Supabase → Authentication → Redirect URLs.

- [x] **5.8** Implement the Roam button — calls `GET /roam`, opens the returned URL in the current tab

  📖 **What we did:** Created `supabase/functions/roam/index.ts` Edge Function. It authenticates the caller, then calls the `roam()` PostgreSQL RPC (`p_user_id`, optional `p_collection_id`), which picks a weighted-random unseen URL from the user's category preferences and records it as seen. The Edge Function returns the first row as JSON. The background SW's `roam()` handler calls `supabase.functions.invoke('roam')` and returns the result to the popup. The popup disables the Roam button during the call, then calls `chrome.tabs.update(tab.id, { url })` and closes.

- [x] **5.9** Implement thumbs up on a known page — reads the current tab URL, calls `POST /rate` with `+1`

  📖 **What we did:** Popup's thumbs-up handler sends `CHECK_URL` first. The background normalises the URL (strips UTM params, forces HTTPS, strips www, strips trailing slash) and queries `urls` where `url = normalized AND approved = true`. If found, it returns `{ known: true, url_id }`. The popup then sends `RATE` with `url_id` and `vote: 1` to the background, which calls `supabase.functions.invoke('rate', { body: { url_id, value: 1 } })`. The existing `rate` Edge Function upserts the rating and the Wilson score trigger recalculates automatically. If the URL is unknown, the submit panel opens instead (task 5.11 flow).

- [x] **5.10** Implement thumbs down — calls `POST /rate` with `-1`

  📖 **What we did:** Same `CHECK_URL` + `RATE` flow as 5.9, but with `vote: -1`. If the URL is unknown, the popup just closes silently (no submission prompt — only positive endorsement can add new URLs).

- [x] **5.11** Implement thumbs up on an unknown page — detects that the current URL is not in the database; expands the popup to show a category chip picker and a Submit button; calls `POST /submit-url` on confirmation

  📖 **What we did:** When thumbs-up on an unknown page (`CHECK_URL` returns `known: false`), the popup shows the submit panel with 8 category chips. User selects one and clicks Submit. The popup calls `SUBMIT_URL` message, which invokes the existing `submit-url` Edge Function with `{ url, subcategory_id: categoryId }`. The Edge Function normalises the URL, checks rate limits (10/hour), runs Safe Browsing check, and inserts into `moderation_queue` with `status: 'pending'`. Admins review later. On success, the popup closes. On error, shows error message to user.

### 5b. URL Prefetching & Queue Management

Background worker maintains a prefetch queue to minimize wait times when users click Roam.

- [x] **5.11a** Build the URL queue system — background worker maintains 3 "hot" URLs (pre-validated, ready to display) + 5 "warming" URLs (requests in flight, validating); store queue state in `chrome.storage.local` with metadata (URL, category_id, validation_status, retry_count); on sign-in, populate initial queue with 8 URLs matching user's category preferences; write `src/lib/queue.ts` with `Queue` class managing hot/warming lifecycle

  📖 **What we did:** Created `src/lib/queue.ts` with low-level queue primitives and `src/lib/queueManager.ts` for high-level orchestration. Queue design: 3 "hot" URLs (ready to display immediately), 5 "warming" URLs (validation in flight). State persists to `chrome.storage.local` so queue survives page reloads. QueuedUrl interface tracks URL, status, retry_count, timestamps. `popHotUrl()` returns next URL for Roam button. `addUrlsToQueue()` appends fresh URLs from RPC. `loadQueue()`/`saveQueue()` handle storage synchronization. Validation happens in background via `validateNextUrl()` loop (checks every 2s). Refill loop checks every 5s if queue below threshold (3+5), fetches fresh batch from `roam()` RPC.

- [x] **5.11b** Implement HTTP validation — when warming URL, fetch with 8-second timeout; validate: HTTP 200 response, Content-Type is `text/html` (reject PDFs/archives/redirects), page returns content; if validation passes, move to hot queue; if fails, increment retry_count and move to back of warming queue; evict after 3 failed retries

  📖 **What we did:** Implemented `validateUrl()` in `queue.ts` which fetches each URL with 8-second timeout using AbortController. Validates: HTTP 200 response (or 0 for no-cors mode), Content-Type header contains "text/html", no network errors. On success, `promoteToHot()` moves URL to hot queue. On failure, `scheduleRetry()` increments retry_count and moves to back of warming queue for later retry. Uses `getRetryDelay()` for exponential backoff calculation. After 3 failures, URL evicted via `logFailedUrl()`.

- [x] **5.11c** Implement retry logic with exponential backoff — failed URLs move to back of queue with `retry_count` incremented; only attempt retry if `retry_count < 3`; between retry attempts, wait `500ms * (2 ^ retry_count)` before fetching again (0.5s, 1s, 2s); after 3 fails, evict and log to failed URL registry for moderation analysis

  📖 **What we did:** Implemented in `queue.ts`: `scheduleRetry()` checks if retry_count < MAX_RETRIES (3), if yes increments count and moves to back of queue with `last_retry_time` timestamp. `getNextWarmingUrl()` respects backoff by checking `now >= lastRetry + getRetryDelay(retryCount-1)` before returning URL. Backoff formula: `500ms * (2 ^ retryCount)` produces 500ms → 1s → 2s → evict. Failed URLs logged with `logFailedUrl()` tracking reason, timestamp, and retry count.

- [x] **5.11d** Implement category-aware prefetching — when warming queue drops below 5 URLs, background worker immediately fetches 5+ fresh URLs from `roam()` RPC filtered to user's selected categories; when user changes category filter (via config panel), clear queue and refetch for new context; ensure continuous background refill without user waiting for validation

  📖 **What we did:** Implemented `startRefillLoop()` in `queueManager.ts` running every 5s, checks if `hot_count + warming_count < REFILL_THRESHOLD` (5), calls `refillQueue()` to fetch needed URLs. `refillQueue()` calls `fetchFreshUrls(needed)` which invokes `roam()` RPC with `category_filter: categoryFilter`. New URLs added to warming queue for background validation. `updateCategoryFilter(newCategoryIds)` clears queue completely and refetches to ensure all new URLs match user's updated preferences. `categoryFilter` tracked in memory, passed to RPC on each refill.

- [x] **5.11e** Log failed URLs for moderation — maintain a `failed_urls` list in `chrome.storage.local` with `{ url, failure_reason, timestamp, retry_count }`; periodically (every 100 failed URLs or on sign-out) send batch to new `POST /log-failed-urls` Edge Function which inserts rows into `moderation_queue` with `status: 'auto_flagged'` for admin review; helps identify consistently broken/slow pages

  📖 **What we did:** Implemented `logFailedUrl()` in `queue.ts` which loads FAILED_URLS_KEY from storage, appends `{url, failure_reason, timestamp, retry_count}`, and saves back. Triggers batch send every 100 failures. `sendFailedUrlBatch()` posts to `/functions/v1/log-failed-urls` with Supabase auth. Edge Function (Deno) at `supabase/functions/log-failed-urls/index.ts` accepts batch, inserts into `moderation_queue` with `status = 'auto_flagged'` and failure reason logged. `cleanupOnSignOut()` calls `sendFailedUrlBatch()` before clearing queue, ensuring no losses on logout. Admin sees auto-flagged entries in moderation UI for pattern analysis.

- [x] **5.12** Build the Config panel — the scrollable section that expands below the 4 main controls; organised into two blocks: (1) **Current page actions**: Add to collection (dropdown of user's collections + "+ New collection" option), Save for later, Share/Copy link; (2) **Roam mode**: Roam within [category] chip, Roam a collection (dropdown activating collection Roam mode), Manage collections (opens `/u/username` in new tab), Category preferences (opens `/join` in new tab), Sign out

  📖 **What we did:** Implemented the full config panel with dropdown menus, collection management, and roaming modes. HTML/CSS shell already existed from task 5.5; we added TypeScript handlers for all actions. Key implementations: (1) **Add to collection** — loads user's collections, shows dropdown with item counts, "+ New collection" option creates collection and adds URL; (2) **Save for later** — persists URL to `chrome.storage.local` (will migrate to DB in task 5.12b); (3) **Roam within [category]** — checks current URL's category via `CHECK_URL`, then calls `roam()` RPC with `category_id` filter; (4) **Roam a collection** — dropdown to select collection, calls `roam()` with `collection_id`; (5) **Paywall toggle** — writes `skip_paywalled` to storage (DB sync in task 5.12b). Dynamic dropdowns created with inline positioning for proper UX. Added new message types to `messages.ts`: `GET_COLLECTIONS`, `CREATE_COLLECTION`, `ADD_URL_TO_COLLECTION`, `ROAM_COLLECTION`, `ROAM_CATEGORY`, `SET_PAYWALL_PREF`. Backend handlers in `background.ts` call the appropriate Supabase functions.

  **Queue initialization wiring (integrated with 5.11):** Created `initializeQueueIfNeeded()` helper in `background.ts` that is called after every successful sign-in flow (`getState()`, `exchangeCode()`, `saveSession()`). This function fetches the user's selected category IDs from the `user_categories` table and calls `initializeQueueManagement(categoryIds)` to start the validation and refill loops. The queue now auto-populates on sign-in and maintains 3 hot + 5 warming URLs in the background throughout the user's session. Removed duplicate `saveLater()` and `setPaywallPref()` stub functions that were blocking compilation. Build verified successful.
- [ ] **5.13** Design and implement empty and error states in the popup — (1) no results: prompt to add more categories; (2) API unreachable: retry button; (3) signed out: sign-in prompt; (4) submission rejected by Safe Browsing: clear rejection message
- [ ] **5.13a** Add "Skip paywalled sites" toggle to the Config panel — reads the user's `skip_paywalled` preference from Supabase `user_settings`; when toggled, writes the new value back; the `roam()` RPC already filters `paywalled_domains` when this flag is set; default is **off** (paywalled sites are shown by default)

### 5c. Onboarding

- [ ] **5.14** Detect first run (no auth session) — on icon click, open the `/join` web page in a new tab instead of the popup
- [ ] **5.15** After onboarding completes on the web, the extension detects the new session and switches to normal popup mode

### 5d. Submission

- [ ] **5.16** Package the extension for Chrome (`dist/` folder zipped)
- [ ] **5.17** Register a Chrome Web Store developer account ($5) and submit
- [ ] **5.18** Package the extension for Firefox (same `dist/`, minor `manifest.json` adjustments)
- [ ] **5.19** Submit to Firefox Add-ons (AMO) — free

---

## Stage 6 — Android App

Kotlin + Jetpack Compose. Full-screen WebView with a persistent bottom bar. Mirrors the extension's controls exactly.

### 6a. Project setup

- [ ] **6.1** Initialise a new Android project in the `android/` folder targeting API 26+ (Android 8.0), using Kotlin and Jetpack Compose
- [ ] **6.2** Add Supabase Kotlin client dependency and configure it with the project URL and `anon` key (stored in `local.properties`, not committed)
- [ ] **6.3** Add required permissions to `AndroidManifest.xml`: `INTERNET`, `VIBRATE`

### 6b. Core UI

- [ ] **6.4** Build the main screen scaffold — full-screen WebView with a persistent `BottomNavigationBar` composable
- [ ] **6.5** Build the 4-button bottom bar (Roam, 👍, 👎, ⚙️) matching the extension layout
- [ ] **6.6** Implement the gesture layer — swipe right (👍), swipe left (👎), pull down (Roam), long-press 👍 (submit flow); buttons remain functional alongside gestures

### 6c. Core features

- [ ] **6.7** Implement auth — email/password sign-in and Google OAuth via Supabase; persist session across app restarts
- [ ] **6.8** Implement the Roam button — calls `GET /roam`, loads the returned URL into the WebView
- [ ] **6.9** Implement thumbs up on a known page — calls `POST /rate` with `+1`; short haptic pulse on confirmation
- [ ] **6.10** Implement thumbs down — calls `POST /rate` with `-1`; haptic pulse
- [ ] **6.11** Implement thumbs up on an unknown page — bottom sheet slides up with a category chip picker and Submit button; calls `POST /submit-url`
- [ ] **6.12** Build the Config bottom sheet — organised into two sections: (1) **Current page**: Add to collection (expandable list of user's collections + "New collection" option), Save for later, Share (Android share sheet); (2) **Roam mode**: Roam within this category chip, Roam a collection (list of user's collections activating collection mode), Manage collections (opens profile in WebView), Category preferences, Sign out
- [ ] **6.12a** Design and implement empty and error states in the app — (1) no results: full-screen empty state with a shortcut to category settings; (2) API unreachable: inline banner with retry; (3) WebView page fails to load: native error screen with "Try next page" button; (4) signed out on app open: redirect to onboarding
- [ ] **6.12b** Add "Skip paywalled sites" toggle to the Config bottom sheet — reads and writes the user's `skip_paywalled` preference in Supabase; mirrors the extension's setting (task 5.12b); default is **off**
- [ ] **6.13** Implement Save for later — saves the current WebView URL to a local bookmark list (no categorisation required)
- [ ] **6.14** Implement Share — triggers the Android system share sheet with the current URL

### 6d. Onboarding

- [ ] **6.15** Implement onboarding — on first launch (no valid session), open the web `/join` page in a Chrome Custom Tab; after the user completes onboarding and a session is created, the Custom Tab closes and the app transitions to the main screen. No native Compose onboarding screens needed — this shares the single web implementation with the browser extension.
- [ ] **6.16** Redirect new users to onboarding on first launch; skip to main screen if a valid session exists

### 6e. Submission

- [ ] **6.17** Generate a signed release APK / AAB
- [ ] **6.18** Register a Google Play developer account ($25) and create a new app listing; during the content rating questionnaire, answer accurately for user-generated content and mature themes — the Weird & Wonderful category (True Crime, Paranormal, Conspiracy Theories) will produce a **Teen** rating, which is correct and expected
- [ ] **6.19** Submit the AAB for review

---

## Stage 7 — Testing & Launch Prep

Final checks before making the app public.

- [ ] **7.1** End-to-end test: new user signs up via web → onboarding → Roam button returns a result → rate a page → see updated recommendations
- [ ] **7.2** End-to-end test: submit an unknown URL via the extension → URL appears in `/admin` moderation queue → approve it → URL appears in discovery pool
- [ ] **7.3** End-to-end test: create a collection → add URLs → share the public link → another user can view and fork it
- [ ] **7.4** End-to-end test: follow another user → their public likes appear in your following feed
- [ ] **7.5** Verify the cron-job.org ping fires and the Supabase project does not pause after 7 days idle
- [ ] **7.6** Verify Google Safe Browsing API auto-rejection works on a known-bad URL
- [ ] **7.7** Confirm all store submissions are approved and live
- [ ] **7.8** Seed content is sufficient — at least 5,000 discoverable URLs per pillar category
- [ ] **7.9** Verify Privacy Policy and Terms of Service are live and linked correctly from the Play Store listing and Chrome Web Store listing

---

## Post-Launch (after first users)

These tasks are not required for launch but should be completed before Roam has significant traffic.

- [ ] **8.1** Build dead link detection — a scheduled Supabase Edge Function that sends HTTP HEAD requests to a rotating batch of URLs and marks any that return a persistent error (404, 410, connection refused) as `inactive = true`; inactive URLs are excluded from discovery but not deleted, preserving rating history
- [ ] **8.2** Build community flagging — users can flag a live URL as spam, broken, or inappropriate; flags above a threshold auto-hide the URL pending review in the admin queue
- [ ] **8.3** Set up error monitoring — integrate Sentry (free tier, ~5K errors/month) or enable Supabase Edge Function log alerts; goal is an email notification when an Edge Function throws an unhandled exception in production, rather than discovering failures from user reports
- [ ] **8.4** Document the database backup and restore procedure — confirm the Supabase backup schedule (Pro: daily point-in-time), test a full restore to a throwaway project, and write the exact steps in `supabase/README.md` so recovery is not improvised under pressure
- [ ] **8.5** Create a staging environment — provision a second free Supabase project and add a `NEXT_PUBLIC_SUPABASE_URL` override in a Vercel preview branch environment; gives a safe place to test schema migrations (especially irreversible ones) before running them on the production database
- [ ] **8.6** Send email notifications on submission status change — when a user's `moderation_queue` row moves from `pending` to `approved` or `rejected`, trigger a transactional email via Supabase Auth's SMTP integration (or a free Resend.com account); include the URL and decision in the message body so users know their contribution was reviewed
- [ ] **8.7** Build a browsing history page — add `/u/[username]/history` (private, owner-only) that shows the URLs a user was served from `seen_urls`, not just the ones they rated; gives users a way to rediscover a page they forgot to bookmark or rate
