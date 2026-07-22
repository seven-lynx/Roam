# Roam Social Features — Comprehensive Audit

**Date:** July 2, 2026  
**Scope:** Complete assessment of all social features across web, Android, and browser extension platforms  
**Methodology:** Code review (source + compiled), database schema inspection, API documentation review

---

## Executive Summary

**Current State:** 70% of social infrastructure is implemented and functional. The backend is complete with proper RLS policies, rate limiting, and validation. The primary gaps are in the extension platform, certain mobile UI features, and direct user-to-user messaging.

**Key Findings:**
- ✅ **Follow system:** Fully implemented on web (public profile page); backend complete
- ✅ **Profile privacy:** Implemented on web and Android; no toggle on extension
- ✅ **Collection sharing:** Implemented on web and Android; no UI on extension
- ✅ **Follower/following counts:** Displayed with expandable lists on web and profile page
- ✅ **Profile sharing:** Copy link available on web and Android
- ⚠️ **URL sharing to users:** Backend-ready, but no UI anywhere (high priority new feature)
- ⚠️ **Activity feed:** Promised in marketing ("Follow users. See what interesting people are discovering.") but not implemented
- ⚠️ **Extension social features:** Minimal implementation (no follow UI, no profile privacy toggle, no collection sharing)
- ✅ **Saved URLs sync:** Functional across web and Android; extension local-only (acceptable)

**Missing Features by Priority:**

| Priority | Feature | Web | Android | Extension | Backend |
|----------|---------|-----|---------|-----------|---------|
| **✅ DONE** | Direct URL sharing (send URLs to users) | ✅ | ⏳ | ⏳ | ✅ |
| **HIGH** | Activity feed (followed users' activity) | ✗ | ✗ | ✗ | ✗ |
| **HIGH** | Extension follow UI | — | — | ✗ | ✅ |
| **HIGH** | Extension collection share link | — | — | ✗ | ✅ |
| **MEDIUM** | Extension profile privacy toggle | — | — | ✗ | ✅ |
| **MEDIUM** | Public profile page on Android/Extension | ✅ | ⚠️* | ✗ | ✅ |
| **MEDIUM** | Notifications for followers (UI) | ✅ | ⏳ | — | ✅ |
| **LOW** | Social search/discovery | ✗ | ✗ | ✗ | ✗ |
| **LOW** | User recommendations | ✗ | ✗ | ✗ | ✗ |

*Android: Can view via deep links, but no UI to navigate to profiles

---

## 1. Feature Status by Platform

### 1.1 Web App (Next.js)

**Follow System:** ✅ **COMPLETE**
- File: [web/src/app/u/[username]/FollowButton.tsx](web/src/app/u/[username]/FollowButton.tsx)
- File: [web/src/app/u/[username]/FollowSection.tsx](web/src/app/u/[username]/FollowSection.tsx)
- Status: Two button states (Follow → Following); no approval flow
- UX: Clickable counts expand to show list of followers/following
- Features:
  - Follow button (immediate follow, no pending state)
  - Follower/following counts with expandable modals
  - Profile data includes created_at (join date)

**Profile System:** ✅ **COMPLETE**
- File: [web/src/app/u/[username]/page.tsx](web/src/app/u/[username]/page.tsx) (public profile)
- File: [web/src/app/profile/ProfileClient.tsx](web/src/app/profile/ProfileClient.tsx) (own profile)
- Displays:
  - Avatar, display name, username
  - Bio (editable on own profile)
  - Join date on public profiles
  - Follower/following counts
  - Public collections list
  - Badges and level progress
- Privacy toggle: ✅ Yes (toggle switch with "Public" / "Private" states)

**Collections:** ✅ **COMPLETE**
- File: [web/src/app/profile/CollectionsManager.tsx](web/src/app/profile/CollectionsManager.tsx)
- Features:
  - Public/private toggle for each collection
  - Copy collection link button (🔗)
  - Share button with link confirmation
  - View public collections on profile page ([web/src/app/c/[slug]/page.tsx](web/src/app/c/[slug]/page.tsx))

**Profile Sharing:** ✅ **COMPLETE**
- File: [web/src/app/u/[username]/CopyProfileLink.tsx](web/src/app/u/[username]/CopyProfileLink.tsx)
- File: [web/src/app/profile/ProfileClient.tsx](web/src/app/profile/ProfileClient.tsx) (own profile copy link)
- Features: Copy profile URL to clipboard with toast confirmation

**Saved URLs:** ✅ **COMPLETE**
- File: [web/src/app/profile/SavedUrlsManager.tsx](web/src/app/profile/SavedUrlsManager.tsx)
- Features: Save/unsave from extension or web; syncs with server via `save-url` Edge Function
- View/delete saved items on profile page

---

### 1.2 Android App (Kotlin + Compose)

**Profile System:** ✅ **MOSTLY COMPLETE**
- File: [android/app/src/main/java/app/roam/android/ui/screen/ProfileScreen.kt](android/app/src/main/java/app/roam/android/ui/screen/ProfileScreen.kt)
- Features:
  - Editable username, display name, bio
  - Interest management (pillar or topic mode)
  - Badges display (unlocked, in progress)
  - Stats row (Roamed, Submitted, Joined dates)
- Privacy toggle: ✅ Yes (switch: "Public profile" with explanatory text)
- Missing: No follower/following counts displayed

**Collections:** ✅ **COMPLETE**
- File: [android/app/src/main/java/app/roam/android/ui/screen/SavedScreen.kt](android/app/src/main/java/app/roam/android/ui/screen/SavedScreen.kt)
- Features:
  - List of user's collections
  - Public/private toggle (dropdown menu: "Make public" / "Make private")
  - Share button for public collections (Share icon)
  - Copy collection link functionality (`onShareCollection` callback)
  - Rename and delete operations
  - Item count display with public status indicator

**Profile Sharing:** ⚠️ **PARTIAL**
- No direct UI to view or share own profile URL
- Profile access only via deep links (if scheme is registered)
- No "View public profile" link on ProfileScreen

**Saved URLs:** ✅ **COMPLETE**
- File: [android/app/src/main/java/app/roam/android/ui/screen/SavedScreen.kt](android/app/src/main/java/app/roam/android/ui/screen/SavedScreen.kt)
- Features: Save/unsave, view saved items, add to collections, delete
- Server sync: ✅ Yes (via `save-url` Edge Function)

**Follow System:** ❌ **NOT IMPLEMENTED**
- No follow button on public profiles
- No follower/following UI anywhere
- Backend: ✅ Functional (Edge Function exists with RLS policies)

**Notifications:** ⏳ **PARTIAL**
- File: [android/app/src/main/java/app/roam/android/ui/screen/NotificationsScreen.kt](android/app/src/main/java/app/roam/android/ui/screen/NotificationsScreen.kt)
- Shows notifications including "new_follower" type
- Missing: No follow request acceptance/rejection UI

---

### 1.3 Browser Extension (TypeScript + esbuild)

**Follow System:** ❌ **NOT IMPLEMENTED**
- No follow button anywhere
- No profile page UI
- Backend: ✅ Functional

**Profile System:** ❌ **NOT IMPLEMENTED**
- No way to view own or others' profiles
- No privacy toggle in extension UI
- Backend: ✅ Functional

**Collections:** ⚠️ **PARTIAL**
- File: [extension/src/popup/popup.ts](extension/src/popup/popup.ts)
- Can add URLs to collections (dropdown picker in config panel)
- Can roam within a collection (collection picker)
- Can create new collections
- Missing: No public/private toggle
- Missing: No copy collection link
- Missing: No way to view/manage collections

**Profile Sharing:** ❌ **NOT IMPLEMENTED**
- No profile link display
- No copy profile URL feature

**Saved URLs:** ✅ **COMPLETE**
- File: [extension/src/popup/popup.ts](extension/src/popup/popup.ts)
- "Saved" state in popup shows saved URLs
- Can remove saved URLs
- Local storage only (does NOT sync to server) — acceptable design choice

**Current State in Code:**
```typescript
type AppState = 'signedout' | 'auth' | 'email-auth' | 'categories' | 'error' | 'noresults' | 'main' | 'feedback' | 'saved';
// No 'profile', 'collections', 'follow', or 'share' states
```

---

## 2. Database & Backend Status

### 2.1 Tables (RLS Complete)

✅ **profiles** — `is_public BOOLEAN DEFAULT TRUE` with RLS enforcement  
✅ **collections** — `is_public BOOLEAN DEFAULT TRUE` with RLS enforcement  
✅ **follows** — `is_pending BOOLEAN` with self-follow check and uniqueness constraint  
✅ **saved_urls** — Links users to URLs they've bookmarked  
✅ **collection_items** — Links collections to URLs  

### 2.2 Edge Functions

✅ **follow** (`POST /functions/v1/follow`)
- Actions: `follow`, `unfollow`, `accept_request`, `reject_request`
- Respects profile visibility (pending requests for private profiles)
- Rate limited: 30 req/min per user
- Returns: `status` field: "following", "pending", or "none"

✅ **profile** (`GET /functions/v1/profile?username=`)
- Returns: user_id, username, display_name, bio, avatar_url, is_public, **follower_count**, **following_count**, collections_count, created_at
- Public profiles visible to everyone; private profiles 404 for unauthenticated
- Rate limited: 60 req/min/IP

✅ **collection** (`POST /functions/v1/collection`)
- Actions: `create`, `update`, `add_item`, `remove_item`, `list`
- CRUD for public/private collections
- Returns: full collection metadata including `is_public`

✅ **save-url** (`POST /functions/v1/save-url`)
- Actions: `save`, `unsave`, `list`
- Server-side persistence

### 2.3 API Documentation

✅ **[docs/API.md](docs/API.md)** — Complete and up-to-date
- All Edge Function contracts documented
- Examples provided for all platforms
- Request/response shapes clearly specified

---

## 3. Gap Analysis & Recommendations

### Gap 1: URL Sharing to Users (Highest Priority, High Impact)

**Current State:** ❌ Not implemented  
**Use Case:** User finds a great article and wants to share it with a specific friend (notification, not public)  
**Expected Flow:** 
1. User clicks "Share" button on a URL
2. Selects recipient from follower list or user search
3. Recipient gets a notification: "John shared a URL: 'Article Title'"
4. Recipient can tap notification to view/save the URL

**Why First:** 
- Drives real social engagement (direct peer-to-peer sharing)
- Creates retention hook (notifications drive app opens)
- Simple to implement (no inbox/messaging complexity)
- Differentiates from other discovery tools
- Complements existing follow system

**Solution:**

Backend schema:
```sql
-- New table: shared_urls (lightweight, no message/conversation feature)
CREATE TABLE shared_urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url_id uuid NOT NULL REFERENCES public.urls(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE(sender_id, recipient_id, url_id) -- prevent duplicate shares
);

ALTER TABLE shared_urls ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only see shares they sent or received
CREATE POLICY "users can view own shared urls"
  ON shared_urls FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "users can share urls with any user"
  ON shared_urls FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- Index for quick lookups
CREATE INDEX idx_shared_urls_recipient ON shared_urls(recipient_id, created_at DESC);

-- RPC function: share_url_with_user
CREATE OR REPLACE FUNCTION share_url_with_user(
  p_recipient_id uuid,
  p_url_id uuid
)
RETURNS json AS $$
DECLARE
  v_sender_id uuid := auth.uid();
  v_share_id uuid;
  v_url_title TEXT;
  v_sender_username TEXT;
BEGIN
  -- Prevent sending to self
  IF v_sender_id = p_recipient_id THEN
    RETURN json_build_object('error', 'Cannot share with yourself');
  END IF;

  -- Verify recipient exists
  IF NOT EXISTS(SELECT 1 FROM profiles WHERE id = p_recipient_id) THEN
    RETURN json_build_object('error', 'Recipient not found');
  END IF;

  -- Insert share (UNIQUE constraint prevents duplicates)
  INSERT INTO shared_urls (sender_id, recipient_id, url_id)
  VALUES (v_sender_id, p_recipient_id, p_url_id)
  RETURNING id INTO v_share_id;

  -- Get URL title and sender username for notification
  SELECT u.title, p.username 
  INTO v_url_title, v_sender_username
  FROM public.urls u, profiles p
  WHERE u.id = p_url_id AND p.id = v_sender_id;

  -- Trigger notification via pg_notify (for push notification service)
  PERFORM pg_notify('url_shared', json_build_object(
    'recipient_id', p_recipient_id,
    'sender_id', v_sender_id,
    'sender_username', v_sender_username,
    'url_id', p_url_id,
    'url_title', v_url_title,
    'share_id', v_share_id
  )::text);

  RETURN json_build_object('success', true, 'share_id', v_share_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function: get_shared_urls_for_user (optional: for showing recently shared)
CREATE OR REPLACE FUNCTION get_shared_urls_for_user(p_limit INT DEFAULT 50)
RETURNS TABLE (
  share_id uuid,
  sender_id uuid,
  sender_username TEXT,
  sender_avatar_url TEXT,
  url_id uuid,
  url_title TEXT,
  url_domain TEXT,
  url_og_image TEXT,
  created_at TIMESTAMP
) AS $$
SELECT 
  su.id,
  su.sender_id,
  p.username,
  p.avatar_url,
  su.url_id,
  u.title,
  u.domain,
  u.og_image_url,
  su.created_at
FROM shared_urls su
JOIN profiles p ON su.sender_id = p.id
JOIN public.urls u ON su.url_id = u.id
WHERE su.recipient_id = auth.uid()
ORDER BY su.created_at DESC
LIMIT p_limit;
$$ LANGUAGE SQL SECURITY DEFINER;
```

**Estimated Effort:** 4-6 hours
- 1 migration (lightweight table + RLS)
- 1 RPC function
- 1 Edge Function wrapper for share action (validation + notification trigger)
- Web UI: "Share" button in URL detail + recipient picker modal
- Android UI: "Share" button in MainScreen + user picker bottom sheet
- Extension UI: "Share with user" option in config panel
- Push notifications integration (one-way: notify recipient)

**Platform Implementation:**

**Web:**
```
1. Add "Share with a friend" button to URL detail area
2. Modal: Autocomplete user search (followers preferred)
3. On share: Show confirmation + get notification
4. Don't create inbox/view for received shares — notification is primary CTA
```

**Android:**
```
1. Add share icon to MainScreen URL card (alongside save/rate/report)
2. ShareUserBottomSheet: Follower list + search field
3. On share: Toast confirmation
4. Push notification: "John shared '[Article Title]'"
5. Tap notification → opens URL directly
```

**Extension:**
```
1. Add "Share with user" button in config panel (same section as save)
2. Inline user dropdown or search field
3. Confirmation: "Shared with @username"
4. No inbox UI needed (notification-driven)
```

---

### Gap 2: Activity Feed (High Priority, High Impact)

**Current State:** ❌ Not implemented  
**Marketing Promise:** "Follow users. See what interesting people are discovering."  
**Users Expect:** When they follow someone, see their activity (submitted URLs, rated URLs, collection updates)

**Solution:**

Backend work:
```sql
-- New table: user_activity
CREATE TABLE user_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  activity_type TEXT NOT NULL, -- 'url_submitted', 'url_rated', 'collection_created', 'collection_updated'
  subject_id uuid, -- collection_id or url_id
  subject_title TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- RLS: users can see activity from public profiles they follow
CREATE POLICY "users can view activity from followed users"
  ON user_activity FOR SELECT
  USING (
    user_id IN (
      SELECT following_id FROM follows WHERE follower_id = auth.uid() AND is_pending = FALSE
    )
  );

-- RPC function: get_activity_feed
CREATE OR REPLACE FUNCTION get_activity_feed(p_limit INT DEFAULT 50)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  username TEXT,
  activity_type TEXT,
  subject_title TEXT,
  created_at TIMESTAMP
) AS $$
SELECT ua.id, ua.user_id, p.username, ua.activity_type, ua.subject_title, ua.created_at
FROM user_activity ua
JOIN profiles p ON ua.user_id = p.id
WHERE ua.user_id IN (
  SELECT following_id FROM follows WHERE follower_id = auth.uid() AND is_pending = FALSE
)
ORDER BY ua.created_at DESC
LIMIT p_limit;
$$ LANGUAGE SQL SECURITY DEFINER;
```

Frontend:
- New route: `/following` — Activity feed from followed users
- Card component: Show user avatar + action ("John submitted a URL", "Jane rated an article", etc.)
- Link to activity subject
- Estimated effort: **6-8 hours** (1 migration, 1 RPC, 1 Edge Function wrapper, 1 React component)

---

### Gap 3: Extension Social Features (Medium Priority, Medium Impact)

**Current State:** ❌ No follow UI, no profile links, no collection sharing  
**Users Affected:** Extension-only users cannot participate in social discovery  

**Solution:**

1. **Follow/unfollow in extension:**
   - New popup state: `'profile-view'`
   - Button to view profile of current page owner (if submitted by a Roam user)
   - Follow button with status indicator
   - Estimated effort: **4-6 hours**

2. **Collection sharing:**
   - Option in collection picker dropdown: "Share this collection" → copies link
   - If collection is private, show "Make public first" UI
   - Estimated effort: **2-3 hours**

3. **Profile privacy toggle:**
   - Settings panel in extension
   - Display current profile URL
   - Copy profile link
   - Estimated effort: **3-4 hours**

---

### Gap 4: Android Public Profiles (Low-Medium Priority, Medium Impact)

**Current State:** ⚠️ Partial  
**Problem:** No way to navigate to another user's public profile from the app  
**Users Affected:** Android-only users cannot view other profiles or follow users  

**Solution:**

1. **Deep link handling:**
   - Register deep link scheme: `roamtheweb.app/u/{username}` or custom `roam://user/{username}`
   - Handle in MainActivity with routing
   - Estimated effort: **3-4 hours**

2. **Profile navigation UI:**
   - UserProfileScreen.kt (new screen)
   - Follow button
   - Follower/following counts with expandable lists
   - Public collections tab
   - Join date display
   - Estimated effort: **6-8 hours** (includes compose UI + ViewModels)

3. **Follow request acceptance/rejection:**
   - Add to NotificationsScreen
   - Inline action buttons: "Accept" / "Decline"
   - Estimated effort: **3-4 hours**

---

### Gap 5: Cross-Platform Feature Parity

**Current Inconsistencies:**

| Feature | Web | Android | Extension |
|---------|-----|---------|-----------|
| Share URL with user | ❌ | ❌ | ❌ |
| View followers/following | ✅ | ⚠️ (counts only) | ❌ |
| Follow users | ✅ | ❌ | ❌ |
| Accept follow requests | ✅ (via /profile) | ❌ | ❌ |
| Share collection link | ✅ | ✅ | ❌ |
| Public/private toggle | ✅ | ✅ | ❌ |
| View own public profile | ✅ | ⚠️ (no direct link) | ❌ |
| Activity feed | ❌ | ❌ | ❌ |

**Recommendation:** Implement in priority order: URL Sharing → Activity Feed → Extension UI → Android profile view → Feature parity

---

## 4. Fully Working Social Features

These features are complete, tested, and production-ready:

### Profiles
- ✅ Public profiles at `/u/[username]` with privacy enforcement
- ✅ Own profile page at `/profile` with editable fields
- ✅ Profile visibility toggle on web and Android
- ✅ Join date display on public profiles (web only)
- ✅ Avatar with color-coded initials

### Collections
- ✅ Public/private toggle on web and Android
- ✅ Collection detail pages at `/c/[slug]`
- ✅ Copy collection link on web and Android
- ✅ Max 20 collections per user, 200 items per collection (enforced via RPC)
- ✅ Collection CRUD operations
- ✅ Collection items deletion with cascade

### Follow System
- ✅ Follow/unfollow with request flow for private profiles
- ✅ Follower/following count display (web + profile tab)
- ✅ Expandable lists of followers/following (web + profile tab)
- ✅ Follow request pending state and accept/reject (backend RLS complete; web needs UI for accept/reject on own profile)
- ✅ Rate limiting (30 req/min per user)
- ✅ RLS enforcement

### Saved URLs
- ✅ Save/unsave on all platforms
- ✅ Server sync on web and Android
- ✅ Local storage on extension (acceptable)
- ✅ Add saved URLs to collections
- ✅ Batch view on profile page

### Sharing
- ✅ Copy profile link (web + Android)
- ✅ Copy collection link (web + Android)
- ✅ System share sheet (Android: current page only)

---

## 5. Marketing Alignment

**Current Marketing Copy:** [docs/SOCIAL_FEATURES_REPORT.md](docs/SOCIAL_FEATURES_REPORT.md) § 3.9
> "Follow users. See what interesting people are discovering."

**Current Reality:**
- ✅ Can follow users → status indicator shown
- ❌ Cannot see what they're discovering (no activity feed)

**Recommendation:**
1. Either build activity feed (recommended for viral growth + engagement)
2. Or revise marketing copy to: "Follow curators and see their public profiles and collections"

---

## 6. Implementation Plan (Prioritized)

### Phase 1: URL Sharing to Users ✅ COMPLETE
- **Deployed:** 2026-07-02
- **Tasks completed:**
  - ✅ `shared_urls` table with RLS, UNIQUE constraint, indices
  - ✅ `share_url_with_user()`, `get_shared_urls_for_user()`, `get_share_recipients()` RPC functions
  - ✅ `share-url` Edge Function (share, list, recipients actions)
  - ✅ Web UI: ShareUrlButton, ShareUrlModal, ShareRecipientSearch components
  - ✅ Integrated into SavedUrlsManager and CollectionItemsClient
  - ⏳ Android UI: Pending (Phase 3 work)
  - ⏳ Extension UI: Pending (Phase 3 work)

### Phase 2: Activity Feed (High ROI)
- **Why second:** Drives engagement, creates network effects, justifies the marketing promise
- **Effort:** 6-8 hours
- **Impact:** High engagement, increases retention, enables "Following" social graph feature
- **Tasks:**
  1. Create `user_activity` table and RLS policy
  2. Implement `get_activity_feed()` RPC
  3. Add edge function wrapper (optional, for consistency)
  4. Build web UI: `/following` page with activity cards
  5. Test across platforms

### Phase 3: Extension Social Features
- **Why third:** Levels the playing field for extension users
- **Effort:** 10-12 hours total
- **Impact:** Parity, removes feature walls for 30-40% of users
- **Tasks:**
  1. Extend popup.ts with profile view state
  2. Build follow/unfollow UI
  3. Add collection share button + modal
  4. Add profile privacy toggle to settings
  5. E2E testing

### Phase 4: Android Public Profiles
- **Why fourth:** Completes mobile feature parity
- **Effort:** 12-16 hours
- **Impact:** Enables Android-only users to discover via follows
- **Tasks:**
  1. Register deep link scheme
  2. Build UserProfileScreen composable
  3. Add follow button + logic
  4. Integrate with NotificationsScreen for request management
  5. Test follow flow end-to-end

### Phase 5: Polish & Hardening
- **Why last:** Optimization and edge cases
- **Effort:** 4-6 hours
- **Tasks:**
  1. Add notifications for URL shares (push on Android)
  2. Handle activity feed performance (pagination, caching)
  3. Add notifications for follows (push on Android)
  4. Handle private profile requests (web: show pending state)
  5. Add analytics/tracking for social actions
  6. Rate limit monitoring
  7. E2E tests for all three platforms

---

## 7. Recommendations Summary

### Immediate Actions (Next Sprint)
1. ✅ **Build URL sharing to users** — Complete (web + backend); Android/Extension pending
2. ✅ **Fix follow system** — Immediate follows, fixed followers/following list query error
3. ⏳ **Build activity feed** — High impact for user engagement and retention
4. ⏳ **Extension social features** — Unlock feature parity for 30-40% of users
5. ⏳ **Android profile navigation** — Complete mobile social discovery

### Deferred (Post-MVP)
1. Activity feed filtering/advanced
2. Social search/recommendations
3. Follow suggestions ("Who to follow")
4. User leaderboards
5. Collaborative collections (shared editing)
6. Comment threads on URLs

### Marketing Alignment
1. Update `/how-it-works` to highlight URL sharing (new feature)
2. Update `/how-it-works` to match current features OR implement promised activity feed
3. Add "Following" feed screenshots to landing page (after activity feed implementation)
4. Consider "Share URLs with friends" as a marketing angle (new feature)
5. Consider "Discover curators" as a marketing angle (existing feature, needs highlighting)

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| URL share spam | Medium | Medium | Use rate limiting (implement send limit: 50 shares/min) + report/block feature |
| Activity feed performance (large follower graphs) | Medium | Medium | Use pagination, indexed queries, cache top 50 |
| Follow spam/bot accounts | Medium | Medium | Existing rate limiting + future abuse detection |
| Private profile requests queue overflow | Low | Low | Accept/reject UI needed; monitoring in place |
| Extension complexity (popup state explosion) | Medium | Low | Refactor popup.ts state machine; consider context API |
| Android deep links not working | Low | Low | Test on multiple devices/Android versions |

---

## 9. Testing Checklist

### Web Follow System
- [ ] Follow public profile user
- [ ] Follow private profile user (becomes "Requested")
- [ ] View followers/following lists
- [ ] Unfollow user
- [ ] Cancel pending follow request
- [ ] Accept/reject follow request (via profile page)
- [ ] Follower count updates in real-time
- [ ] Rate limiting tested (30 req/min)

### Android Collections
- [ ] Create collection
- [ ] Set to public
- [ ] Share collection link (copy to clipboard)
- [ ] Make collection private
- [ ] Verify public/private toggle works in SavedScreen

### Extension
- [ ] Add URL to collection (existing)
- [ ] Create new collection (existing)
- [ ] Roam within collection (existing)
- [ ] Saved URLs persist across popup opens (existing)
- [ ] Local save-to-clipboard works (future)

### Activity Feed (When Built)
- [ ] User A follows User B
- [ ] User B submits a URL
- [ ] Activity appears on User A's `/following` feed
- [ ] Click activity → navigates to subject (URL or collection)
- [ ] Pagination loads 50 items at a time
- [ ] Filter by activity type (optional)

### URL Sharing (When Built)
- [ ] User A shares URL with User B (follower list)
- [ ] Recipient B receives push notification
- [ ] Notification text includes URL title and sender name
- [ ] Recipient can tap notification to view URL
- [ ] Duplicate shares prevented (UNIQUE constraint)
- [ ] Cannot share with self (validation)
- [ ] User search works (finding non-followers)
- [ ] Rate limiting tested (50 shares/min per user)
- [ ] Share works across all three platforms
- [ ] Recipient can save/rate received URL immediately

---

## Appendix: File Locations Reference

### Web Components
- Public profile: [web/src/app/u/[username]/page.tsx](web/src/app/u/[username]/page.tsx)
- Follow button: [web/src/app/u/[username]/FollowButton.tsx](web/src/app/u/[username]/FollowButton.tsx)
- Follow lists: [web/src/app/u/[username]/FollowSection.tsx](web/src/app/u/[username]/FollowSection.tsx)
- Own profile: [web/src/app/profile/ProfileClient.tsx](web/src/app/profile/ProfileClient.tsx)
- Collections manager: [web/src/app/profile/CollectionsManager.tsx](web/src/app/profile/CollectionsManager.tsx)
- Public collection: [web/src/app/c/[slug]/page.tsx](web/src/app/c/[slug]/page.tsx)
- Saved URLs: [web/src/app/profile/SavedUrlsManager.tsx](web/src/app/profile/SavedUrlsManager.tsx)

### Android Screens
- Profile: [android/app/src/main/java/app/roam/android/ui/screen/ProfileScreen.kt](android/app/src/main/java/app/roam/android/ui/screen/ProfileScreen.kt)
- Collections/Saved: [android/app/src/main/java/app/roam/android/ui/screen/SavedScreen.kt](android/app/src/main/java/app/roam/android/ui/screen/SavedScreen.kt)
- Notifications: [android/app/src/main/java/app/roam/android/ui/screen/NotificationsScreen.kt](android/app/src/main/java/app/roam/android/ui/screen/NotificationsScreen.kt)

### Extension Code
- Popup: [extension/src/popup/popup.ts](extension/src/popup/popup.ts)
- Background: [extension/src/background/background.ts](extension/src/background/background.ts)
- Messages: [extension/src/lib/messages.ts](extension/src/lib/messages.ts)

### Backend
- Follow function: [supabase/functions/follow/index.ts](supabase/functions/follow/index.ts)
- Profile function: [supabase/functions/profile/index.ts](supabase/functions/profile/index.ts)
- Collection function: [supabase/functions/collection/index.ts](supabase/functions/collection/index.ts)
- Share URL function (future): [supabase/functions/share-url/index.ts](supabase/functions/share-url/index.ts) (TBD)
- Migrations: [supabase/migrations/](supabase/migrations/) (search for follows, profiles, collections tables)

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|| 1.3 | 2026-07-02 | Implementation | Phase 1 complete (URL sharing backend + web UI deployed); follow system fixed (immediate follows, FK join bug resolved) || 1.2 | 2026-07-02 | Audit Update | Simplified Phase 1 to URL sharing (no messaging/inbox complexity); updated effort estimates and testing checklist |
| 1.1 | 2026-07-02 | Audit Update | Added direct URL sharing (Phase 1 priority); renumbered gaps and implementation phases |
| 1.0 | 2026-07-02 | Audit | Initial comprehensive audit; identified 4 major gaps; prioritized implementation roadmap |

---

**Next Step:** Review this audit with the team and decide on Phase 1 implementation (URL Sharing) for next sprint.
