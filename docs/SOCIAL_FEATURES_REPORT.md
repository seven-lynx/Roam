# Roam Social Features — Current State & Gaps

**Date:** 2026-06-07  
**Scope:** Profile sharing, public vs private profiles, public vs private collections, follow system, sharing mechanisms, and social feature management across all platforms (web, browser extension, Android app).

---

## 1. Overview

Roam has significant social infrastructure built at the database and Edge Function layer, but most of it has no client-side UI on any platform. The backend is well-architected with proper RLS policies, rate limiting, and validation — the gap is exclusively in the UI layer.

---

## 2. How Social Features Currently Work

### 2.1 Profile System

**Database:** `profiles` table has `is_public BOOLEAN DEFAULT TRUE`. When a profile is private, RLS prevents anyone except the owner from reading it.

**Profile Edge Function** (`GET /functions/v1/profile?username=`):  
- Unauthenticated, rate-limited (60 req/min/IP)
- Returns: `user_id`, `username`, `display_name`, `bio`, `avatar_url`, `is_public`, `follower_count`, `following_count`, `collections_count`, `created_at`, and list of public collections
- Uses service-role client to compute follower/following counts (bypasses RLS on the `follows` table, but only exposes aggregate numbers)
- Returns 404 for non-existent users or private profiles viewed by unauthenticated callers

**Web public profile page** (`/u/[username]`):  
- Server-rendered Next.js page, revalidated every 60 seconds
- Queries `profiles` directly (not via Edge Function) with `.eq('is_public', true)`
- Displays: avatar, display name, @username, bio, interest pills (deduplicated by category name), and public collections
- Has a link to the profile URL but no copy-to-clipboard button
- Does NOT display: follower/following counts, join date, follow button

**Web own-profile page** (`/profile` — ProfileClient.tsx):  
- Shows the user's own profile with editable bio, interest picker (pillar/topic modes), collections manager, and saved URLs manager
- Clickable link to public profile (`roam.the.web/u/[username] ↗`) but no copy button
- No `is_public` toggle — users cannot change their profile visibility

**Android ProfileScreen** (`ProfileScreen.kt`):  
- Shows: color-coded initial avatar, stats row ("Roamed" / "Submitted" / "Joined"), editable username/displayName/bio fields (debounced auto-save), interest chips (pillar or topic mode with toggle), sign-out button
- Does NOT load or display: `is_public` state, follower/following counts, profile link, share button

### 2.2 Collections System

**Database:** `collections` table with `is_public BOOLEAN DEFAULT TRUE`. RLS: public collections visible to everyone; private collections visible only to owner and approved followers.

**Collection Edge Function** (`POST /functions/v1/collection`):  
- Actions: `create`, `update`, `add_item`, `remove_item`, `list`
- `create`: auto-generates slug from name + first 8 chars of user UUID (prevents cross-user collisions)
- `add_item`: enforces 10,000 total items per user across all collections (uses `count_user_collection_items` RPC)
- `update`: can change `name`, `slug`, and `is_public`
- Returns `is_public` status in all responses

**Web CollectionsManager** (`/profile` — CollectionsManager.tsx):  
- Fully implemented: create, delete, expand to view items, remove items
- Public/private toggle with badge ("Public" in green, "Private" in gray)
- "Share" button that sets collection to public; "Make private" button that hides it
- Copy share link button (🔗) that copies `https://roamtheweb.app/c/{slug}` with "✓" confirmation
- Descriptive help text: "Max 20 collections · 200 items each. Make a collection public to share it."

**Web public collection page** (`/c/[slug]`):  
- Server-rendered, shows collection name, owner, and all items as cards (OG image, title, description, raw URL)
- Returns 404 for private or non-existent collections

**Android** (`ConfigBottomSheet.kt`, `SavedScreen.kt`):  
- Supports: "Add to collection" (with dropdown), "Roam a collection" (with dropdown), create new collection, view saved items
- Does NOT support: collection privacy toggle (public/private), copy share link

**Extension** (`popup.ts`, `background.ts`):  
- Supports: add URL to collection (with dropdown), roam within a collection, create collection
- Does NOT support: collection privacy toggle, copy share link

### 2.3 Follow System

**Database:** `follows` table with `follower_id`, `following_id`, `is_pending BOOLEAN`, `created_at`. UNIQUE constraint on (follower_id, following_id). CHECK prevents self-follows.

**Follow Edge Function** (`POST /functions/v1/follow`):  
- Actions: `follow`, `unfollow`, `accept_request`, `reject_request`
- `follow`: checks target profile's `is_public` — if public, immediately creates follow; if private, creates pending request
- `accept_request` / `reject_request`: only the target user can act on pending requests
- Rate limited: 30 req/min per authenticated user
- Returns `"following"`, `"pending"`, or `"none"` status

**RLS:** Follow rows are only readable by the two parties involved (follower and following). The profile Edge Function uses service-role client to count them, exposing only aggregate numbers.

**UI status:** No follow/unfollow buttons, no follower/following count displays, no pending request management exists on ANY platform. The entire follow backend is deployed and functional but completely invisible to users.

### 2.4 Sharing Mechanisms

| Feature | Web | Extension | Android |
|---|---|---|---|
| Share current URL | — | — | System share sheet (ACTION_SEND) |
| Copy collection link | ✓ (CollectionsManager) | — | — |
| Copy profile link | Bare link only, no copy button | — | — |
| Save for later | SavedUrlsManager on /profile | Config panel save button | ConfigBottomSheet save + SavedScreen tab |
| Submit URL | /submit page | Thumbs-up on unknown page | SubmitBottomSheet with category picker |
| Report broken link | — | Via CHECK_URL + REPORT_URL | reportBrokenLink() in MainViewModel |

### 2.5 Cross-Platform Save Sync

Saved URLs sync between web and Android via the `save-url` Edge Function (`POST /functions/v1/save-url` with `save`/`unsave`/`list` actions). The Android MainViewModel merges server-saved URLs with local SharedPreferences on init. The extension stores saves in `chrome.storage.local` only (no server sync for saves on extension).

---

## 3. Gaps — What Needs Work

### High Priority (backend complete, UI missing)

1. **Profile privacy toggle**
   - `profiles.is_public` exists, RLS enforces it, Edge Function returns it
   - No toggle in web `ProfileClient.tsx` or Android `ProfileScreen.kt`
   - Users can never set their profile to private

2. **Follow/unfollow UI**
   - Entire follow backend is built and deployed (Edge Function, RLS, DB constraints, rate limiting)
   - Zero client UI on any platform
   - No follow button, no follower/following counts, no pending request management

3. **Public profile page gaps** (`/u/[username]`)
   - Does not display follower/following counts (the profile Edge Function returns them but the Next.js page queries profiles directly, not via the Edge Function)
   - Does not display join date (`created_at`)
   - No follow/unfollow button (depends on item #2)
   - No copy-profile-link button

4. **Collection privacy toggle on Android**
   - `is_public` is supported by the Edge Function and the DB
   - `ConfigBottomSheet.kt` and `SavedScreen.kt` have no visibility toggle
   - All Android-created collections remain at the DB default (`is_public = true`)

### Medium Priority (partial implementation)

5. **Profile share/copy link**
   - Web: ProfileClient shows clickable link but no copy-to-clipboard button
   - Android: ProfileScreen has no profile link or share capability at all

6. **Extension collection share link**
   - Extension can add URLs to collections and roam within them
   - Cannot copy a collection's public share URL

7. **Android ProfileScreen social fields**
   - `UserProfile` model may not include `is_public`
   - Stats row only shows "Roamed / Submitted / Joined" — no follower/following counts
   - No profile URL display

8. **Web saved URLs batch operations**
   - `SavedUrlsManager` shows saved items individually
   - No multi-select, no batch "add to collection" action
   - Users must add items to collections one at a time via extension or Android

### Low Priority (documentation/copy mismatch)

9. **"Following feed" copy in `/how-it-works`**
   - Page states: "Follow users. See what interesting people are discovering."
   - No activity feed exists — no endpoint for followed-users' ratings/saves/collections
   - Either build the feature or remove the line from the marketing page

---

## 4. What Needs No Work

- Collection privacy toggle on web (`CollectionsManager.tsx`) — complete and polished
- Save-for-later across platforms — complete (web + Android with server sync; extension local-only is acceptable)
- Submit URL — complete on all platforms
- Report broken link — complete (web via admin, extension via REPORT_URL, Android via reportBrokenLink)
- Rate (👍/👎) — complete on all platforms
- Profile Edge Function rate limiting and privacy — complete
- RLS policies for profiles, collections, and follows — complete and correct
- API documentation (`supabase/API.md`) — complete and up-to-date for all social endpoints
- Collection CRUD — complete (create, update, add/remove items, list)
- Wilson score ranking — complete (automatic via DB trigger)

---

## 5. Architecture Summary

```
Profiles (DB)
  ├─ is_public BOOLEAN ── RLS enforces visibility
  └─ Profile Edge Function returns follower/following counts

Collections (DB)
  ├─ is_public BOOLEAN ── RLS enforces visibility
  ├─ Collection Edge Function handles CRUD + items
  └─ Web CollectionsManager has full public/private toggle

Follows (DB)
  ├─ is_pending BOOLEAN ── handles private-profile requests
  ├─ Follow Edge Function handles follow/unfollow/accept/reject
  └─ NO CLIENT UI ON ANY PLATFORM

Save for Later
  ├─ save-url Edge Function (save/unsave/list)
  ├─ Web SavedUrlsManager
  ├─ Android MainViewModel.saveForLater() + SavedScreen
  └─ Extension chrome.storage.local (no server sync)

Sharing
  ├─ Web: collection copy-link; profile bare link only
  ├─ Android: system share sheet (current URL only)
  └─ Extension: no share capabilities