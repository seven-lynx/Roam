# Roam Supabase Backend

PostgreSQL database with Deno Edge Functions powering the Roam discovery engine. Handles authentication, data storage, rate limiting, content moderation, and discovery queries.

## Overview

The Supabase backend is split into two layers:

1. **PostgreSQL Database** — Relational schema for users, URLs, ratings, collections, etc.
2. **Deno Edge Functions** — Serverless functions for business logic, validation, and API endpoints

All data access is protected by Row-Level Security (RLS) policies ensuring users can only access their own data.

## Database Schema

### Core Tables

#### `auth.users`
Managed by Supabase Auth. Contains user accounts created via email/password or OAuth.

```sql
id UUID PRIMARY KEY
email TEXT UNIQUE NOT NULL
created_at TIMESTAMP DEFAULT NOW()
updated_at TIMESTAMP DEFAULT NOW()
```

#### `profiles`
User profile information and settings.

```sql
id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
username TEXT UNIQUE NOT NULL  -- Displayed in public profiles
display_name TEXT              -- Full name
avatar_url TEXT                -- Profile picture
bio TEXT                        -- User bio
interests TEXT[]               -- Array of interest category IDs
language_preference TEXT DEFAULT 'en'
adult_content_allowed BOOLEAN DEFAULT FALSE  -- Can see NSFW
created_at TIMESTAMP DEFAULT NOW()
updated_at TIMESTAMP DEFAULT NOW()
```

#### `urls`
The main content pool — URLs with metadata.

```sql
id UUID PRIMARY KEY
original_url TEXT UNIQUE NOT NULL  -- Normalized for deduplication
normalized_url TEXT NOT NULL       -- Consistent format
title TEXT
description TEXT
category TEXT                     -- Primary category (e.g., 'Tech', 'Science')
source TEXT                        -- Where URL came from (seeder name)
safe_browsing_status TEXT         -- 'safe', 'unsafe', 'unchecked', null
safe_browsing_result JSON         -- Full Safe Browsing API response
created_at TIMESTAMP DEFAULT NOW()
updated_at TIMESTAMP DEFAULT NOW()
```

#### `ratings`
User votes on URLs (thumbs up/down).

```sql
id UUID PRIMARY KEY
user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
url_id UUID NOT NULL REFERENCES urls(id) ON DELETE CASCADE
rating INTEGER NOT NULL          -- 1 (up) or -1 (down)
created_at TIMESTAMP DEFAULT NOW()
updated_at TIMESTAMP DEFAULT NOW()
UNIQUE(user_id, url_id)           -- One rating per user per URL
```

#### `moderation_queue`
URLs pending admin review.

```sql
id UUID PRIMARY KEY
original_url TEXT NOT NULL
title TEXT
description TEXT
category TEXT
submitter_id UUID REFERENCES auth.users(id)  -- Who submitted
status TEXT DEFAULT 'pending'  -- 'pending', 'approved', 'rejected'
reviewer_id UUID REFERENCES auth.users(id)   -- Admin who reviewed
reviewer_notes TEXT             -- Reason for rejection
safe_browsing_result JSON       -- Safe Browsing check result
created_at TIMESTAMP DEFAULT NOW()
updated_at TIMESTAMP DEFAULT NOW()
```

#### `collections`
User-created collections of URLs.

```sql
id UUID PRIMARY KEY
user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
name TEXT NOT NULL
description TEXT
is_public BOOLEAN DEFAULT FALSE  -- Public or private collection
created_at TIMESTAMP DEFAULT NOW()
updated_at TIMESTAMP DEFAULT NOW()
```

#### `collection_items`
URLs saved in collections.

```sql
id UUID PRIMARY KEY
collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE
url_id UUID NOT NULL REFERENCES urls(id) ON DELETE CASCADE
added_at TIMESTAMP DEFAULT NOW()
UNIQUE(collection_id, url_id)
```

#### `follows`
Social graph — users following other users.

```sql
id UUID PRIMARY KEY
follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
created_at TIMESTAMP DEFAULT NOW()
UNIQUE(follower_id, following_id)
CHECK(follower_id != following_id)
```

### Supporting Tables

#### `categories`
Master list of discovery categories.

```sql
id UUID PRIMARY KEY
name TEXT UNIQUE NOT NULL  -- e.g., 'Arts', 'Science', 'Technology'
slug TEXT UNIQUE NOT NULL  -- URL-safe name
description TEXT
color TEXT                  -- For UI display (hex color)
created_at TIMESTAMP DEFAULT NOW()
```

#### `muted_domains`
Domains muted by users (expires after 30 days).

```sql
id UUID PRIMARY KEY
user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
domain TEXT NOT NULL        -- Domain to mute
muted_at TIMESTAMP DEFAULT NOW()
expires_at TIMESTAMP        -- Auto-expires after 30 days
UNIQUE(user_id, domain)
```

## Edge Functions

All Edge Functions are deployed to Supabase and invoked via HTTP or internal calls.

### roam/index.ts
**Purpose:** Get a random URL for user to discover.

**Endpoint:** `POST /functions/v1/roam`

**Request:**
```json
{
  "category": "Tech",     // Optional filter
  "language": "en"        // Optional filter
}
```

**Response:**
```json
{
  "id": "uuid",
  "title": "Amazing Article",
  "original_url": "https://...",
  "category": "Tech",
  "description": "A brief description..."
}
```

**Authentication:** Optional (anonymous users get random, authenticated users get filtered by interests)

---

### rate/index.ts
**Purpose:** Submit user rating for a URL (thumbs up/down).

**Endpoint:** `POST /functions/v1/rate`

**Request:**
```json
{
  "url_id": "uuid",
  "rating": 1  // 1 for up, -1 for down
}
```

**Response:**
```json
{
  "success": true,
  "rating_id": "uuid"
}
```

**Authentication:** Required (user ID from JWT)

---

### submit-url/index.ts
**Purpose:** Submit new URL for discovery pool.

**Endpoint:** `POST /functions/v1/submit-url`

**Request:**
```json
{
  "url": "https://example.com/article",
  "title": "Article Title",           // Optional
  "description": "What it's about",   // Optional
  "category": "Tech"                  // Optional
}
```

**Response:**
```json
{
  "success": true,
  "submission_id": "uuid",
  "status": "pending"
}
```

**Status Codes:**
- **200** — Submitted successfully, queued for moderation
- **400** — Invalid URL or missing required field
- **401** — Unauthorized (user must be authenticated)
- **422** — URL rejected by Safe Browsing API (malicious)
- **429** — Rate limit exceeded (max 10 submissions per hour)
- **503** — Safe Browsing API unavailable

**Authentication:** Required

---

### profile/index.ts
**Purpose:** Get or update user profile.

**Endpoint:** `GET /functions/v1/profile?user_id=uuid` or `POST /functions/v1/profile`

**Request (POST):**
```json
{
  "display_name": "John Doe",
  "bio": "Tech enthusiast",
  "interests": ["Tech", "Science"],
  "avatar_url": "https://..."
}
```

**Response:**
```json
{
  "id": "uuid",
  "username": "john_doe",
  "display_name": "John Doe",
  "bio": "Tech enthusiast",
  "avatar_url": "https://...",
  "interests": ["Tech", "Science"],
  "created_at": "2026-01-01T00:00:00Z"
}
```

**Authentication:** Required for POST (user can only update own profile)

---

### collection/index.ts
**Purpose:** Create, read, update collections.

**Endpoints:**
- `POST /functions/v1/collection` — Create
- `GET /functions/v1/collection?id=uuid` — Read
- `PUT /functions/v1/collection` — Update
- `DELETE /functions/v1/collection?id=uuid` — Delete

**Authentication:** Required

---

### follow/index.ts
**Purpose:** Follow/unfollow users.

**Endpoint:** `POST /functions/v1/follow`

**Request:**
```json
{
  "user_id": "uuid",
  "action": "follow"  // or "unfollow"
}
```

**Response:**
```json
{
  "success": true,
  "following": true
}
```

**Authentication:** Required

---

### save-url/index.ts
**Purpose:** Save URL to a collection.

**Endpoint:** `POST /functions/v1/save-url`

**Request:**
```json
{
  "url_id": "uuid",
  "collection_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "added_to_collection": true
}
```

**Authentication:** Required

---

### feedback/index.ts
**Purpose:** Submit user feedback/bug reports.

**Endpoint:** `POST /functions/v1/feedback`

**Request:**
```json
{
  "message": "Bug: roam button doesn't work",
  "type": "bug",          // or "feature", "feedback"
  "url": "https://..."    // Current page URL
}
```

**Response:**
```json
{
  "success": true,
  "feedback_id": "uuid"
}
```

**Authentication:** Optional (anonymous feedback allowed)

---

### log-failed-urls/index.ts
**Purpose:** Log URLs that failed Safe Browsing check.

**Endpoint:** `POST /functions/v1/log-failed-urls`

**Request:**
```json
{
  "urls": [
    {
      "url": "https://malicious.com",
      "threat_type": "MALWARE",
      "threat_status": "ACTIVE"
    }
  ]
}
```

**Authentication:** Internal only (called by submit-url function)

---

## Row-Level Security (RLS)

All tables use RLS to ensure data privacy:

```sql
-- Users can only see their own profile
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can only rate URLs they haven't already rated
CREATE POLICY "Users can rate URLs once"
  ON ratings
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    NOT EXISTS (
      SELECT 1 FROM ratings r
      WHERE r.user_id = auth.uid()
      AND r.url_id = ratings.url_id
    )
  );

-- Collections are visible to owner and followers
CREATE POLICY "Collections visible to owner and followers"
  ON collections
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    is_public = true OR
    EXISTS (
      SELECT 1 FROM follows
      WHERE follows.follower_id = auth.uid()
      AND follows.following_id = collections.user_id
    )
  );
```

## Environment Variables

Edge Functions use these environment variables (set in Supabase dashboard):

```
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=sb_...
SAFE_BROWSING_API_KEY=your_google_safe_browsing_key
```

## Development Setup

### Prerequisites
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- PostgreSQL 14+
- Node.js 20+

### Local Development

```bash
# Start local Supabase instance
supabase start

# Stop when done
supabase stop
```

This starts:
- PostgreSQL on port 5432
- PostgREST API on port 3000
- Supabase Studio on port 5173

### Deploy Edge Function

```bash
# Deploy to staging
supabase functions deploy function_name --project-id [PROJECT_ID]

# Deploy to production
supabase functions deploy function_name --project-id [PROJECT_ID]
```

## Testing

### Test via cURL

```bash
# Test roam function
curl -X POST http://localhost:3000/functions/v1/roam \
  -H "Content-Type: application/json" \
  -d '{"category": "Tech"}'

# Test submit-url with auth header
curl -X POST http://localhost:3000/functions/v1/submit-url \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "title": "Example",
    "category": "Tech"
  }'
```

### Test via Supabase Studio

1. Open http://localhost:5173 (Supabase Studio)
2. Go to SQL Editor
3. Run manual queries to test

## Monitoring

### View Edge Function Logs

```bash
# Show last 50 logs
supabase functions logs function_name --limit 50
```

### Monitor Database

```bash
# Connect to local PostgreSQL
psql postgresql://postgres:postgres@localhost:5432/postgres

# View top queries
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;
```

## Troubleshooting

### "Function not found" error
- Ensure function is deployed: `supabase functions list`
- Check function URL is correct: `/functions/v1/{function_name}`
- Verify Edge Function is public or has correct auth

### "SUPABASE_URL is not set"
- Set environment variable in Supabase dashboard Settings → Edge Functions → Environment Variables

### Slow queries
- Check if table has an index on frequently queried columns
- Use `EXPLAIN ANALYZE` to see query plan
- Consider adding composite indexes for common filters

### RLS blocking legitimate queries
- Test query without RLS: disable RLS temporarily to verify data exists
- Check RLS policy condition: `SELECT * FROM auth.jwt();` in SQL editor
- Ensure JWT token is valid

## Further Reading

- [Supabase Database Documentation](https://supabase.com/docs/guides/database)
- [Deno Edge Functions Guide](https://deno.com/deploy/docs)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase CLI Reference](https://supabase.com/docs/guides/cli)
