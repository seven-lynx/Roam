# Roam Supabase API Reference

Complete documentation of all Supabase Edge Functions and PostgreSQL RPC functions used by Roam clients.

**Last Updated:** 2026-05-02  
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
  - [`feedback` — Submit feedback](#feedback--submit-feedback)
  - [`report-url` — Report broken link](#report-url--report-broken-link)
  - [`log-failed-urls` — Log failed URLs](#log-failed-urls--log-failed-urls)
- [RPC Functions (Database)](#rpc-functions-database)
  - [`roam()` — Weighted-random URL discovery](#roam--weighted-random-url-discovery)
- [Error Codes](#error-codes)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)

---

## Edge Functions (HTTP API)

All Edge Functions are accessed at: `https://<PROJECT_ID>.supabase.co/functions/v1/<function_name>`

### `roam` — Get discovery URL

Returns a single weighted-random unseen URL matching the user's category preferences and language settings.

**Endpoint:** `POST /functions/v1/roam`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "collection_id": "uuid|null",  // Optional: filter to collection instead of categories
}
```

**Response (200):**
```json
{
  "url": "https://example.com/article",
  "url_id": "uuid",
  "title": "Article Title",
  "description": "Short description of the content...",
  "og_image_url": "https://example.com/image.jpg",
  "category_id": "uuid",
  "subcategory_id": "uuid",
  "subcategory_label": "Science",
  "source": "wikipedia",
  "language": "en"
}
```

**Error Responses:**
- **401** — Unauthorized (invalid or missing token)
- **404** — No URLs available (all categories explored or language-filtered to empty pool)
- **500** — Internal server error

**Notes:**
- Automatically marks the returned URL as "seen" in `seen_urls` table (cannot be served twice to same user)
- Respects `user_settings.preferred_languages` — filters results to selected languages
- Respects `user_settings.skip_paywalled` — excludes domains in `paywalled_domains` table if true
- When `collection_id` is provided, category filtering is bypassed and URLs are drawn from `collection_items`
- Returns 404 if user has no categories selected or no URLs match their filters

**Example (Web):**
```typescript
const response = await supabase.functions.invoke('roam', {
  body: { collection_id: null },
});
const { url, title, url_id } = response.data;
```

**Example (Extension):**
```typescript
const response = await supabase.functions.invoke('roam');
chrome.tabs.update(tab.id, { url: response.data.url });
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
- **Safe Browsing:** Google Safe Browsing API is called for all non-blocked submissions. If the URL matches a known-malicious list (MALWARE, SOCIAL_ENGINEERING, UNWANTED_SOFTWARE, POTENTIALLY_HARMFUL_APPLICATION), submission is rejected with 403
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

Fetches a user's public profile data. Unauthenticated endpoint.

**Endpoint:** `GET /functions/v1/profile?username=<username>`

**Authentication:** None required (public)

**Query Parameters:**
- `username` (required) — The username to fetch

**Response (200):**
```json
{
  "user_id": "uuid",
  "username": "alice",
  "display_name": "Alice",
  "bio": "Web explorer",
  "avatar_url": "https://...",
  "is_public": true,
  "follower_count": 42,
  "following_count": 10,
  "collections_count": 5,
  "created_at": "2026-04-01T12:00:00Z"
}
```

**Error Responses:**
- **404** — User not found
- **429** — Rate limit exceeded (60 requests per minute per IP)
- **500** — Internal server error

**Notes:**
- Rate limited to prevent username enumeration attacks
- Returns `follower_count` and `following_count` (computed at request time, not stored)
- Returns an empty profile for private users, without exposing collections or follower data

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
  "url_id": "uuid|null",  // For add_item / remove_item
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

## RPC Functions (Database)

Called via `supabase.rpc()`, not HTTP. These are PostgreSQL functions that run server-side.

### `roam()` — Weighted-random URL discovery

Primary RPC function for URL discovery. Called internally by the `roam` Edge Function. Selects a weighted-random URL from the user's categories, excludes seen URLs, handles language filtering and paywall filtering.

**Call Signature:**
```sql
SELECT * FROM roam(
  p_user_id uuid,
  p_collection_id uuid = NULL
)
```

**Parameters:**
- `p_user_id` — User ID (required)
- `p_collection_id` — Collection ID (optional; if provided, ignores category preferences)

**Returns (single row):**
```
url_id, url, title, description, og_image_url, category_id, subcategory_id, 
subcategory_label, source, language
```

**Details:**
- **Category filtering:** Reads `user_categories` table to find selected categories, then queries `urls` where category matches
- **Language filtering:** Reads `user_settings.preferred_languages`, filters `urls` where language = ANY(preferred_languages); defaults to `['en']` if not set
- **Paywall filtering:** If `user_settings.skip_paywalled = true`, excludes URLs from `paywalled_domains` table
- **Seen URL exclusion:** Skips URLs in the user's `seen_urls` table from the last 30 days
- **Weighted random:** Uses `(wilson_score + 0.1) * random()` to weight results by community rating while ensuring zero-rated URLs aren't buried
- **Seen write:** Automatically inserts a `seen_urls` row for the returned URL before returning, preventing duplicate serves
- **Empty pool:** Returns NULL row if no URLs match the filters

**Implementation note:** Runs as `SECURITY DEFINER` (elevated privileges) to insert `seen_urls` rows automatically.

---

## Error Codes

| Code | Meaning | Recovery |
|------|---------|----------|
| **400** | Bad request (invalid input) | Check request schema, fix typos, validate JSON |
| **401** | Unauthorized (missing/invalid token) | Refresh auth, re-authenticate user |
| **403** | Forbidden (Safe Browsing rejection, permission denied) | URL is unsafe; don't resubmit; or user lacks permission |
| **404** | Not found (user, URL, or empty pool) | Verify IDs exist; if empty pool, ask user to add categories |
| **409** | Conflict (slug collision, already following) | Choose different slug or unfollow first |
| **413** | Payload too large (collection item limit) | Remove items from collection before adding more |
| **429** | Too many requests (rate limit exceeded) | Wait + retry (see Retry-After header) |
| **500** | Internal server error | Retry after 1–5 seconds; if persists, contact support |
| **503** | Service unavailable (Safe Browsing API down) | Temporarily unavailable; retry later |

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
| `feedback` | 5 | 10 minutes (per IP address) |
| `report-url` | 20 | 10 minutes (per authenticated user) |

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
const { url, url_id } = response.data;

// 4. Load URL and rate it
window.open(url);
// (after user rates)
await supabase.functions.invoke('rate', {
  body: { url_id, value: 1 }
});

// 5. Next roam
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
  put("url_id", roamUrl.url_id)
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
  if (response.error.status === 403) {
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
