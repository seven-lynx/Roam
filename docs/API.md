# Roam Supabase API Reference

Complete documentation of all Supabase Edge Functions and PostgreSQL RPC functions used by Roam clients.

**Last Updated:** 2026-07-29  
**Base URL:** `https://<PROJECT_ID>.supabase.co`  
**Authentication:** Bearer token in `Authorization: Bearer <JWT>` header (except public endpoints)

---

## Table of Contents

- [Edge Functions (HTTP API)](#edge-functions-http-api)
  - [`roam` — Get discovery URL](#roam--get-discovery-url)
  - [`rate` — Rate a URL](#rate--rate-a-url)
  - [`submit-url` — Submit unknown URL](#submit-url--submit-unknown-url)
  - [`profile` — Get public profile](#profile--get-public-profile)
  - [`collection` — Manage collections](#collection--manage-collections)
  - [`follow` — Manage follows](#follow--manage-follows)
  - [`save-url` — Save/unsave URLs](#save-url--saveunsave-urls)
  - [`share-url` — Share URLs with users](#share-url--share-urls-with-users)
  - [`leaderboard` — Fetch leaderboard rankings](#leaderboard--fetch-leaderboard-rankings)
  - [`feedback` — Submit feedback](#feedback--submit-feedback)
  - [`report-url` — Report broken link](#report-url--report-broken-link)
  - [`log-failed-urls` — Log failed URLs](#log-failed-urls--log-failed-urls)
  - [`report-engagement` — Report dwell time and skip status](#report-engagement--report-dwell-time-and-skip-status)
  - [`activity-feed` — Following activity feed](#activity-feed--following-activity-feed)
  - [`admin-moderation` — Admin moderation queue](#admin-moderation--admin-moderation-queue)
  - [`scrape-url` — Moderator OG scraper](#scrape-url--moderator-og-scraper)
  - [`export-user` — Export user data](#export-user--export-user-data)
  - [`delete-user` — Delete user account](#delete-user--delete-user-account)
  - [`beta-signup` — Beta waitlist signup](#beta-signup--beta-waitlist-signup)
  - [`send-bulk-email` — Send bulk emails to subscribers](#send-bulk-email--send-bulk-emails-to-subscribers)
- [RPC Functions (Database)](#rpc-functions-database)
  - [`roam()` — Weighted-random URL discovery](#roam--weighted-random-url-discovery)
  - [`admin_url_stats()` — Fetch admin dashboard statistics](#admin_url_stats--fetch-admin-dashboard-statistics)
- [Error Codes](#error-codes)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)

---

## Edge Functions (HTTP API)

All Edge Functions are accessed at: `https://<PROJECT_ID>.supabase.co/functions/v1/<function_name>`

### `roam` — Get discovery URL

Returns a single weighted-random unseen URL matching the user's category preferences and language settings. Supports batch requests for prefetching.

**Endpoint:** `POST /functions/v1/roam`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "collection_id": "uuid|null",      // Optional: filter to collection instead of categories
  "exclude_domain": "example.com",   // Optional: exclude single domain
  "exclude_domains": ["example.com"], // Optional: exclude multiple domains
  "category_id": "uuid|null",        // Optional: filter to a specific pillar category
  "subcategory_id": "uuid|null",     // Optional: filter to a specific subcategory
  "count": 1,                        // Optional: batch count (1–10, defaults to 1)
  "prefetch": false                  // Optional: when true, suppresses gamification awards
}
```

**Response (200) — Single URL (count=1):**
```json
{
  "id": "uuid",
  "url": "https://example.com/article",
  "title": "Article Title",
  "description": "Short description of the content...",
  "og_image_url": "https://example.com/image.jpg",
  "category_id": "uuid",
  "subcategory_id": "uuid",
  "wilson_score": 0.85
}
```

**Response (200) — Batch (count>1):**
```json
[
  { "id": "uuid", "url": "...", "title": "...", "wilson_score": 0.85 },
  { "id": "uuid", "url": "...", "title": "...", "wilson_score": 0.72 }
]
```

**Error Responses:**
- **401** — Unauthorized (invalid or missing token)
- **404** — No URLs available (all categories explored or language-filtered to empty pool)
- **500** — Internal server error (non-timeout RPC errors)
- **503** — Discovery timed out (RPC query exceeded 35s statement timeout)

**Notes:**
- Internally calls the `roam()` RPC function which handles seen URL tracking, language filtering, paywall filtering, domain cooldown, and scoring
- When `collection_id` is provided, category filtering is bypassed and URLs are drawn from `collection_items`
- When `count > 1`, multiple RPC calls are made and results are returned as an array; duplicate URLs within the batch are de-duplicated
- Gamification (streak update + XP award) is fire-and-forget for non-prefetch, first result only
- Response includes `Cache-Control: private, max-age=5` header

**Example (Web):**
```typescript
const response = await supabase.functions.invoke('roam', {
  body: { collection_id: null },
});
const { url, title, id } = response.data;
```

**Example (Extension):**
```typescript
const response = await supabase.functions.invoke('roam');
chrome.tabs.update(tab.id, { url: response.data.url });
```

**Example (Batch prefetch):**
```typescript
const { data } = await supabase.functions.invoke('roam', {
  body: { count: 5, prefetch: true }
});
// data is an array of 5 URLs (fewer if pool is exhausted)
```

---

### `rate` — Rate a URL

Records a user's vote (thumbs up/down) on a URL. Automatically updates the URL's Wilson score (used for ranking).

**Endpoint:** `POST /functions/v1/rate`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "url_id": "uuid",
  "value": 1 | -1  // Positive or negative
}
```

**Response (200):**
```json
{
  "success": true,
  "rating_id": "uuid",
  "url_id": "uuid"
}
```

**Error Responses:**
- **400** — Invalid `url_id` or `value` (must be ±1)
- **401** — Unauthorized
- **404** — URL not found
- **500** — Internal server error

**Notes:**
- Upserting: if the user has already rated this URL, their previous vote is replaced
- Wilson score is automatically recalculated by a database trigger (no need to call separately)
- Votes are public (visible in statistics) but linked to the user's account

**Example (Web):**
```typescript
await supabase.functions.invoke('rate', {
  body: { url_id: 'abc-123', value: 1 }
});
```

---

### `submit-url` — Submit unknown URL

Submits a new URL for moderation. Normalizes the URL, checks rate limits, runs Safe Browsing API, and adds to moderation queue.

**Endpoint:** `POST /functions/v1/submit-url`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "url": "https://example.com/article",
  "subcategory_id": "uuid",
  "language": "en|null"  // Optional, defaults to 'en'
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "URL submitted for moderation"
}
```

**Error Responses:**
- **400** — Invalid URL (not a valid HTTP/HTTPS URL after normalization)
- **401** — Unauthorized
- **422** — Safe Browsing API rejected URL as unsafe (malware, phishing, etc.)
- **429** — Rate limit exceeded (max 10 submissions per hour per user)
- **500** — Internal server error
- **503** — Safe Browsing API temporarily unavailable (network error or API service down)

**Details:**
- **URL Normalization:** HTTPS enforced, `www.` stripped, UTM/tracking params removed, fragments stripped, trailing slashes removed
- **Safe Browsing:** Google Safe Browsing API is called for all non-blocked submissions. If the URL matches a known-malicious list (MALWARE, SOCIAL_ENGINEERING, UNWANTED_SOFTWARE, POTENTIALLY_HARMFUL_APPLICATION), submission is rejected with 422
- **Rate Limiting:** Per-user rate limit of 10 submissions per 60 minutes. If exceeded, returns 429 + `Retry-After` header
- **Moderation Queue:** Submission added with `status = 'pending'`, waiting for admin review

**Example (Extension popup):**
```typescript
const response = await supabase.functions.invoke('submit-url', {
  body: {
    url: currentPageUrl,
    subcategory_id: selectedCategoryId,
    language: 'en'
  }
});

if (response.error?.status === 422) {
  // Show user: "This URL was rejected as unsafe"
} else if (response.error?.status === 503) {
  // Show user: "Safety check unavailable. Try again in a moment."
} else if (response.error?.status === 429) {
  // Show user: "You've submitted too many URLs. Try again later."
}
```

---

### `profile` — Get public profile

Fetches a user's public profile data including gamification stats, badges, and public collections. Supports both GET and POST for compatibility with web and Android clients.

**Endpoint:** `GET /functions/v1/profile?username=<username>` or `POST /functions/v1/profile` with `{ "username": "..." }`

**Authentication:** None required (public)

**Query Parameters (GET):**
- `username` (required) — The username to fetch

**Request Body (POST):**
```json
{
  "username": "alice"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "username": "alice",
  "display_name": "Alice",
  "bio": "Web explorer",
  "avatar_url": "https://...",
  "is_public": true,
  "created_at": "2026-04-01T12:00:00Z",
  "xp_total": 15420,
  "level": 12,
  "max_streak": 30,
  "badge_count": 15,
  "streak_days": 7,
  "follower_count": 42,
  "following_count": 10,
  "collections_count": 5,
  "collections": [
    {
      "id": "uuid",
      "name": "My Reading List",
      "slug": "reading-list",
      "created_at": "2026-05-01T12:00:00Z"
    }
  ],
  "badges": [
    {
      "badge_id": "uuid",
      "name": "Early Adopter",
      "description": "...",
      "icon_url": "https://...",
      "is_unlocked": true,
      "unlocked_at": "2026-04-15T12:00:00Z"
    }
  ]
}
```

**Error Responses:**
- **400** — Missing username parameter
- **404** — User not found
- **405** — Method not allowed (must be GET or POST)
- **429** — Rate limit exceeded (60 requests per minute per IP)
- **500** — Internal server error

**Notes:**
- Badges are fetched via `get_user_badges()` RPC and synced to profile `badge_count` if they drift
- Effective streak (`streak_days`) computed via `get_effective_streak()` — resets to 0 if last activity > 24 hours ago
- All counts (followers, following, collections) computed at request time via service-role client
- Private profiles are hidden from unauthenticated callers (RLS on `profiles` table)

**Example (Web):**
```typescript
const response = await fetch(
  'https://project.supabase.co/functions/v1/profile?username=alice'
);
const profile = await response.json();
```

---

### `collection` — Manage collections

Create, update, and manage collections. Handles multiple actions via the `action` parameter.

**Endpoint:** `POST /functions/v1/collection`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "action": "create" | "update" | "add_item" | "remove_item" | "list",
  "id": "uuid|null",
  "title": "My Collection",
  "description": "URLs I liked",
  "is_public": true,
  "slug": "my-collection",
  "url_id": "uuid|null"  // For add_item / remove_item
}
```

**Response (200) for each action:**

**create:**
```json
{
  "id": "uuid",
  "title": "My Collection",
  "slug": "my-collection",
  "created_at": "2026-05-01T12:00:00Z"
}
```

**update:**
```json
{
  "success": true
}
```

**add_item:**
```json
{
  "success": true,
  "item_count": 42
}
```

**remove_item:**
```json
{
  "success": true,
  "item_count": 41
}
```

**list:**
```json
{
  "collections": [
    {
      "id": "uuid",
      "title": "My Collection",
      "slug": "my-collection",
      "is_public": true,
      "item_count": 42,
      "created_at": "2026-05-01T12:00:00Z"
    }
  ]
}
```

**Error Responses:**
- **400** — Invalid input (empty title, invalid slug, etc.)
- **401** — Unauthorized
- **409** — Slug already exists (for create action)
- **413** — Collection item limit exceeded (max 10,000 items per user)
- **500** — Internal server error

**Validation:**
- **title:** 1–200 characters, required
- **slug:** 1–100 characters, lowercase alphanumeric + hyphens, must not collide with reserved routes (`join`, `admin`, `privacy`, `terms`, `u`, `c`)
- **Item limit:** Max 10,000 total items across all user's collections

**Example (Web):**
```typescript
// Create
const response = await supabase.functions.invoke('collection', {
  body: { action: 'create', title: 'My Reading List', slug: 'reading-list' }
});

// Add item
await supabase.functions.invoke('collection', {
  body: { action: 'add_item', id: collectionId, url_id: urlId }
});

// List
const collections = await supabase.functions.invoke('collection', {
  body: { action: 'list' }
});
```

---

### `follow` — Manage follows

Follow/unfollow users, send follow requests for private profiles.

**Endpoint:** `POST /functions/v1/follow`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "action": "follow" | "unfollow" | "accept_request" | "reject_request",
  "target_user_id": "uuid"
}
```

**Response (200):**
```json
{
  "success": true,
  "status": "following" | "pending" | "none"
}
```

**Error Responses:**
- **400** — Invalid action or target user
- **401** — Unauthorized
- **404** — User not found
- **409** — Already following / request already sent
- **500** — Internal server error

**Details:**
- **Public profiles:** Follow is immediate (status = 'following')
- **Private profiles:** Follow requires approval; creates a pending request (status = 'pending'); request visible only to the profile owner
- **Accept/Reject:** Only the target user can accept or reject pending requests
- Unfollowing removes the follow relationship entirely

**Example (Web):**
```typescript
await supabase.functions.invoke('follow', {
  body: { action: 'follow', target_user_id: 'abc-123' }
});
```

---

### `save-url` — Save/unsave URLs

Save a URL to a private "saved for later" list.

**Endpoint:** `POST /functions/v1/save-url`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "action": "save" | "unsave" | "list",
  "url_id": "uuid|null"
}
```

**Response (200):**

**save / unsave:**
```json
{
  "success": true
}
```

**list:**
```json
{
  "saved_urls": [
    {
      "url_id": "uuid",
      "url": "https://example.com",
      "title": "Example",
      "description": "...",
      "saved_at": "2026-05-01T12:00:00Z"
    }
  ]
}
```

**Error Responses:**
- **400** — Invalid url_id
- **401** — Unauthorized
- **404** — URL not found
- **500** — Internal server error

**Notes:**
- Saved URLs are private to the user (not visible in public profile)
- Can save URLs that haven't been rated yet (they remain in the discovery pool)

---

### `leaderboard` — Fetch leaderboard rankings

Fetches leaderboard rankings by XP for weekly, monthly, and all-time periods.

**Endpoint:** `POST /functions/v1/leaderboard`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "period": "weekly" | "monthly" | "all_time",
  "limit": 50,
  "offset": 0
}
```

**Response (200):**
```json
{
  "rankings": [
    {
      "rank": 1,
      "user_id": "uuid",
      "username": "alice",
      "display_name": "Alice",
      "avatar_url": "https://...",
      "xp": 15420,
      "level": 12,
      "badge_count": 15
    }
  ],
  "total": 256
}
```

**Error Responses:**
- **400** — Invalid period (must be one of: weekly, monthly, all_time)
- **401** — Unauthorized
- **500** — Internal server error

**Details:**
- **Weekly:** Resets every Monday at 00:00 UTC
- **Monthly:** Resets on the 1st of each month
- **All-time:** Cumulative XP since account creation
- Rankings ordered by XP descending; ties broken by account creation date (older accounts rank higher)
- The authenticated user's own rank is included even if outside the requested range

**Example (Web):**
```typescript
const { data } = await supabase.functions.invoke('leaderboard', {
  body: { period: 'weekly', limit: 20 }
});
console.log(data.rankings);
```

---

### `feedback` — Submit feedback

Submit in-app feedback or bug reports.

**Endpoint:** `POST /functions/v1/feedback`

**Authentication:** Optional (captures user_id if authenticated, anonymous if not)

**Request Body:**
```json
{
  "message": "The app crashes when I click...",
  "email": "user@example.com|null",
  "platform": "web" | "extension" | "android"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Thanks for your feedback"
}
```

**Error Responses:**
- **400** — Invalid input (empty message, invalid email)
- **429** — Rate limit exceeded (5 submissions per 10 minutes per IP)
- **500** — Internal server error

**Validation:**
- **message:** 1–2000 characters
- **email:** Optional but must be valid format if provided
- **platform:** Required, must be one of: web, extension, android

**Notes:**
- Feedback is stored in the `feedback` table
- If user is authenticated, `user_id` is captured automatically
- Useful for bug reports, feature requests, and general feedback

**Example (Extension):**
```typescript
await supabase.functions.invoke('feedback', {
  body: {
    message: 'The Roam button is slow sometimes',
    platform: 'extension'
  }
});
```

---

### `share-url` — Share URLs with users

Share a URL directly with another user (peer-to-peer). Recipient receives a push notification.

**Endpoint:** `POST /functions/v1/share-url`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "action": "share" | "list" | "recipients",
  "recipient_id": "uuid|null",    // For 'share' action
  "url_id": "uuid|null",          // For 'share' action
  "search": "string|null",        // For 'recipients' action (search by username)
  "limit": 50,                    // For 'list' and 'recipients' actions
  "offset": 0                     // For 'list' action
}
```

**Response (200):**

**share:**
```json
{
  "ok": true,
  "share_id": "uuid",
  "message": "URL shared with alice"
}
```

**list:**
```json
{
  "shared": [
    {
      "share_id": "uuid",
      "sender_id": "uuid",
      "sender_username": "bob",
      "sender_avatar_url": "https://...",
      "url_id": "uuid",
      "url_title": "Great Article",
      "url_domain": "example.com",
      "url_og_image": "https://...",
      "created_at": "2026-07-01T15:30:00Z"
    }
  ]
}
```

**recipients:**
```json
{
  "recipients": [
    {
      "user_id": "uuid",
      "username": "alice",
      "display_name": "Alice",
      "avatar_url": "https://...",
      "relationship": "follower" | "following" | "friend"
    }
  ]
}
```

**Error Responses:**
- **400** — Invalid recipient_id, url_id, or action
- **401** — Unauthorized
- **404** — Recipient or URL not found
- **409** — URL already shared with this recipient (duplicate share)
- **429** — Rate limit exceeded (50 shares per minute per user)
- **500** — Internal server error

**Details:**
- **Share validation:** Prevents sharing with self; checks recipient and URL exist
- **Duplicate prevention:** UNIQUE constraint on `(sender_id, recipient_id, url_id)` returns 409 if already shared
- **Notification:** Recipient receives a push notification: "alice shared 'Great Article'"
- **Recipients list:** Returns followers and following; ordered by relationship type, then username
- **Search:** Recipients search filters by username or display_name (case-insensitive partial match)
- **Privacy:** Sender can only see shares they sent; recipients can only see shares sent to them (RLS enforced)

**Notes:**
- Notifications are sent via `pg_notify` event listener (handled by push notification service)
- Recipient can tap notification to view URL directly
- No "inbox" or "messages" feature — just notification-driven sharing
- Recipient can then save, rate, or share the URL with others

**Example (Web):**
```typescript
// Get eligible recipients (followers + following)
const recipients = await supabase.functions.invoke('share-url', {
  body: { action: 'recipients', search: 'ali' }
});

// Share URL with selected recipient
const share = await supabase.functions.invoke('share-url', {
  body: { action: 'share', recipient_id: recipientId, url_id: currentUrlId }
});

// Show confirmation toast
if (share.data.ok) {
  toast.success(share.data.message);  // "URL shared with alice"
}
```

**Example (Android):**
```kotlin
// Get recipients (followers + following)
val recipients = supabase.functions.invoke("share-url", buildJsonObject {
    put("action", "recipients")
    put("search", searchQuery)
})

// Share URL
val share = supabase.functions.invoke("share-url", buildJsonObject {
    put("action", "share")
    put("recipient_id", selectedUser.id)
    put("url_id", currentUrlId)
})
```

**Example (Extension):**
```typescript
// Share current URL with a user from config panel
const share = await supabase.functions.invoke('share-url', {
  body: {
    action: 'share',
    recipient_id: selectedUserId,
    url_id: currentUrlId
  }
});

if (share.data.ok) {
  showNotification('URL shared with ' + selectedUsername);
}
```

---

### `report-url` — Report broken link

Marks a URL as inactive so it never surfaces in discovery again, and logs the report to the `url_reports` audit table.

**Endpoint:** `POST /functions/v1/report-url`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "url_id": "uuid"  // Required — ID of the URL to report
}
```

**Response (200):**
```json
{
  "ok": true
}
```

**Error Responses:**
- **400** — Invalid or missing `url_id` (must be a valid UUID)
- **401** — Unauthorized (unauthenticated requests rejected)
- **429** — Rate limit exceeded (20 reports per 10 minutes per user)
- **500** — Failed to update URL record

**Details:**
- Sets `urls.inactive = TRUE` on the target URL; the `roam()` function filters `AND NOT u.inactive` across all candidate branches (v10+)
- Inserts a row into `url_reports (id, user_id, url_id, reported_at)` for admin audit
- Only affects URLs where `approved = TRUE` — a safety guard against misuse on unreviewed submissions
- The INSERT into `url_reports` is best-effort: if it fails, the URL is still marked inactive and 200 is returned
- Rate limited per `user_id`, not IP, to prevent abuse via proxy rotation

**Example (Extension):**
```typescript
// After receiving url_id from CHECK_URL, report and skip to next URL
const res = await sendToBackground({ type: 'REPORT_URL', url_id: check.data.url_id });
if (res.ok) {
  const next = await sendToBackground({ type: 'ROAM' });
  chrome.tabs.update(tab.id, { url: next.data.url });
}
```

**Example (Android):**
```kotlin
supabase.functions.invoke("report-url", buildJsonObject {
    put("url_id", currentUrlId)
})
// Then call roam() to skip to the next URL
```

---

### `log-failed-urls` — Log failed URLs

Extension/app internal endpoint: batch log failed URLs for moderation review.

**Endpoint:** `POST /functions/v1/log-failed-urls`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "failed_urls": [
    {
      "url": "https://example.com/404",
      "failure_reason": "HTTP 404",
      "retry_count": 3,
      "timestamp": "2026-05-01T12:00:00Z"
    }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "inserted_count": 5
}
```

**Error Responses:**
- **400** — Invalid input
- **401** — Unauthorized
- **500** — Internal server error

**Notes:**
- Inserts failed URLs into `moderation_queue` with `status = 'auto_flagged'`
- Admin can review and determine if URLs should be hidden or removed
- Helps identify broken/slow pages in the content pool

---

### `report-engagement` — Report dwell time and skip status

Reports how long the user dwelled on a served URL and whether they skipped it. Called before requesting the next Roam. Idempotent — last write wins.

**Endpoint:** `POST /functions/v1/report-engagement`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "url_id": "uuid",
  "dwell_ms": 4500,
  "skipped": false
}
```

**Response (200):**
```json
{
  "ok": true
}
```

**Error Responses:**
- **400** — Invalid input (missing url_id, negative dwell_ms, or missing skipped)
- **401** — Unauthorized
- **405** — Method not allowed (must be POST)
- **500** — Internal server error

**Details:**
- Updates the `seen_urls` row (created by the `roam()` RPC) with `dwell_ms` and `skipped` status
- The `seen_urls` row must already exist — this function does not create it
- Idempotent: multiple calls for the same `(user, url)` are safe, last write wins
- Typical client logic: `dwell = now - pageLoadTimestamp`, `skipped = dwell < 3000ms`

**Example (Web):**
```typescript
const dwellMs = Date.now() - pageLoadTime;
await supabase.functions.invoke('report-engagement', {
  body: {
    url_id: currentUrlId,
    dwell_ms: dwellMs,
    skipped: dwellMs < 3000
  }
});
```

---

### `activity-feed` — Following activity feed

Returns paged activity from users the authenticated user follows (public profiles only).

**Endpoint:** `GET /functions/v1/activity-feed?limit=50&offset=0&before=2026-07-01T00:00:00Z`

**Authentication:** Required (Bearer token)

**Query Parameters:**
- `limit` — Max items (default 50, capped at 100)
- `offset` — Pagination offset (default 0)
- `before` — ISO timestamp; returns activities before this time (for cursor-based pagination)

**Response (200):**
```json
{
  "activities": [
    {
      "user_id": "uuid",
      "username": "alice",
      "display_name": "Alice",
      "avatar_url": "https://...",
      "activity_type": "rated" | "saved" | "shared" | "created_collection" | "followed",
      "url_id": "uuid|null",
      "url_title": "Article Title|null",
      "collection_name": "My Collection|null",
      "created_at": "2026-07-01T15:30:00Z"
    }
  ],
  "has_more": true
}
```

**Error Responses:**
- **401** — Unauthorized
- **500** — Internal server error

**Details:**
- Backed by the `get_activity_feed()` RPC function
- Shows public activities from followed users who have public profiles
- Activity types: rated, saved, shared, created_collection, followed
- Uses `pg_notify` for real-time delivery; this endpoint provides historical feed

**Example (Web):**
```typescript
const { data } = await supabase.functions.invoke('activity-feed', {
  body: { limit: 20 }
});
// Or via fetch GET:
const res = await fetch(`${SUPABASE_URL}/functions/v1/activity-feed?limit=20`, {
  headers: { Authorization: `Bearer ${token}` }
});
const { activities, has_more } = await res.json();
```

---

### `admin-moderation` — Admin moderation queue

Admin/moderator endpoint for managing the URL moderation queue, URL reports, and stats.

**Endpoint:** `POST /functions/v1/admin-moderation`

**Authentication:** Required (Bearer token with `admin` or `moderator` role)

**Request Body:**
```json
{
  "action": "list" | "approve" | "reject" | "stats" | "reports" | "restore",
  "id": "uuid|null",        // For approve / reject (moderation_queue.id)
  "url_id": "uuid|null"     // For restore (sets urls.inactive = false)
}
```

**Response (200) for each action:**

**list:**
```json
{
  "items": [
    {
      "id": "uuid",
      "url": "https://example.com",
      "submitter_username": "bob",
      "status": "pending",
      "subcategory_label": "Science",
      "created_at": "2026-07-01T12:00:00Z"
    }
  ]
}
```

**approve / reject:**
```json
{ "ok": true }
```

**stats:**
```json
{
  "pending": 42,
  "approved": 1500,
  "rejected": 230,
  "reports": 15
}
```

**reports:**
```json
{
  "reports": [
    {
      "url_id": "uuid",
      "url": "https://broken.example.com",
      "report_count": 3,
      "latest_report_at": "2026-07-15T10:00:00Z"
    }
  ]
}
```

**restore:**
```json
{ "ok": true }
```

**Error Responses:**
- **400** — Invalid action or missing required parameters
- **401** — Unauthorized (invalid or missing token)
- **403** — Forbidden (user is not admin or moderator)
- **405** — Method not allowed (must be POST)
- **500** — Internal server error

**Details:**
- `list` — Returns moderation queue entries with submitter profile and subcategory info
- `approve` — Updates moderation_queue status to 'approved', upserts URL into `urls` table
- `reject` — Updates moderation_queue status to 'rejected'
- `stats` — Returns aggregate counts: pending, approved, rejected, reports
- `reports` — Returns `url_reports` grouped by URL with report counts
- `restore` — Sets `urls.inactive = false` (reactivates a reported URL)
- Uses service-role key for RLS-bypassing write operations

**Example (Web admin):**
```typescript
// List pending
const { data } = await supabase.functions.invoke('admin-moderation', {
  body: { action: 'list' }
});

// Approve
await supabase.functions.invoke('admin-moderation', {
  body: { action: 'approve', id: pendingItemId }
});
```

---

### `scrape-url` — Moderator OG scraper

Moderator-only endpoint. Fetches OG metadata for a URL and inserts it directly into the `urls` table with `approved=true`, bypassing the moderation queue.

**Endpoint:** `POST /functions/v1/scrape-url`

**Authentication:** Required (Bearer token with `admin` or `moderator` role)

**Request Body:**
```json
{
  "url": "https://example.com/article",
  "category_ids": ["uuid", "uuid"],   // Up to 2 pillar UUIDs (first is primary for roam() compat)
  "subcategory_id": "uuid",           // Primary subcategory UUID (for roam() compat)
  "tags": ["science", "biology"]       // Freeform semantic tags, normalized to slug form
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "url": "https://example.com/article",
  "title": "Article Title",
  "description": "Short description...",
  "og_image_url": "https://example.com/image.jpg",
  "language": "en",
  "tags": ["science", "biology"],
  "category_ids": ["uuid", "uuid"]
}
```

**Error Responses:**
- **400** — Invalid URL or missing required fields
- **401** — Unauthorized
- **403** — Forbidden (user is not admin or moderator)
- **422** — Safe Browsing API rejected URL as unsafe
- **500** — Failed to fetch OG metadata or insert URL
- **503** — Safe Browsing API temporarily unavailable

**Details:**
- Fetches the target URL with a 10s timeout and extracts OG metadata (`og:title`, `og:description`, `og:image`, `language`, canonical URL)
- Normalizes the URL via the shared `normalizeUrl()` utility
- Checks Safe Browsing API before inserting
- Tags are normalized to lowercase hyphenated slugs (e.g., "Machine Learning" → "machine-learning")
- Inserts directly into `urls` with `approved=true`, bypassing the moderation queue entirely
- Used by seeders and manual content curation workflows

**Example (Seeder script):**
```typescript
const res = await supabase.functions.invoke('scrape-url', {
  body: {
    url: 'https://example.com/cool-article',
    category_ids: [scienceCategoryId, techCategoryId],
    subcategory_id: physicsSubcategoryId,
    tags: ['physics', 'quantum-computing']
  }
});
```

---

### `export-user` — Export user data

Exports all user data as a JSON file for GDPR compliance. Returns a download link.

**Endpoint:** `GET /functions/v1/export-user`

**Authentication:** Required (Bearer token)

**Response (200):**
```json
{
  "ok": true,
  "download_url": "https://...",
  "expires_in_hours": 24
}
```

**Error Responses:**
- **401** — Unauthorized (invalid or missing token)
- **429** — Rate limit exceeded (1 export per 24 hours per user)
- **500** — Internal server error

**Details:**
- Generates a complete export of user profile, categories, ratings, collections, follows, and submission history
- Exports as a timestamped JSON file (e.g., `roam-export-2026-05-31.json`)
- Download link is valid for 24 hours
- Rate limited to 1 export per 24 hours to prevent abuse
- No PII like passwords or tokens is included in the export

**Example (Web):**
```typescript
const response = await supabase.functions.invoke('export-user');
if (response.data.ok) {
  window.location.href = response.data.download_url;
}
```

---

### `delete-user` — Delete user account

Permanently deletes the authenticated user and all associated data (GDPR right to be forgotten).

**Endpoint:** `POST /functions/v1/delete-user`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "confirm": true  // Required confirmation to prevent accidental deletion
}
```

**Response (200):**
```json
{
  "ok": true,
  "message": "Account deleted. You will be signed out."
}
```

**Error Responses:**
- **400** — Missing or false `confirm` field
- **401** — Unauthorized (invalid or missing token)
- **500** — Internal server error

**Details:**
- Deletes the user from `auth.users` (Supabase Auth)
- Cascades delete all related records: profiles, ratings, collections, follows, submissions, saved URLs
- This is irreversible and cannot be undone
- User is immediately signed out after deletion
- All public data (collections, posts) become orphaned but are retained for data integrity

**Example (Web):**
```typescript
if (confirm('Are you sure? This cannot be undone.')) {
  const response = await supabase.functions.invoke('delete-user', {
    body: { confirm: true }
  });
  if (response.data.ok) {
    // Browser will auto-sign-out; redirect to landing page
    window.location.href = '/';
  }
}
```

---

### `beta-signup` — Beta waitlist signup

(Public endpoint) Adds an email to the beta waitlist.

**Endpoint:** `POST /functions/v1/beta-signup`

**Authentication:** None required (public)

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "ok": true
}
```

**Error Responses:**
- **400** — Invalid email format
- **409** — Email already registered on the waitlist
- **500** — Internal server error

**Details:**
- Email is stored in the `beta_signups` table
- No confirmation email is sent at signup time (handled separately via `send-bulk-email`)

---

### `send-bulk-email` — Send bulk emails to subscribers

Admin-only endpoint for sending bulk emails to beta signup subscribers.

**Endpoint:** `POST /functions/v1/send-bulk-email`

**Authentication:** Required (Bearer token with admin role)

**Request Body:**
```json
{
  "subject": "Roam Update",
  "body_html": "<p>Hello from Roam!</p>"
}
```

**Response (200):**
```json
{
  "ok": true,
  "sent_count": 150
}
```

**Error Responses:**
- **400** — Missing subject or body_html
- **401** — Unauthorized
- **403** — Forbidden (not admin)
- **500** — Internal server error

---

## RPC Functions (Database)

Called via `supabase.rpc()`, not HTTP. These are PostgreSQL functions that run server-side.

### `roam()` — Weighted-random URL discovery

Primary RPC function for URL discovery. Selects a weighted-random URL from the user's categories, excludes seen URLs, handles language filtering and paywall filtering. **Current version: v29.**

**Call Signature:**
```sql
SELECT * FROM roam(
  p_user_id uuid,
  p_collection_id uuid DEFAULT NULL,
  p_exclude_domain text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_subcategory_id uuid DEFAULT NULL,
  p_exclude_domains text[] DEFAULT NULL
)
```

**Parameters:**
- `p_user_id` — User ID (required)
- `p_collection_id` — Collection ID (optional; if provided, ignores category preferences)
- `p_exclude_domain` — Single domain to exclude (legacy; prefer `p_exclude_domains`)
- `p_category_id` — Filter to a specific pillar category (optional)
- `p_subcategory_id` — Filter to a specific subcategory (optional)
- `p_exclude_domains` — Array of domains to exclude (optional; merged with `p_exclude_domain` if both provided)

**Returns (single row):**
```
id, url, title, description, og_image_url, category_id, subcategory_id, wilson_score
```

**Scoring Algorithm (v29):**
- **Candidate pool:** `TABLESAMPLE BERNOULLI(5)` — samples 5% of eligible URLs for a larger and more diverse candidate set
- **Domain cooldown:** 24 hours (prevents domain fatigue — the same domain won't surface again within a day)
- **Seen URL window:** 10,000 most recent seen URLs (prevents power-user cliff at 2,000)
- **Score weighting:** 70% Wilson score / 30% random (signal matters more than pure randomness)
- **Exploration bonus:** Low-serve-count URLs get an extra boost to surface underexplored content
- **Serendipity mode:** 5% chance to pick from a subcategory the user has never visited
- **Subcategory rotation:** 25% chance of adjacent subcategory (same pillar, different subcategory)
- **Recency decay:** Very gentle (-0.0003) — evergreen content stays competitive
- **Language filtering:** Filters `urls` where language matches `user_settings.preferred_languages`; defaults to `['en']`
- **Paywall filtering:** If `user_settings.skip_paywalled = true`, excludes domains from `paywalled_domains` table
- **Seen URL exclusion:** Skips URLs in the user's `seen_urls` table
- **Empty pool:** Returns NULL row if no URLs match the filters

**Implementation note:** Runs as `SECURITY DEFINER` (elevated privileges) with `statement_timeout = '35s'`. The Edge Function handles timeout gracefully and returns 503.

---

### `admin_url_stats()` — Fetch admin dashboard statistics

Efficiently fetches aggregated dashboard statistics for the admin panel without timing out on the large `urls` table.

**Call Signature:**
```sql
SELECT * FROM admin_url_stats(since_date timestamp = NULL)
```

**Parameters:**
- `since_date` — Optional; defaults to 7 days ago. Filters "new this week" statistics.

**Returns (single row):**
```
total_urls bigint,           -- Total approved, active URLs
active_urls bigint,          -- Approved URLs with at least 1 vote
dead_urls bigint,            -- URLs marked inactive
new_urls_week bigint,        -- URLs added since since_date
total_serves bigint,         -- Total serve_count across all URLs
avg_wilson_score numeric,    -- Average Wilson score (rated URLs only)
rated_urls bigint,           -- URLs with at least 1 vote
unrated_urls bigint,         -- URLs with zero votes
new_ratings_week bigint,     -- Ratings added since since_date
active_users_week bigint     -- Unique users who rated URLs since since_date
```

**Details:**
- **Performance:** Uses 4 separate subqueries with per-function `statement_timeout = '30s'` to avoid timeout on large scans
- **Indexes:** Backed by 3 partial/BRIN indexes on `urls(serve_count, wilson_score, active_date)` where `approved=true AND inactive=false`
- **Caching:** Results cached client-side via Next.js `unstable_cache` with 5-minute TTL
- **Freshness:** Dashboard provides manual Refresh button to clear cache and fetch latest stats
- **Admin-only:** Only callable by users with `role = 'admin'` (enforced by RLS policy)

**Implementation note:** Uses `SECURITY DEFINER` to bypass RLS for efficient aggregation; RLS enforced at function call site.

**Example (Web admin page):**
```typescript
const stats = await supabase.rpc('admin_url_stats', {
  since_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
});

console.log(`Total URLs: ${stats.data.total_urls}`);
console.log(`Dead URLs: ${stats.data.dead_urls}`);
console.log(`Avg Wilson: ${stats.data.avg_wilson_score.toFixed(3)}`);
console.log(`Active users (7d): ${stats.data.active_users_week}`);
```

---

## Error Codes

| Code | Meaning | Recovery |
|------|---------|----------|
| **400** | Bad request (invalid input) | Check request schema, fix typos, validate JSON |
| **401** | Unauthorized (missing/invalid token) | Refresh auth, re-authenticate user |
| **403** | Forbidden (permission denied) | User lacks required permissions (e.g., not admin/moderator) |
| **404** | Not found (user, URL, or empty pool) | Verify IDs exist; if empty pool, ask user to add categories |
| **405** | Method not allowed | Check HTTP method (e.g., GET vs POST requirements) |
| **409** | Conflict (slug collision, already following, duplicate share) | Choose different slug, unfollow first, or check for duplicates |
| **413** | Payload too large (collection item limit) | Remove items from collection before adding more |
| **422** | Unprocessable content (Safe Browsing rejection) | URL flagged as unsafe; don't resubmit |
| **429** | Too many requests (rate limit exceeded) | Wait + retry (see Retry-After header) |
| **500** | Internal server error | Retry after 1–5 seconds; if persists, contact support |
| **503** | Service unavailable (Safe Browsing API down or query timeout) | Temporarily unavailable; retry later |

---

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `roam` | 60 | 1 minute (per authenticated user) |
| `rate` | 100 | 1 minute (per authenticated user) |
| `submit-url` | 10 | 1 hour (per authenticated user) |
| `profile` | 60 | 1 minute (per IP address) |
| `collection` | 50 | 1 minute (per authenticated user) |
| `follow` | 30 | 1 minute (per authenticated user) |
| `save-url` | 50 | 1 minute (per authenticated user) |
| `share-url` | 50 | 1 minute (per authenticated user) |
| `leaderboard` | 30 | 1 minute (per authenticated user) |
| `feedback` | 5 | 10 minutes (per IP address) |
| `report-url` | 20 | 10 minutes (per authenticated user) |
| `report-engagement` | 60 | 1 minute (per authenticated user) |
| `activity-feed` | 30 | 1 minute (per authenticated user) |
| `admin-moderation` | 60 | 1 minute (per authenticated user) |
| `scrape-url` | 30 | 1 minute (per authenticated user) |
| `export-user` | 1 | 24 hours (per authenticated user) |

**Rate limit headers:** Response includes `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `Retry-After` headers.

---

## Examples

### Complete Sign-up + Discovery Flow

**Web/Extension:**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(URL, ANON_KEY);

// 1. Sign up
await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password'
});

// 2. After email verification, select categories
await supabase
  .from('user_categories')
  .insert([
    { user_id: user.id, category_id: SCIENCE_ID },
    { user_id: user.id, category_id: TECH_ID }
  ]);

// 3. Get a discovery URL
const response = await supabase.functions.invoke('roam');
const { url, id } = response.data;

// 4. Load URL, report engagement before next roam
const pageLoadTime = Date.now();
window.open(url);
// (after user dwells)
const dwellMs = Date.now() - pageLoadTime;
await supabase.functions.invoke('report-engagement', {
  body: { url_id: id, dwell_ms: dwellMs, skipped: dwellMs < 3000 }
});

// 5. Rate it
await supabase.functions.invoke('rate', {
  body: { url_id: id, value: 1 }
});

// 6. Next roam
const nextResponse = await supabase.functions.invoke('roam');
```

**Android:**
```kotlin
// Using Supabase Kotlin client
val response = supabase.functions.invoke("roam")
val roamUrl = response.decodeTo<RoamUrl>()
webView.loadUrl(roamUrl.url)

// Rate the URL
supabase.functions.invoke("rate", Json {
  put("url_id", roamUrl.id)
  put("value", 1)
})
```

### Submit Unknown URL

**Extension popup:**
```typescript
const response = await supabase.functions.invoke('submit-url', {
  body: {
    url: document.location.href,
    subcategory_id: selectedCategory.id,
    language: navigator.language.slice(0, 2) // e.g., 'en', 'fr'
  }
});

if (response.error) {
  if (response.error.status === 422) {
    showToast('This URL was blocked as unsafe. Please choose a different one.');
  } else if (response.error.status === 429) {
    showToast('You\'ve submitted too many URLs today. Try again tomorrow.');
  } else {
    showToast('Error submitting URL. Please try again.');
  }
} else {
  showToast('Thanks! Your submission is under review.');
}
```

---

## Deployment Checklist

Before deploying to production:

- [ ] All env vars set (`SAFE_BROWSING_API_KEY`, etc.)
- [ ] Rate limiting configured per endpoint
- [ ] Sentry DSN configured for error tracking
- [ ] RLS policies enforced on all tables
- [ ] Backups enabled (Supabase Pro: daily point-in-time)
- [ ] Monitoring alerts set up (errors, rate limit spikes)

---

**Questions?** See the main [README.md](../README.md) or open an issue on GitHub.