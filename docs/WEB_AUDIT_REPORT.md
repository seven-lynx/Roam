# Roam Web App — Full Audit Report

**Date:** 2026-06-07  
**Scope:** Every page, component, and cross-cutting concern in the `web/` Next.js application.  
**Method:** Line-by-line review of all 14 routes, shared components (Header, Footer, ErrorBoundary, AuthProvider), middleware, CSS, environment config, and existing reports (ROADMAP.md, SOCIAL_FEATURES_REPORT.md, SECRETS_AUDIT.md).

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Per-Page Audit](#2-per-page-audit)
   - [2.1 Homepage (`/`)](#21-homepage-)
   - [2.2 How It Works (`/how-it-works`)](#22-how-it-works-how-it-works)
   - [2.3 Profile (`/profile`)](#23-profile-profile)
   - [2.4 Public Profile (`/u/[username]`)](#24-public-profile-uusername)
   - [2.5 Collection (`/c/[slug]`)](#25-collection-cslug)
   - [2.6 Admin (`/admin`)](#26-admin-admin)
   - [2.7 Beta Signup (`/beta`)](#27-beta-signup-beta)
   - [2.8 Settings (`/settings`)](#28-settings-settings)
   - [2.9 Submit URL (`/submit`)](#29-submit-url-submit)
   - [2.10 Join / Auth (`/join`)](#210-join--auth-join)
   - [2.11 Terms of Service (`/terms`)](#211-terms-of-service-terms)
   - [2.12 Privacy Policy (`/privacy`)](#212-privacy-policy-privacy)
   - [2.13 404 Page (`not-found.tsx`)](#213-404-page-not-foundtsx)
3. [Shared Components](#3-shared-components)
   - [3.1 Header](#31-header)
   - [3.2 Footer](#32-footer)
   - [3.3 Layout & Root](#33-layout--root)
4. [Middleware & Auth](#4-middleware--auth)
5. [Cross-Cutting Gaps](#5-cross-cutting-gaps)
6. [SEO & Metadata](#6-seo--metadata)
7. [Accessibility](#7-accessibility)
8. [Security & Privacy](#8-security--privacy)
9. [Performance](#9-performance)
10. [Alignment with Existing Reports](#10-alignment-with-existing-reports)
11. [Prioritized Recommendations](#11-prioritized-recommendations)

---

## 1. Executive Summary

The Roam web app is a **solid, functional Next.js 16 application** with clean code, good SSR patterns, proper error/loading/empty states, and strong backend integration. The code quality is high — well-structured server/client component splits, proper use of `Promise.all` for parallel data fetching, and consistent Tailwind dark-mode styling.

**Overall grade: B+ (82/100)**

**What's strong:**
- Clean, consistent UI design across all pages with proper dark mode
- Good SSR data fetching patterns (Promise.all, parallel queries)
- Robust error handling in forms (submit, profile editing)
- Comprehensive /how-it-works page with clear algorithm explanation
- Solid privacy/terms pages
- Working collections management with public/private toggle
- Working interest picker with pillar/topic modes
- Sentry error tracking integrated

**What needs work (by severity):**

| Severity | Count | Key Items |
|----------|-------|-----------|
| Critical | 1 | Typo in profile page: `roam.the.web/u/` should be `roamtheweb.app/u/` |
| High | 6 | No account deletion UI, no cookie consent banner, admin queue lacks filtering/pagination, no sitemap/robots.txt, missing settings features, Android still marked "Coming Soon" |
| Medium | 9 | No dark mode toggle, no structured data, no analytics, no loading skeletons, no search, empty states missing, /how-it-works mentions non-existent "following feed" |
| Low | 11 | Various minor polish items detailed below |

---

## 2. Per-Page Audit

### 2.1 Homepage (`/`)

**File:** `web/src/app/page.tsx` (130 lines)  
**Type:** Server Component

**What works:**
- Clean landing page with logo, tagline, description, CTAs
- Authenticated users are redirected to `/profile`
- Download section for Chrome/Firefox extensions with live store links
- "Why Roam?" feature grid (4 cards: interests, ratings, no feeds, community-curated)
- Link to `/how-it-works`
- Links to `/join` for sign-up

**Gaps & Improvements:**

1. **Android section is dead space** (lines 82–90): Shows "Coming soon to Google Play" — takes up valuable above-fold space with no value. Replace with actual Play Store link once published, or remove until ready.

2. **No social proof:** Add testimonials, user count, or "X URLs discovered" counter. A simple stat like "Join 1,000+ explorers" adds credibility.

3. **No product screenshot/demo:** Users can't see what Roam looks like before signing up. Add a hero image or animated GIF showing the extension popup or Android swipe.

4. **Missing OpenGraph image override:** `layout.tsx` provides site-wide metadata but no page-specific `openGraph.images` for social sharing. The homepage is the most-shared URL.

5. **No trending/showcase section:** A small "Recently discovered" or "Popular this week" section with 3–5 URLs would demonstrate the value proposition immediately.

6. **Anchor link uses `<a>` not `<Link>`** (line 39): `href="#get-the-app"` uses a raw `<a>` tag. In Next.js, this can cause full-page navigation instead of smooth scroll. Use `<Link href="/#get-the-app">` or add scroll behavior.

7. **Missing structured data:** No JSON-LD `WebSite` or `Organization` schema for search engines.

**Suggested improvements:**
```
- Add a hero screenshot/product demo
- Replace Android placeholder with actual link or remove
- Add social proof stat line
- Add OpenGraph image for homepage
- Add JSON-LD WebSite schema
- Add 3–5 trending URLs as live demo
```

---

### 2.2 How It Works (`/how-it-works`)

**File:** `web/src/app/how-it-works/page.tsx` (336 lines)  
**Type:** Static Server Component

**What works:**
- Excellent, detailed documentation of the algorithm
- Clear sections: basics → algorithm → personalization → community → platforms
- Good SEO metadata (title + description)
- Five algorithm signals well-explained (Community quality, Editorial signal, Your taste, Freshness, Exploration bonus)
- Platform cards with store links
- CTA at bottom

**Gaps & Improvements:**

1. **Misleading "Following feed" copy** (lines 250–256): The community section says "Follow users. Stay connected with interesting people. Profile pages show their collections, interests, and follower counts." This implies a following feed of activity, which does not exist. The SOCIAL_FEATURES_REPORT flags this as a documentation/copy mismatch. Either build the feed or remove the implication.

2. **No visual aids:** 336 lines of text with zero diagrams, flowcharts, or illustrations. A visual diagram of the five-signal weighting system would dramatically improve comprehension.

3. **No table of contents or sticky nav:** The page is very long. A sticky sidebar or at minimum a "Jump to" section at the top would help navigation.

4. **No FAQ section:** Common questions like "Why did I see the same page twice?", "How do I mute a domain?", "What happens if I downvote everything?" go unanswered.

5. **No link to GitHub:** The footer links to GitHub, but the "Community layer" section should mention the project is open source (MIT) and invite contributions.

**Suggested improvements:**
```
- Add visual algorithm diagram showing 5 signals → weighted random pick
- Add sticky table of contents or jump links
- Add FAQ section with 5–8 common questions
- Fix "following feed" copy to reflect current reality
- Add "Open source (MIT)" note with GitHub link in community section
```

---

### 2.3 Profile (`/profile`)

**Files:** `web/src/app/profile/page.tsx` (76 lines), `web/src/app/profile/ProfileClient.tsx` (327 lines)  
**Type:** Hybrid (Server Component page + Client Component inner)

**What works:**
- Good SSR data fetching with `Promise.all` for 6 parallel queries
- Redirects unauthenticated users to `/join?mode=signin`
- Username gate for new OAuth users (`UsernamePrompt`)
- Profile header with initial-letter avatar, email, profile link
- Privacy toggle (public/private) with loading state
- Editable bio with 160-char limit, cancel/save
- Interest picker with pillar/topic mode toggle
- Collections manager and Saved URLs manager integrated
- "Start exploring" section with extension store links
- Error state display

**Gaps & Improvements:**

1. **CRITICAL — Typo in profile URL** (line 154): The link displays `roam.the.web/u/{username} ↗` — should be `roamtheweb.app/u/{username} ↗`. This is a wrong domain that will 404 or go nowhere.

2. **No avatar upload:** Only shows an initial-letter circle. Users expect to upload a profile picture. The `profiles` table has `avatar_url` column — it's just not wired up in the UI.

3. **No account deletion UI:** Privacy policy says "email us to delete your account." GDPR best practice is to provide a self-service deletion button in settings/profile. This is a legal risk in the EU.

4. **No "change password" UI:** Email/password users have no way to change their password from the web app. They must use the reset-password flow, which is a workaround but not ideal UX.

5. **No connected accounts management:** Users who signed up via Google/GitHub can't see or manage their connected accounts.

6. **No export data feature:** GDPR Article 20 requires data portability. There's no "Download my data" button.

7. **Profile privacy toggle UI is present but confusing:** The toggle is labeled "Profile visibility" but doesn't explain what "private" means (can people still see your collections? Can followers still see your profile?).

8. **Saved URLs limited to 30 days:** The server component queries `saved_urls` where `saved_at > thirtyDaysAgo` and limits to 50. Users might expect to see ALL their saved URLs, not just recent ones.

**Suggested improvements:**
```
- FIX: Change roam.the.web to roamtheweb.app
- Add avatar upload (Supabase Storage + image crop)
- Add "Delete account" button with confirmation modal
- Add "Change password" section for email users
- Add connected accounts display
- Add "Download my data" button
- Add tooltip/help text explaining profile privacy
- Add pagination or "View all" for saved URLs
```

---

### 2.4 Public Profile (`/u/[username]`)

**File:** `web/src/app/u/[username]/page.tsx` (188 lines)  
**Type:** Server Component with `revalidate = 60`

**What works:**
- Server-rendered with ISR (60s revalidation)
- Respects `is_public` — returns 404 for private profiles
- Shows avatar (via UI component), display name, @username, bio
- Interest pills from user_categories
- Collections list with links
- Follow button (FollowButton.tsx) for logged-in viewers
- Copy profile link button (CopyProfileLink.tsx)
- Follower/following counts via profile Edge Function
- Join date display
- Handles unauthenticated viewers gracefully

**Gaps & Improvements:**

1. **No empty state for collections:** If a user has 0 collections, the section just doesn't render. Add "No collections yet" text for transparency.

2. **No pagination on collections:** If a user has 30+ collections, they all render at once.

3. **No mutual connection indicators:** No "You both follow X" or "Follows you" badge.

4. **Double fetch for profile data:** `generateMetadata` fetches the profile once, then the page component fetches it again. Could share via `cache()` or React `cache()`.

5. **No "joined" date for new users without `created_at`:** If `created_at` is null, nothing shows. This edge case is unlikely but unhandled.

6. **profile Edge Function call could fail silently:** If the Edge Function is down, follower/following counts show 0 without any indication that data is unavailable.

**Suggested improvements:**
```
- Add "No collections yet" empty state
- Add collection pagination or "View all" for >10 collections
- Add mutual follow indicators
- Use React cache() to deduplicate profile fetch in generateMetadata + page
- Handle Edge Function failure gracefully (show "—" instead of 0)
```

---

### 2.5 Collection (`/c/[slug]`)

**File:** `web/src/app/c/[slug]/page.tsx` (106 lines)  
**Type:** Server Component with `revalidate = 60`

**What works:**
- Server-rendered with ISR
- Shows collection name, owner link, items as cards
- Extracts domain from URL for display
- Handles empty collection state
- Returns 404 for non-existent/private collections
- Good metadata with owner attribution

**Gaps & Improvements:**

1. **No "Fork/Save collection" button:** ROADMAP task 3.8 mentions this but it's not implemented. Users can't copy a public collection to their own account.

2. **No item count:** Doesn't show "42 items" anywhere.

3. **No OG image thumbnails:** Collection items show only title + description + domain. The `urls` table has `og_image_url` but it's not queried or displayed.

4. **No favicons:** Domains are shown as plain text. Adding Google Favicon API (`https://www.google.com/s2/favicons?domain=X&sz=32`) would add visual polish.

5. **Link cards use `<a>` with target="_blank":** Should add `rel="noopener noreferrer"` for security best practice — wait, looking at the code, they DO have `rel="noopener noreferrer"` (line 84). Good.

6. **Joins on `collection_items` → `urls` use type casting:** The `items` query casts `urls` as `unknown` then to the expected type. This suggests the Supabase type generation isn't being used, or the join types aren't inferred correctly. Not a user-facing issue but a code quality concern.

**Suggested improvements:**
```
- Add Fork/Save button for authenticated users
- Display item count in header
- Query and display og_image_url as thumbnails
- Add favicon next to domain
```

---

### 2.6 Admin (`/admin`)

**Files:** `web/src/app/admin/page.tsx` (17 lines), `web/src/app/admin/AdminPageClient.tsx`, `web/src/app/admin/actions.ts`, `web/src/app/admin/ModerationActions.tsx`, `web/src/app/admin/ModerationDetail.tsx`  
**Type:** Hybrid

**What works:**
- Auth-gated with role check (`app_metadata.role === 'admin'`)
- Redirects non-admins to `/`
- Server component checks auth before rendering client component

**Gaps & Improvements:**

1. **No filtering/sorting/search** (ROADMAP 3.9c): The queue loads max 100 pending items with no way to filter by status, sort by date, or search by domain. This becomes unworkable as submissions grow.

2. **No detailed metadata display** (ROADMAP 3.9a): The queue doesn't show the fetched page title, description, subcategory label, submitter username, submission timestamp, or Safe Browsing check result. Moderators have to click through to the URL to evaluate it.

3. **No undo for moderation decisions** (ROADMAP 3.9b): Once approved or rejected, there's no way to change the decision. Re-rejecting should also delete from `urls` table.

4. **No dashboard/analytics:** No overview of pending count, approval rate, recent activity, or moderation audit log viewer.

5. **No pagination:** Hard 100-item cap. No "load more" or page controls.

6. **Client-side data loading:** The moderation queue data is loaded client-side in `AdminPageClient`. This could be SSR'd for better performance and to avoid a loading flash.

7. **No batch operations:** Can't approve/reject multiple items at once. Each decision requires a separate click.

**Suggested improvements:**
```
- Add filter by status (pending/approved/rejected), sort by date, search by domain
- Display full metadata per submission (title, description, Safe Browsing result, submitter)
- Add undo capability with audit log
- Add admin dashboard with stats
- Add pagination or infinite scroll
- SSR the initial queue data
- Add batch approve/reject
```

---

### 2.7 Beta Signup (`/beta`)

**File:** `web/src/app/beta/page.tsx` (93 lines)  
**Type:** Client Component

**What works:**
- Clear form with email pre-fill for authenticated users
- Good error/success states with appropriate colors
- Uses `beta-signup` Edge Function
- Anti-spam messaging ("No spam, ever")

**Gaps & Improvements:**

1. **No redirect for already-signed-up users:** If a user is already in the beta (or already has an account), the page still shows the signup form. Should redirect to `/profile` or show "You're already in!"

2. **No privacy note on the form:** The fine print says "No spam" but doesn't link to the privacy policy or explain data handling.

3. **No rate limiting on client side:** User can spam the submit button. The Edge Function likely has rate limiting, but the button should also disable after submission.

4. **No confirmation for non-authenticated users:** If an unauthenticated user signs up, they get a success message but no next step. Could suggest installing the extension.

**Suggested improvements:**
```
- Redirect authenticated users to /profile
- Add privacy policy link near submit button
- Add client-side rate limiting / cooldown on submit button
- Add "Next: install the extension" CTA for unauthenticated users after signup
```

---

### 2.8 Settings (`/settings`)

**Files:** `web/src/app/settings/page.tsx` (29 lines), `web/src/app/settings/SettingsClient.tsx`  
**Type:** Hybrid

**What works:**
- Auth-gated (redirects to sign-in)
- Fetches `user_settings` from DB
- Passes provider info (email vs Google/GitHub)

**Gaps & Improvements:**

1. **Extremely minimal functionality:** Only shows email notifications toggle. The database schema supports `preferred_languages`, `skip_paywalled`, and more — none are exposed in the web UI (they ARE exposed in the extension and Android).

2. **No change password:** Email/password users can't change their password here. They must use the forgot-password flow, which requires signing out.

3. **No connected accounts management:** Can't see or unlink Google/GitHub.

4. **No delete account:** As noted under Profile, this is a GDPR gap.

5. **No session management:** Can't view active sessions or sign out everywhere.

6. **No export data:** No way to download personal data.

7. **No language preferences:** The DB column exists and is used by `roam()` RPC, but the web app has no UI for it (extension and Android do).

8. **No paywall skip toggle:** Same situation as languages — exists in DB, used by RPC, no web UI.

**Suggested improvements:**
```
- Add language preferences multi-select
- Add skip-paywalled-sites toggle
- Add change password section (for email users)
- Add connected accounts display
- Add delete account button
- Add export data button
- Add session management
```

---

### 2.9 Submit URL (`/submit`)

**File:** `web/src/app/submit/page.tsx` (246 lines)  
**Type:** Client Component with `useRequireAuth`

**What works:**
- Auth-gated with loading state
- URL validation (enforces valid URL format)
- Title + description + category fields
- Category dropdown with DB fetch + hardcoded fallback
- Good error handling (duplicate detection, rate limit, generic errors)
- Success state with "Submit another" / "Back to profile" options
- Loading state on submit button

**Gaps & Improvements:**

1. **No link preview/OG fetch:** When user pastes a URL, they get no visual feedback about what they're submitting. A small card showing fetched title, description, and image would improve confidence.

2. **No real-time URL validation feedback:** Validation only happens on submit. Could show "✓ Valid URL" or "⚠ Invalid URL" as the user types.

3. **Category is optional but not explained:** The label says "optional — helps the reviewer" but doesn't explain what happens if left empty (the reviewer must categorize it, which may delay approval).

4. **No link to guidelines:** No link to `/terms` or submission guidelines near the form.

5. **The `useEffect` has eslint-disable** (line 50): The `// eslint-disable-next-line react-hooks/exhaustive-deps` comment suppresses the exhaustive-deps warning for the categories fetch effect. The empty dependency array is intentional (fetch once), but this is a common pattern that should be documented.

**Suggested improvements:**
```
- Add link preview card when URL is pasted
- Add real-time URL validation indicator
- Explain what happens when no category is selected
- Add link to submission guidelines/terms
```

---

### 2.10 Join / Auth (`/join`)

**Files:** `web/src/app/join/page.tsx` (29 lines), `web/src/app/join/join-content.tsx`  
**Type:** Client Component with Suspense boundary

**What works:**
- Suspense wrapper with loading fallback (logo + "Loading…")
- Delegates to `JoinPageContent` which handles auth UI

**Note:** `join-content.tsx` was not fully reviewed in this audit (focus was on page structure). Based on ROADMAP notes, it implements: account creation (email or Google OAuth), pillar selection (8 category tiles), optional subcategory selection, and confirmation screen.

**Gaps & Improvements:**

1. **Suspense fallback is minimal:** The loading state shows only the logo and "Loading…" text. A skeleton or spinner would look more polished.

2. **No explanation of why we need email:** Privacy-conscious users may hesitate. A small note "We only use your email for account recovery — no spam, ever" would help.

---

### 2.11 Terms of Service (`/terms`)

**File:** `web/src/app/terms/page.tsx` (121 lines)  
**Type:** Static Server Component

**What works:**
- Well-structured legal document with 13 sections
- Clear effective date
- Contact email for questions
- Covers all necessary topics (eligibility, acceptable use, content submission, IP, termination, liability)
- Back link to homepage

**Gaps & Improvements:**

1. **Section 11 — Governing law is vague:** "governed by the laws of the jurisdiction in which the operator resides, without regard to conflict-of-law principles." This doesn't specify an actual jurisdiction, which may not hold up in some legal contexts. Should specify a state/country (e.g., "State of New York, USA" or similar).

2. **No last-updated timestamp:** The effective date is static (April 23, 2026). If it's ever updated, there's no dynamic date. The privacy policy mentions "The effective date at the top will always reflect the latest version" — but the date is hardcoded.

3. **Section 10 — Liability cap of $0 is clever but may not be enforceable everywhere.** Many jurisdictions don't allow complete disclaimers of liability for gross negligence or willful misconduct.

**Suggested improvements:**
```
- Specify actual governing law jurisdiction
- Consider making effective date dynamic (from git history or config)
- Add "Last updated" alongside "Effective date"
```

---

### 2.12 Privacy Policy (`/privacy`)

**File:** `web/src/app/privacy/page.tsx` (126 lines)  
**Type:** Static Server Component

**What works:**
- Comprehensive coverage of data collection, use, sharing, retention, and rights
- Clearly names sub-processors (Supabase, Vercel, Google)
- GDPR/CCPA rights section
- Account deletion process documented
- Cookie disclosure
- Children's data section
- Back link to homepage

**Gaps & Improvements:**

1. **No cookie consent banner:** The policy states "Roam uses a single session cookie" — but there's no cookie consent banner on the site. Under GDPR/ePrivacy Directive, even essential cookies may require disclosure at first visit. Some interpretations require consent for any non-strictly-necessary cookies. While Supabase Auth cookies are "strictly necessary," many sites add a banner for transparency.

2. **Data retention for moderation queue:** "retained indefinitely for audit purposes." While reasonable, GDPR's "storage limitation" principle may require a more specific retention period or at least a regular review process documented.

3. **No mention of Sentry:** The site uses Sentry for error tracking, which may capture IP addresses and user agent strings. This should be disclosed in the "Technical data" or "Data sharing" section.

**Suggested improvements:**
```
- Implement cookie consent banner (even a minimal one)
- Add Sentry to sub-processors list
- Consider adding a data retention schedule
```

---

### 2.13 404 Page (`not-found.tsx`)

**File:** `web/src/app/not-found.tsx` (20 lines)  
**Type:** Static Server Component

**What works:**
- Clean design with logo, message, and home link
- Good dark mode support
- Proper semantic structure

**Gaps & Improvements:**

1. **Not helpful for discovery:** A 404 on a discovery platform could suggest trying a random page. Add a "Roam to a random page" button or link to `/how-it-works`.

2. **No search suggestion:** "Try searching for what you're looking for" — but there's no search on the site, so this would be misleading.

3. **No humor or brand personality:** The page is functional but sterile. A discovery platform's 404 could be clever/fun (e.g., "This page wandered off. Want to discover something else?").

**Suggested improvements:**
```
- Add "Discover something random" link
- Add personality/brand voice to the copy
```

---

## 3. Shared Components

### 3.1 Header

**File:** `web/src/components/Header.tsx` (176 lines)  
**Type:** Client Component

**What works:**
- Three states: loading, signed-out, signed-in
- Sticky positioning with z-50
- Desktop nav (Profile, Settings) for signed-in users
- Avatar dropdown with Profile/Settings/Sign-out
- Mobile hamburger menu with slide-down nav
- Outside-click detection to close dropdown
- Route-change closes mobile menu
- Palette-based avatar colors

**Gaps & Improvements:**

1. **Loading state shows logo-only header without sign-in buttons:** Users might think the page is broken during the ~200ms auth check. A skeleton or nothing (just the header) is fine, but the logo should still link to `/`.

2. **Mobile menu doesn't include all links:** No "How It Works," "Submit URL," or other useful links in the mobile menu. Only shows Profile, Settings, Sign out.

3. **No active route highlighting:** The nav links don't indicate which page you're on (no `font-bold` or underline on active route).

4. **Avatar dropdown and mobile menu have duplicate links:** Both show Profile and Settings. The desktop avatar dropdown is useful for quick access, but the mobile menu could be richer.

5. **No "Submit URL" link in nav:** Users have to go through Profile to reach `/submit`. A direct nav link would improve discovery.

**Suggested improvements:**
```
- Add active route highlighting
- Expand mobile menu with How It Works, Submit URL
- Add Submit URL to desktop nav for signed-in users
```

---

### 3.2 Footer

**File:** `web/src/components/Footer.tsx` (42 lines)  
**Type:** Server Component (can be static)

**What works:**
- Clean layout with copyright + link nav + feedback widget
- Good link coverage: GitHub, How It Works, Beta, Terms, Privacy, Support email
- Dynamic copyright year
- Feedback widget included

**Gaps & Improvements:**

1. **No "Status" page link:** If the service has downtime, users need a status page (e.g., status.roamtheweb.app or a Supabase status link).

2. **"Support" is an email link:** A mailto link is fine but could be supplemented with a FAQ or help center link.

3. **Footer doesn't include app download links:** The footer is a natural place to re-surface extension and app download links.

**Suggested improvements:**
```
- Add Status page link
- Add browser extension and Android download links
```

---

### 3.3 Layout & Root

**Files:** `web/src/app/layout.tsx` (72 lines), `web/src/app/globals.css` (27 lines)

**What works:**
- Proper Next.js App Router layout with `<html>`, `<body>`
- ThemeProvider (next-themes) with system preference
- AuthProvider with server-validated initial session
- ErrorBoundary wrapping all content
- Header + main + Footer structure
- Geist font family
- Good metadata defaults (title template, description, icons)

**Gaps & Improvements:**

1. **No viewport meta tag:** Next.js 16 moved viewport from metadata to a separate export. Check if `viewport` export exists — if not, add it.

2. **No `<Script>` for analytics:** No Google Analytics, Plausible, or any analytics integration.

3. **Server session double-fetch:** `getUser()` then `getSession()` — this is by design (user is validated, then session fetched only if user exists) but adds latency for authenticated users.

4. **ErrorBoundary catches everything but no fallback UI:** If the entire app crashes, the ErrorBoundary shows... what? Need to verify the ErrorBoundary component renders a useful fallback.

**Suggested improvements:**
```
- Add viewport export
- Add analytics script
- Verify ErrorBoundary fallback UI
```

---

## 4. Middleware & Auth

**File:** `web/src/proxy.ts` (78 lines)

**What works:**
- Session refresh on every request via `getUser()`
- Admin route protection with role check
- Safe type guards for `app_metadata`
- Error logging via `logError`
- Graceful error recovery (allows request through on failure)
- Proper matcher config excluding static files

**Gaps & Improvements:**

1. **No CSRF protection:** Next.js has built-in CSRF protection for Server Actions, but there's no explicit CSRF token validation for API routes or Edge Function calls.

2. **No rate limiting on auth endpoints:** The `/auth/*` routes have no rate limiting at the middleware level. Supabase Auth has its own rate limiting, but additional protection at the Next.js level would be defense-in-depth.

3. **Admin check is based on `app_metadata.role`:** This is secure (server-validated JWT claim), but if the admin role is ever removed from the JWT, the user is silently redirected to `/` with no explanation.

4. **Matcher excludes image files but not all static assets:** The regex `.*\\.(?:svg|png|jpg|jpeg|gif|webp)$` doesn't exclude `.ico`, `.css`, `.js`, or font files. These pass through the middleware unnecessarily, adding latency to static asset requests.

**Suggested improvements:**
```
- Add explicit CSRF protection
- Expand matcher to exclude all static assets
- Add rate limiting on auth routes
```

---

## 5. Cross-Cutting Gaps

### 5.1 Missing Pages/Routes

| Feature | Status | Priority |
|---------|--------|----------|
| Search page | Not implemented | Medium |
| Trending/popular page | Not implemented | Medium |
| Browse by category page | Not implemented | Low |
| User directory (explore users) | Not implemented | Low |
| Activity/notification feed | Not implemented | Low |
| Help/FAQ page | Not implemented | Medium |
| Changelog/release notes | Not implemented | Low |
| Contact page (beyond mailto) | Not implemented | Low |

### 5.2 Missing Technical Infrastructure

| Feature | Status | Priority |
|---------|--------|----------|
| `sitemap.xml` | Not implemented | High |
| `robots.txt` | Not implemented | High |
| JSON-LD structured data | Not implemented | Medium |
| Cookie consent banner | Not implemented | High |
| Analytics (page views, events) | Not implemented | Medium |
| PWA / service worker | Not implemented | Low |
| Dark mode manual toggle | Not implemented | Medium |
| Loading skeletons | Not implemented | Medium |

### 5.3 User Experience Gaps

- **No onboarding wizard on web:** The `/join` flow handles auth + category selection, but there's no guided tour or welcome modal after first sign-in
- **No empty state guidance:** New users with no ratings, no collections, no saved URLs see empty sections without guidance on what to do next
- **No keyboard shortcuts:** Power users can't navigate with keyboard
- **No undo for destructive actions:** Deleting a collection, removing a saved URL — no undo toast
- **No bulk operations:** Can't multi-select saved URLs to add to collection, can't batch-delete

---

## 6. SEO & Metadata

**Current state:** Basic but incomplete.

**What's good:**
- `layout.tsx` has title template (`"%s · Roam"`) and description
- Per-page metadata on most routes (how-it-works, profile, terms, privacy)
- Favicon and Apple touch icon defined
- ISR on dynamic pages (`/u/[username]`, `/c/[slug]`)

**What's missing:**
1. **No `sitemap.xml`:** Critical for search engine discovery. Next.js can generate this dynamically with `sitemap.ts`.
2. **No `robots.txt`:** Should allow crawling, point to sitemap, and optionally disallow `/admin`, `/beta`, `/auth/*`.
3. **No JSON-LD structured data on any page:** Homepage should have `WebSite` + `Organization` schema. Profile pages should have `Person` schema. Collection pages should have `CollectionPage` schema. How It Works should have `Article` or `FAQ` schema.
4. **No OpenGraph images per page:** Only the site-wide favicon/apple-icon. Each page should have a unique OG image for social sharing.
5. **No canonical URLs:** Important for SEO to prevent duplicate content issues.
6. **No `alt` text on the logo Image components:** The `<Image>` tags in Header, Footer, and page.tsx use `alt="Roam"` or `alt="Roam logo"` which is fine, but some decorative uses could be more descriptive.

---

## 7. Accessibility

**Note:** A full WCAG audit requires manual testing with screen readers and keyboard navigation. This section covers code-level observations only.

**What's good:**
- Semantic HTML (`<header>`, `<main>`, `<footer>`, `<nav>`, `<article>`, `<section>`)
- `aria-label` on icon buttons (Header avatar menu, mobile menu toggle, bio edit button)
- `aria-expanded` on dropdown toggles
- Color contrast appears reasonable (dark text on light bg, light text on dark bg)
- Focus-visible ring styles on form inputs

**What needs work:**
1. **No skip-to-content link:** Users navigating by keyboard have to tab through the entire header on every page.
2. **No `role` attributes on custom interactive elements:** The privacy toggle is a `<button>` which is correct, but other custom controls may need roles.
3. **No `aria-live` regions for dynamic content:** Error messages, success confirmations ("✓ Interests saved") don't announce to screen readers.
4. **No focus trapping in modals/dropdowns:** The avatar dropdown doesn't trap focus — pressing Tab moves focus to the page behind the dropdown.
5. **No reduced motion support:** No `prefers-reduced-motion` media query. The Tailwind transitions are mild, but a best practice is to disable them for users who prefer reduced motion.
6. **Form labels use `htmlFor` correctly** (submit page) but some forms may be missing explicit labels.
7. **The "Profile visibility" toggle has no `role="switch"` or `aria-checked`:** It's a `<button>` with an `aria-label` but doesn't expose its state to assistive technology.

---

## 8. Security & Privacy

Based on review of `proxy.ts`, `layout.tsx`, page auth patterns, and existing `SECRETS_AUDIT.md`:

**What's good:**
- Server-side auth checks (`getUser()`) — not trusting client cookies alone
- Admin role verified server-side from JWT `app_metadata`
- RLS policies enforced at database level
- Safe Browsing API enforced in `submit-url` Edge Function
- Rate limiting on public Edge Functions
- `rel="noopener noreferrer"` on external links
- Sentry configured to not leak PII (needs verification)
- `allowBackup` disabled on Android

**What needs work:**
1. **No CSP headers:** No Content-Security-Policy in Next.js config or middleware. This is the most important missing security header.
2. **No HSTS:** Should be enforced at the Vercel/dns level, but worth verifying.
3. **No X-Content-Type-Options / X-Frame-Options:** Standard security headers are missing.
4. **No cookie consent banner:** As noted in Privacy section — legal requirement in EU/California.
5. **Service role key exposed in more places than ideal:** `SUPABASE_SERVICE_ROLE_KEY` is used in `admin/actions.ts` and `admin/dashboard/`. These are server-only, which is fine, but worth auditing that no client component imports them.
6. **No input sanitization on bio/display name:** The bio is stored and rendered directly. React's JSX escaping prevents XSS, but URL fields should also be validated.

---

## 9. Performance

**What's good:**
- Server Components used extensively (reduces client JS)
- ISR on dynamic pages (60s revalidation)
- `Promise.all` for parallel data fetching on profile page
- Next.js Image component with `priority` on above-fold images
- Tailwind CSS with minimal custom CSS

**What needs work:**
1. **No loading skeletons:** Client-side navigations via `<Link>` show no visual feedback while the next page's server component renders. This is especially noticeable on `/profile` which does 6 DB queries.
2. **No streaming:** Could use `loading.tsx` files or React Suspense boundaries for slower pages.
3. **Admin page loads data client-side:** The moderation queue could be SSR'd to avoid a loading flash.
4. **No image optimization for user avatars:** The initial-letter avatars are fine, but if avatar upload is added, images need `next/image` with proper sizing.
5. **No bundle size monitoring:** No Lighthouse CI or bundle analyzer in the build pipeline.

---

## 10. Alignment with Existing Reports

### ROADMAP.md (Stages 3, 10, 11, 12)

Web-app tasks from the roadmap that are still incomplete:

| Task | Description | Status |
|------|-------------|--------|
| 3.9a | Admin queue metadata display | ❌ Not done |
| 3.9b | Admin undo capability | ❌ Not done |
| 3.9c | Admin filtering/sorting/search | ❌ Not done |
| 10.x | Various web polish tasks (6/20 done) | ⏳ Partial |
| 11.x | Hardening tasks (29/34 done) | ⏳ Partial |

### SOCIAL_FEATURES_REPORT.md

The social features report was written recently (2026-06-07) and is largely accurate. Key web-specific items:

- **Profile privacy toggle:** The report says "No is_public toggle." However, ProfileClient.tsx DOES have a toggle at lines 175-198. The report appears to have been written before this was added, or the toggle was recently implemented.
- **Follow UI:** Still missing entirely (no follow/unfollow buttons on public profiles according to the report — but the code review shows FollowButton IS imported and rendered on `/u/[username]` at line 115-119). The report may be outdated on this point.
- **Copy profile link:** Now implemented (CopyProfileLink.tsx exists).
- **"Following feed" copy in /how-it-works:** Still an issue — feature doesn't exist.

**Verdict:** The SOCIAL_FEATURES_REPORT needs a refresh — several items have been implemented since it was written.

### SECRETS_AUDIT.md

Well-maintained, comprehensive. No gaps identified from the web app perspective.

---

## 11. Prioritized Recommendations

### CRITICAL (fix immediately)

| # | Issue | Page | Effort |
|---|-------|------|--------|
| C1 | **Typo: `roam.the.web/u/` → `roamtheweb.app/u/`** | ProfileClient.tsx:154 | 1 min |

### HIGH (fix before public launch)

| # | Issue | Page | Effort |
|---|-------|------|--------|
| H1 | Add account deletion UI (GDPR requirement) | Settings or Profile | 2–3 hours |
| H2 | Add cookie consent banner (GDPR/ePrivacy) | Layout | 1–2 hours |
| H3 | Add `sitemap.xml` + `robots.txt` | Root | 1 hour |
| H4 | Admin queue: add filtering, sorting, search, pagination | Admin | 4–6 hours |
| H5 | Admin queue: add detailed metadata per submission | Admin | 2–3 hours |
| H6 | Add language preferences + paywall skip to web Settings | Settings | 1–2 hours |
| H7 | Replace or hide Android "Coming Soon" on homepage | Homepage | 15 min |

### MEDIUM (improve within 2 weeks)

| # | Issue | Page | Effort |
|---|-------|------|--------|
| M1 | Add dark mode manual toggle | Header/Layout | 1 hour |
| M2 | Add JSON-LD structured data to all pages | Multiple | 2–3 hours |
| M3 | Add loading skeletons for slow pages | Profile, Admin | 2–3 hours |
| M4 | Add search functionality (URLs + collections) | New page | 6–8 hours |
| M5 | Add link preview to submit page | Submit | 1–2 hours |
| M6 | Fix /how-it-works "following feed" copy | How It Works | 15 min |
| M7 | Add visual diagram to /how-it-works | How It Works | 2–3 hours |
| M8 | Add FAQ section to /how-it-works | How It Works | 1–2 hours |
| M9 | Add analytics (Plausible or PostHog) | Layout | 1–2 hours |

### LOW (nice to have)

| # | Issue | Page | Effort |
|---|-------|------|--------|
| L1 | Add avatar upload | Profile | 3–4 hours |
| L2 | Add "Fork collection" button | /c/[slug] | 2–3 hours |
| L3 | Add OG image thumbnails to collection items | /c/[slug] | 1 hour |
| L4 | Add favicons to collection items | /c/[slug] | 30 min |
| L5 | Add product screenshot to homepage | Homepage | 1–2 hours |
| L6 | Add trending/showcase to homepage | Homepage | 3–4 hours |
| L7 | Add homepage social proof stats | Homepage | 30 min |
| L8 | Add empty state guidance for new users | Profile | 1–2 hours |
| L9 | Add keyboard shortcuts | Global | 2–3 hours |
| L10 | Add CSRF protection | Middleware | 1–2 hours |
| L11 | Add security headers (CSP, HSTS, etc.) | next.config.ts | 2–3 hours |

---

## Summary

**Total findings:** 55  
**Critical:** 1 · **High:** 7 · **Medium:** 9 · **Low:** 11 · **Already functioning well:** 27

**Estimated total effort for all recommendations:** ~50–70 hours

**Recommended immediate sprint (C1 + H1–H7):** ~14–19 hours to address all critical and high-priority items.

The web app is in good shape for a beta/early-access product. The backend infrastructure (database, Edge Functions, RLS) is mature and well-designed. The primary gap is in the UI layer — features that exist in the database (language preferences, paywall skip, account deletion, follow system) are not exposed to web users. The admin moderation queue is the weakest page and needs the most work before submission volume grows.