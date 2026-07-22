# Roam Web App — Full Audit Report
**Last updated:** 2026-06-10  
**Auditor:** AI full-codebase review (all pages, components, routes, tests, config)  
**Stack:** Next.js 15/16 · React 19 · Tailwind CSS 4 · Supabase (PostgreSQL + Edge Functions)

---

## Overview

The Roam web app is the **account-management hub** for the Roam discovery platform. Primary discovery surfaces are the browser extension and Android app. The web app handles: auth, onboarding, profile, settings, collections, public profiles, admin moderation, and marketing pages.

### Pages / Routes Inventory

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` | Public landing / marketing homepage |
| `/signup` | `app/signup/page.tsx` | Auth (sign up + log in combined) |
| `/profile` | `app/profile/page.tsx` | Authenticated user dashboard |
| `/settings` | `app/settings/page.tsx` | User settings (interests, notifications, account) |
| `/u/[username]` | `app/u/[username]/page.tsx` | Public user profile |
| `/collections/[slug]` | `app/collections/[slug]/page.tsx` | Public collection view |
| `/how-it-works` | `app/how-it-works/page.tsx` | Feature explanation / marketing |
| `/android-beta` | `app/android-beta/page.tsx` | Android beta signup |
| `/submit` | `app/submit/page.tsx` | URL submission form |
| `/privacy` | `app/privacy/page.tsx` | Privacy policy |
| `/terms` | `app/terms/page.tsx` | Terms of service |
| `/forgot-password` | `app/forgot-password/page.tsx` | Password reset request |
| `/auth/callback` | `app/auth/callback/route.ts` | Supabase OAuth callback handler |
| `/auth/verify-email` | `app/auth/verify-email/page.tsx` | Post-signup email verification gate |
| `/auth/reset-password` | `app/auth/reset-password/page.tsx` | Password reset form |
| `/admin` | `app/admin/page.tsx` | Admin moderation queue |
| `/admin/dashboard` | `app/admin/dashboard/page.tsx` | Admin analytics dashboard |
| `/api/unsubscribe` | `app/api/unsubscribe/route.ts` | Email unsubscribe handler |

### Components Inventory

| Component | File | Used Where |
|-----------|------|------------|
| `Header` | `components/Header.tsx` | Root layout |
| `Footer` | `components/Footer.tsx` | Root layout |
| `TopSites` | `components/TopSites.tsx` | Homepage |
| `NotificationBell` | `components/NotificationBell.tsx` | Header |
| `CookieBanner` | `components/CookieBanner.tsx` | Root layout |
| `ThemeToggle` | `components/ThemeToggle.tsx` | Header |
| `PageTransition` | `components/PageTransition.tsx` | Root layout |
| `Breadcrumbs` | `components/Breadcrumbs.tsx` | Rarely used |
| `FollowButton` ⚠️ | `components/FollowButton.tsx` | **Dead — placeholder only** |
| `FollowButton` (real) | `app/u/[username]/FollowButton.tsx` | Public profile page |
| `CopyProfileLink` | `app/u/[username]/CopyProfileLink.tsx` | Public profile page |
| `CollectionsManager` | `app/profile/CollectionsManager.tsx` | Profile page |
| `SavedUrlsManager` | `app/profile/SavedUrlsManager.tsx` | Profile page |
| `ProfileClient` | `app/profile/ProfileClient.tsx` | Profile page |
| `SettingsClient` | `app/settings/SettingsClient.tsx` | Settings page |
| `AdminPageClient` | `app/admin/AdminPageClient.tsx` | Admin page |
| `ModerationDetail` | `app/admin/ModerationDetail.tsx` | Admin page |

---

## 🚨 Phase 1 — Critical Bugs & Structural Problems

These issues cause broken flows, data loss risk, or security concerns.

### CRIT-1: Duplicate `FollowButton` components
- **File:** `web/src/components/FollowButton.tsx`
- **Problem:** A second `FollowButton` exists at `components/FollowButton.tsx` that is a dead placeholder — `isFollowing` is hardcoded to `false`, no Supabase calls, no real logic. The real implementation is at `app/u/[username]/FollowButton.tsx`. If the placeholder is ever imported by mistake, users silently get a broken button.
- [ ] Delete `web/src/components/FollowButton.tsx` (the placeholder)
- [ ] Verify nothing imports `components/FollowButton` (grep and fix any references)

### CRIT-2: Auth callback errors are silently swallowed
- **File:** `web/src/app/auth/callback/route.ts`
- **Problem:** On OAuth error, the route redirects to `/?error=auth_error`. The homepage (`page.tsx`) has no code that reads or displays this `error` query param. Users who fail OAuth see the landing page with no explanation of what went wrong.
- [ ] Add error query param detection to `app/page.tsx` and render a visible error message
- [ ] Alternatively create a dedicated `/auth/error` page that explains the failure and offers retry

### CRIT-3: `TopSites` rendered without `<Suspense>` boundary
- **File:** `web/src/app/page.tsx` (line ~45)
- **Problem:** `<TopSites />` is a Server Component that awaits a Supabase query. It is rendered directly in the homepage with no `<Suspense>` wrapping. If the DB is slow, the entire homepage is blocked. No loading skeleton is shown.
- [ ] Wrap `<TopSites />` in `<Suspense fallback={<TopSitesSkeleton />}>` in `page.tsx`
- [ ] Create a `TopSitesSkeleton` component that matches the real layout (10 rows of shimmer)

### CRIT-4: Service worker has no versioning or update strategy
- **File:** `web/public/sw.js`
- **Problem:** Cache name is hardcoded `roam-v1` with no mechanism to bump the version. No `skipWaiting()` or `clients.claim()` calls. Users who have the SW installed can be stuck on an old cached version of the app indefinitely after a deployment.
- [ ] Add `const CACHE_VERSION = 'roam-v2'` (or inject via build) and delete old caches on `activate`
- [ ] Add `self.skipWaiting()` in `install` handler
- [ ] Add `self.clients.claim()` in `activate` handler

### CRIT-5: `forgot-password` page not linked from sign-in flow
- **File:** `web/src/app/signup/signup-content.tsx`
- **Problem:** `/forgot-password` exists as a page but there is no link to it from the login form. Users who forget their password have no discoverable recovery path.
- [ ] Add "Forgot password?" link beneath the password field in the login form in `signup-content.tsx`

---

## 🟡 Phase 2 — High-Impact UX & Logic Issues

These don't break the app but meaningfully hurt the user experience.

### UX-1: Authenticated users always bounced from the homepage
- **File:** `web/src/app/page.tsx`
- **Problem:** `if (user) redirect('/profile')` runs unconditionally. Logged-in users cannot visit the homepage, see the `TopSites` widget, or access marketing content. There is no way for them to navigate back to `/` to explore.
- [ ] Remove or soften the redirect — either remove it entirely, or redirect only users with no `next` param and show an optional "Go to your profile" banner instead
- [ ] Alternatively keep the redirect but add a "Back to homepage" link on the profile page

### UX-2: Header has no active link highlighting
- **File:** `web/src/components/Header.tsx`
- **Problem:** No `usePathname()` check or `aria-current="page"` on nav links. Users cannot tell which page they're on from the navigation.
- [ ] Import `usePathname` from `next/navigation` and apply an active class/style to the matching nav link
- [ ] Add `aria-current="page"` to the active link for accessibility

### UX-3: `CookieBanner` consent is stored but never read
- **File:** `web/src/components/CookieBanner.tsx`
- **Problem:** The banner sets a `consent` cookie when the user clicks "Accept", but no analytics or tracking code checks for this cookie before firing. The consent UI is theater — it doesn't actually gate anything.
- [ ] Gate any analytics initialization (PostHog, GA, etc.) behind a check for the `consent` cookie
- [ ] Alternatively add a "Reject" button that sets `consent=denied` and suppresses analytics

### UX-4: Theme toggle causes flash of wrong theme on SSR
- **File:** `web/src/components/ThemeToggle.tsx`
- **Problem:** Theme is stored in `localStorage` and applied client-side. On first render, there is a flash of the default theme before JS runs and reads the preference. This is especially visible on dark-mode users loading a page for the first time.
- [ ] Store theme preference in a cookie so it can be read server-side
- [ ] Apply `suppressHydrationWarning` on the `<html>` element in `layout.tsx`
- [ ] Or use the standard `<script>` inject pattern to set the theme class before React hydrates

### UX-5: `SavedUrlsManager` has no empty state
- **File:** `web/src/app/profile/SavedUrlsManager.tsx`
- **Problem:** When a user has 0 saved URLs, nothing is rendered — no message, no call to action, no explanation. Users see a blank section with no guidance.
- [ ] Add an empty state component: icon + "You haven't saved any URLs yet" message + link to the extension/app

### UX-6: `CollectionsManager` allows empty collection names
- **File:** `web/src/app/profile/CollectionsManager.tsx`
- **Problem:** No client-side validation on the collection name input. A user can submit an empty string as a collection name. The server-side insert will either fail silently or create a nameless collection.
- [ ] Add `required` attribute and client-side trim-check before submitting
- [ ] Show an inline error message if the name is blank

### UX-7: `verify-email` page has no "Resend email" button
- **File:** `web/src/app/auth/verify-email/page.tsx`
- **Problem:** After sign-up, users are shown a "check your email" message, but there is no button to resend the verification email if it was lost or went to spam.
- [ ] Add a "Resend verification email" button that calls `supabase.auth.resend({ type: 'signup', email })`
- [ ] Show a cooldown timer (e.g., 60 seconds) to prevent spam

### UX-8: `not-found.tsx` (404 page) provides no navigation
- **File:** `web/src/app/not-found.tsx`
- **Problem:** The 404 page shows an error message but no links back to the homepage, profile, or any other page. Dead end for users.
- [ ] Add links to: Homepage (`/`), Profile (`/profile`), How It Works (`/how-it-works`)
- [ ] Add a search/explore suggestion if applicable

### UX-9: Sign-up CTA in `TopSites` shown to logged-in users
- **File:** `web/src/components/TopSites.tsx`
- **Problem:** The "Join Roam to start discovering" CTA at the bottom of `TopSites` is always rendered, even when the viewer is already authenticated. It looks broken/redundant for logged-in users.
- [ ] `TopSites` already uses `createClient()` (server component) — check for session and hide the CTA if authenticated

### UX-10: In-page anchor uses raw `<a>` instead of `<Link>`
- **File:** `web/src/app/page.tsx`
- **Problem:** `<a href="#get-the-app">` uses a raw HTML anchor tag inconsistently with the rest of the page that uses Next.js `<Link>`. No smooth scroll behavior is applied.
- [ ] Replace with `<Link href="#get-the-app">` or use a scroll library
- [ ] Add `scroll-behavior: smooth` to `globals.css` or use Tailwind's `scroll-smooth` class on `<html>`

### UX-11: `how-it-works` page is wall-of-text with no visuals
- **File:** `web/src/app/how-it-works/page.tsx`
- **Problem:** The page is entirely text — no screenshots, icons, or illustrations. Difficult to scan and does not effectively communicate the product experience.
- [ ] Add step illustrations or screenshots at each major step
- [ ] Add icons for each feature point to aid scannability

### UX-12: `android-beta` form has no loading/submitting state
- **File:** `web/src/app/android-beta/page.tsx`
- **Problem:** After clicking "Submit", there is no spinner, disabled button, or any visual feedback while the request is in flight. Users may click multiple times.
- [ ] Add a loading state (`isSubmitting`) that disables the button and shows a spinner
- [ ] Prevent double-submission

### UX-13: `NotificationBell` data goes stale without page reload
- **File:** `web/src/components/NotificationBell.tsx`
- **Problem:** Notifications are fetched once on mount. There is no polling, WebSocket, or Supabase realtime subscription. A user who receives a notification while on the page will not see it without refreshing.
- [ ] Add Supabase realtime subscription on the `notifications` table for the current user
- [ ] Or add a polling interval (e.g., every 30s) as a fallback

### UX-14: `Breadcrumbs` component exists but is barely used
- **File:** `web/src/components/Breadcrumbs.tsx`
- **Problem:** The `Breadcrumbs` component was built but is not rendered on most pages that would benefit from it (profile, settings, collections, admin). Users have no contextual navigation trail.
- [ ] Add `<Breadcrumbs>` to: `/profile`, `/settings`, `/collections/[slug]`, `/admin`
- [ ] Define consistent crumb paths for each

### UX-15: `PageTransition` animation is imperceptibly subtle
- **File:** `web/src/components/PageTransition.tsx`
- **Problem:** The transition animation is so fast and low-contrast that it provides no perceptible UX value. It adds a React component, a `useEffect`, and a CSS transition for effectively nothing visible.
- [ ] Either make the transition meaningful (e.g., 150ms fade + slight slide) or remove the component entirely

---

## 🔧 Phase 3 — Code Quality & Technical Debt

### CODE-1: Domain-extraction logic duplicated 4+ times
- **Files:** `TopSites.tsx`, `CollectionsManager.tsx`, `SavedUrlsManager.tsx`, `collections/[slug]/page.tsx`
- **Problem:** The same inline pattern `new URL(url).hostname.replace(/^www\./, '')` is copy-pasted across four files. Any bug or change needs to be fixed in all four places.
- [ ] Create `web/src/lib/url-utils.ts` with exported `getDomain(url: string): string` and `getFaviconUrl(url: string): string` helpers
- [ ] Replace all four occurrences with the shared utility

### CODE-2: `<img>` used for favicons instead of `next/image`
- **Files:** `TopSites.tsx`, `CollectionsManager.tsx`, `SavedUrlsManager.tsx`, `collections/[slug]/page.tsx`
- **Problem:** Raw `<img>` tags bypass Next.js image optimization, trigger `@next/next/no-img-element` ESLint warnings (currently suppressed with `// eslint-disable-next-line`), and miss out on lazy loading, size optimization, and CDN caching.
- [ ] Create a shared `FaviconImage` component using `next/image` with appropriate `width`, `height`, and `unoptimized` (since it's an external favicon URL)
- [ ] Replace all favicon `<img>` tags with `<FaviconImage>`
- [ ] Remove all `// eslint-disable-next-line @next/next/no-img-element` suppressions

### CODE-3: Hardcoded UTM tracking param in source code
- **File:** `web/src/app/page.tsx`
- **Problem:** The Chrome Web Store link contains `utm_source=item-share-cb` hardcoded in source. This contaminates analytics attribution — all visits from the homepage will appear as referrals from item sharing, not from the homepage CTA. It also differs from the same URL used in `ProfileClient.tsx` which has no UTM param.
- [ ] Remove or correct the UTM param (use `utm_source=homepage` or similar)
- [ ] Centralise the extension URLs in a `lib/constants.ts` file to avoid inconsistency

### CODE-4: `useSupabaseUser` hook doesn't react to auth state changes
- **File:** `web/src/lib/hooks.ts`
- **Problem:** The hook fetches the current user once on mount. It does not subscribe to `supabase.auth.onAuthStateChange`. If a user signs out in another tab, the hook's state will be stale — showing authenticated UI for a signed-out user until page refresh.
- [ ] Add `supabase.auth.onAuthStateChange` listener inside the hook
- [ ] Clean up the subscription in the `useEffect` return

### CODE-5: `ModerationDetail` has hardcoded category labels out of sync with DB
- **File:** `web/src/app/admin/ModerationDetail.tsx`
- **Problem:** Category display labels are hardcoded as a static map. If the database enum for categories changes, the UI silently shows incorrect labels.
- [ ] Either fetch categories dynamically from a `categories` lookup table or generate the label map from the shared type definitions
- [ ] At minimum, add a fallback for unknown categories (currently shows `undefined`)

### CODE-6: `sitemap.ts` only includes static routes
- **File:** `web/src/app/sitemap.ts`
- **Problem:** The sitemap only lists static marketing pages. Public user profiles (`/u/[username]`) and public collections (`/collections/[slug]`) are not included. These are indexable pages that drive organic SEO for Roam.
- [ ] Query Supabase for all public profiles and include `/u/[username]` entries
- [ ] Query Supabase for all public collections and include `/collections/[slug]` entries
- [ ] Set appropriate `lastModified` and `changeFrequency` values

### CODE-7: `proxy.ts` is a monolith handling 15+ URL patterns
- **File:** `web/src/proxy.ts`
- **Problem:** A single file contains routing logic for all proxy patterns (auth, API, static assets, etc.). It is hard to read, test, and extend. At 250+ lines, it violates single-responsibility.
- [ ] Split into domain-specific modules: `proxy/auth.ts`, `proxy/api.ts`, `proxy/static.ts`
- [ ] Keep `proxy.ts` as a thin orchestrator that imports the modules

### CODE-8: `SettingsClient` makes individual Supabase calls per setting change
- **File:** `web/src/app/settings/SettingsClient.tsx`
- **Problem:** Every toggle/dropdown change fires an individual Supabase `update()` call immediately. No debouncing or batching. On a slow connection, rapid changes could result in race conditions with the last-write-wins being unpredictable.
- [ ] Add debounce (300–500ms) to setting change handlers
- [ ] Or implement a "Save" button that batches all pending changes into a single update

### CODE-9: Zero test coverage on critical user flows
- **Files:** `web/src/__tests__/` (existing tests cover: proxy, logger, env, error-boundary, interests, UI components)
- **Problem:** No tests exist for: auth flow, profile page, settings page, collections, admin moderation, public profile pages, or any Supabase integration paths.
- [ ] Add integration tests for the signup/login flow
- [ ] Add tests for `CollectionsManager` (create, delete, edit collection)
- [ ] Add tests for `SavedUrlsManager` (empty state, list, remove)
- [ ] Add tests for `SettingsClient` (toggle persistence, error states)
- [ ] Add tests for admin `actions.ts` (approve, reject, undo)

### CODE-10: `loading-messages.ts` messages have no associated tests
- **File:** `web/src/lib/loading-messages.ts`
- **Problem:** 25 hand-tuned loading messages exist with no validation that they render correctly, have appropriate lengths, or contain no typos/broken characters.
- [ ] Add a simple test that validates all messages are non-empty strings under a max character length

### CODE-11: `collections/[slug]/loading.tsx` skeleton doesn't match page layout
- **File:** `web/src/app/collections/[slug]/loading.tsx`
- **Problem:** The loading skeleton UI for the collections page does not match the actual rendered page structure. Users see a layout shift when the real content loads.
- [ ] Audit the real page layout and rebuild the skeleton to match (header, URL list, sidebar if any)

### CODE-12: `sw.js` cache name hardcoded — no automated version bump
- **File:** `web/public/sw.js`
- **Problem:** Related to CRIT-4 above. No CI/CD pipeline step bumps the SW version on deploy, meaning the cache name must be manually changed before each release.
- [ ] Add a build step (or `next.config.ts` plugin) that injects the build hash into `sw.js` as `CACHE_VERSION`

---

## 📋 Summary Checklist

### Phase 1 — Critical (fix before next release)
- [ ] CRIT-1: Delete fake `components/FollowButton.tsx`, verify no imports
- [ ] CRIT-2: Display auth callback errors on homepage or `/auth/error` page
- [ ] CRIT-3: Wrap `<TopSites>` in `<Suspense>` with a skeleton
- [ ] CRIT-4: Add SW versioning, `skipWaiting()`, `clients.claim()`
- [ ] CRIT-5: Add "Forgot password?" link to sign-in form

### Phase 2 — High-Impact UX
- [ ] UX-1: Remove/soften homepage redirect for authenticated users
- [ ] UX-2: Add active link highlighting to Header nav
- [ ] UX-3: Gate analytics on `CookieBanner` consent cookie
- [ ] UX-4: Fix theme toggle SSR flash (cookie-based or script-inject)
- [ ] UX-5: Add empty state to `SavedUrlsManager`
- [ ] UX-6: Add validation to `CollectionsManager` name field
- [ ] UX-7: Add "Resend verification email" button to `verify-email` page
- [ ] UX-8: Add navigation links to the 404 page
- [ ] UX-9: Hide sign-up CTA in `TopSites` for authenticated users
- [ ] UX-10: Replace raw `<a>` anchor with `<Link>` + add smooth scroll
- [ ] UX-11: Add visuals/icons to `how-it-works` page
- [ ] UX-12: Add loading/submitting state to `android-beta` form
- [ ] UX-13: Add realtime or polling to `NotificationBell`
- [ ] UX-14: Add `<Breadcrumbs>` to profile, settings, collections, admin
- [ ] UX-15: Make `PageTransition` meaningful or remove it

### Phase 3 — Code Quality
- [ ] CODE-1: Extract domain/favicon logic to `lib/url-utils.ts`
- [ ] CODE-2: Create shared `FaviconImage` component using `next/image`
- [ ] CODE-3: Fix/remove hardcoded UTM param; centralise extension URLs in `lib/constants.ts`
- [ ] CODE-4: Add `onAuthStateChange` subscription to `useSupabaseUser` hook
- [ ] CODE-5: Fix `ModerationDetail` category label map; add unknown fallback
- [ ] CODE-6: Add dynamic user profiles and collections to `sitemap.ts`
- [ ] CODE-7: Split `proxy.ts` into domain-specific modules
- [ ] CODE-8: Debounce or batch setting changes in `SettingsClient`
- [ ] CODE-9: Add tests for auth, profile, settings, collections, admin
- [ ] CODE-10: Add test for `loading-messages.ts` message validity
- [ ] CODE-11: Rebuild `collections/[slug]/loading.tsx` skeleton to match page
- [ ] CODE-12: Automate SW cache version bump in build pipeline

---

## File-by-File Notes

| File | Status | Notes |
|------|--------|-------|
| `app/page.tsx` | 🟡 Issues | Auth redirect too aggressive; missing Suspense; raw anchor; UTM param |
| `app/layout.tsx` | 🟢 OK | Clean; consider `suppressHydrationWarning` for theme |
| `components/Header.tsx` | 🟡 Issues | No active link state; no aria-current |
| `components/Footer.tsx` | 🟢 OK | Clean |
| `app/globals.css` | 🟢 OK | Add `scroll-behavior: smooth` |
| `app/signup/signup-content.tsx` | 🟡 Issues | Missing "forgot password" link |
| `app/profile/ProfileClient.tsx` | 🟢 OK | Solid implementation |
| `app/profile/CollectionsManager.tsx` | 🟡 Issues | No name validation; `<img>` for favicons |
| `app/profile/SavedUrlsManager.tsx` | 🟡 Issues | No empty state; `<img>` for favicons |
| `app/u/[username]/page.tsx` | 🟢 OK | Good SSR approach |
| `app/u/[username]/FollowButton.tsx` | 🟢 OK | Real implementation |
| `components/FollowButton.tsx` | 🔴 Delete | Dead placeholder — should not exist |
| `app/settings/SettingsClient.tsx` | 🟡 Issues | No debounce on individual saves |
| `app/how-it-works/page.tsx` | 🟡 Issues | Needs visuals |
| `app/android-beta/page.tsx` | 🟡 Issues | No submit loading state |
| `app/not-found.tsx` | 🟡 Issues | No navigation links |
| `app/auth/callback/route.ts` | 🟡 Issues | Error not surfaced to user |
| `app/auth/verify-email/page.tsx` | 🟡 Issues | No resend button |
| `app/admin/AdminPageClient.tsx` | 🟢 OK | Solid |
| `app/admin/ModerationDetail.tsx` | 🟡 Issues | Hardcoded category map |
| `components/TopSites.tsx` | 🟡 Issues | No Suspense; CTA shown to authed users; `<img>` for favicons |
| `components/NotificationBell.tsx` | 🟡 Issues | No realtime updates |
| `components/CookieBanner.tsx` | 🟡 Issues | Consent not enforced |
| `components/ThemeToggle.tsx` | 🟡 Issues | SSR flash |
| `components/Breadcrumbs.tsx` | 🟡 Issues | Exists but unused on most pages |
| `components/PageTransition.tsx` | 🟡 Issues | Imperceptible — remove or improve |
| `lib/hooks.ts` | 🟡 Issues | No auth state change listener |
| `lib/url-utils.ts` | ❌ Missing | Needs to be created |
| `lib/constants.ts` | ❌ Missing | Extension URLs should be centralised here |
| `app/sitemap.ts` | 🟡 Issues | Static only — missing dynamic routes |
| `app/robots.ts` | 🟢 OK | Fine as-is |
| `proxy.ts` | 🟡 Issues | Monolith; split into modules |
| `public/sw.js` | 🔴 Critical | No versioning, no skipWaiting |
| `collections/[slug]/loading.tsx` | 🟡 Issues | Skeleton doesn't match page |
| `__tests__/` | 🟡 Issues | Missing coverage for most features |
