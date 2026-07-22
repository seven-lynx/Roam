# 🔔 Notifications System — Full Audit
**Date:** 2026-07-03  
**Scope:** Database → Edge Functions → Web → Android → Email  
**Status:** Comprehensive review — 7 issues found (0 critical, 3 high, 3 medium, 1 low)

---

## Architecture Overview

```
┌────────────────────────────────────────────────────┐
│                  DATABASE (Supabase)                │
│                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐│
│  │ notifications│  │ push_tokens  │  │user_      ││
│  │              │  │              │  │ settings   ││
│  │ • id         │  │ • id         │  │ .email_    ││
│  │ • user_id    │  │ • user_id    │  │  notifica- ││
│  │ • type       │  │ • platform   │  │  tions     ││
│  │ • title      │  │ • token      │  │ (boolean)  ││
│  │ • body       │  │ • created_at │  └───────────┘│
│  │ • data (JSON)│  │ • updated_at │               │
│  │ • read       │  └──────────────┘               │
│  │ • created_at │                                  │
│  └──────────────┘                                  │
│   TRIGGERS:                                        │
│   • notify_on_moderation_decision                  │
│   • evaluate_badges() → badge_unlocked/level_up    │
│   • award_xp() → level_up                         │
│   • grant_badge() → badge_unlocked                 │
│   • follow → new_follower (via follow edge func)   │
└────────────────────┬───────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
    ┌─────────┐ ┌─────────┐ ┌─────────┐
    │ DB      │ │ push-   │ │ send-   │
    │ Webhook │ │ notify  │ │ bulk-   │
    │ → push- │ │ Edge    │ │ email   │
    │ notify  │ │ Func    │ │ Edge    │
    └─────────┘ │         │ │ Func    │
                │ • FCM   │ │         │
                │ • Web   │ │ • Resend│
                │   Push  │ │   API   │
                └────┬────┘ └────┬────┘
                     │           │
         ┌───────────┤           │
         ▼           ▼           ▼
    ┌─────────┐ ┌─────────┐ ┌─────────┐
    │ Android │ │   Web   │ │  Email  │
    │  App    │ │ Browser │ │ Inbox   │
    └─────────┘ └─────────┘ └─────────┘
```

---

## 1. Database Layer

### 1.1 `notifications` Table
**File:** `supabase/migrations/20260610000000_notifications.sql`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `user_id` | UUID FK → `auth.users` | CASCADE delete |
| `type` | TEXT CHECK | `url_approved`, `url_rejected`, `new_follower`, `badge_unlocked`, `level_up` |
| `title` | TEXT | Required |
| `body` | TEXT | Nullable |
| `data` | JSONB | Extensible payload |
| `read` | BOOLEAN | Default `false` |
| `created_at` | TIMESTAMPTZ | Default `now()` |

**Index:** Partial index on `(user_id, created_at DESC) WHERE read = FALSE`

**RLS Policies:**
- ✅ Owner can SELECT their own notifications
- ✅ Owner can UPDATE `read` on their own notifications
- ✅ Owner can DELETE their own notifications
- ✅ No direct INSERT policy (SECURITY DEFINER only — correct)

### 1.2 `push_tokens` Table
**File:** `supabase/migrations/20260611000000_push_tokens.sql`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK | CASCADE delete |
| `platform` | TEXT CHECK | `android` or `web` |
| `token` | TEXT | FCM token or Web Push subscription |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Constraints:** UNIQUE(user_id, platform, token)  
**RLS:** Owner can ALL (insert, select, update, delete)

### 1.3 `user_settings.email_notifications`
**File:** `supabase/migrations/20260707000000_email_notifications.sql`

- `email_notifications` BOOLEAN column, defaults to `true`
- UI respects this via SettingsClient.tsx → debounced save
- Unsubscribe flow: `/api/unsubscribe` → sets `email_notifications = false`

### 1.4 Trigger Pipeline

| Trigger | When Fires | Notification Type | Data Payload |
|---|---|---|---|
| `trg_notify_moderation_decision` | `moderation_queue.status` pending→approved/rejected | `url_approved` / `url_rejected` | `{url, queue_id, title}` |
| `evaluate_badges()` | After XP changes | `badge_unlocked` | `{badge_id, badge_name, badge_icon, v_profile_url}` |
| `evaluate_badges()` | After XP changes (level up) | `level_up` | `{new_level, v_profile_url}` |
| `award_xp()` | XP awarded (v26+) | `level_up` | `{new_level, v_profile_url}` |
| `grant_badge()` | Badge granted (v26+) | `badge_unlocked` | `{badge_id, badge_name, badge_icon, v_profile_url}` |
| `follow` edge function | User follows another | `new_follower` | `{follower_username, follower_id}` |

---

## 2. Edge Functions

### 2.1 `push-notify` (602 lines)
**File:** `supabase/functions/push-notify/index.ts`

**Trigger:** Database webhook on `notifications` INSERT

**Flow:**
1. Receives webhook payload `{ type: "INSERT", table: "notifications", record: {...} }`
2. Queries `push_tokens` WHERE `user_id = record.user_id`
3. For each Android token → sends via Firebase Cloud Messaging (FCM v1 HTTP API)
4. For each Web token → sends via Web Push API (VAPID)

**Observations:**
- ✅ Handles both platforms correctly
- ✅ Sends structured data payload for deep-linking
- ✅ Falls back gracefully if no tokens found
- ✅ Uses VAPID for Web Push with proper auth
- ⚠️ **Issue #1: No webhook confirmation in migrations** — The database webhook that calls `push-notify` on `notifications` INSERT is set up via Supabase Dashboard, not in migrations. If the project is recreated from scratch, this webhook must be manually recreated.

### 2.2 `follow` Edge Function
**File:** `supabase/functions/follow/index.ts`

**Flow:** When user A follows user B:
1. Inserts into `follows` table
2. INSERTS into `notifications` table directly (not via trigger):
   - `user_id = followee.id`
   - `type = 'new_follower'`
   - `title = 'New follower!'`
   - `body = '{follower_username} started following you'`
   - `data = { follower_username, follower_id }`

**Observations:**
- ✅ Correctly uses service_role client to bypass RLS
- ✅ Includes useful data for deep-linking to follower's profile
- ⚠️ **Issue #2: `badge_unlocked` and `level_up` types missing from NotificationBell** — The `Notification` TypeScript interface only lists `url_approved | url_rejected | new_follower`. Notifications with type `badge_unlocked` or `level_up` are fetched and stored in state but `getIcon()` and the rendering logic don't handle these types, so they display with a fallback/blank icon and no deep-link action.

### 2.3 `send-bulk-email` (306 lines)
**File:** `supabase/functions/send-bulk-email/index.ts`

**Purpose:** Admin-triggered bulk email to all users with `email_notifications = true`

**Flow:**
1. Admin calls function with `{ subject, html_body }`
2. Queries all `user_settings` WHERE `email_notifications = true` + joins `auth.users` for email
3. Sends via Resend API in batches of 50
4. Rate-limited to 10 emails/second (Resend free tier limit)
5. Includes unsubscribe link with HMAC-signed token

**Observations:**
- ✅ Respects user preference
- ✅ Includes unsubscribe link
- ✅ Batched sending with rate limiting
- ⚠️ **Issue #3: No per-notification-type email preferences** — Users can only toggle email on/off globally. Cannot choose to receive emails for `url_approved` but not for `new_follower`.

---

## 3. Web Layer

### 3.1 `NotificationBell.tsx` (276 lines)
**File:** `web/src/components/NotificationBell.tsx`

**Rendered in:** `Header.tsx` (desktop nav + mobile menu)

**Features:**
- ✅ Badge count polling (30s interval)
- ✅ Dropdown with last 20 notifications
- ✅ `timeAgo()` relative timestamps
- ✅ Clickable links for URL-related notifications
- ✅ Service worker registration on mount
- ✅ "Mark all read" + "Clear all" actions
- ✅ Outside click to close

**Issues:**
- ⚠️ **Issue #4: `badge_unlocked` and `level_up` notifications are invisible** — The `Notification` TypeScript interface only types `type` as `'url_approved' | 'url_rejected' | 'new_follower'`. Notifications with `type = 'badge_unlocked'` or `type = 'level_up'` will be rendered but may not display correctly. The `getIcon()` function also doesn't handle these types.
- ⚠️ **Issue #5: `new_follower` notification has no follow-back or visit-profile action** — Clicking a `new_follower` notification does nothing; no link is rendered for this type.
- ⚠️ **`checkPushState()` has dead code** — Gets push subscription but does nothing with `sub`. The comment says "check only updates state for future use" — this is stale debugging code.

### 3.2 `BadgeUnlockToast.tsx`
**File:** `web/src/components/badges/BadgeUnlockToast.tsx`

- ✅ Real-time subscription to `notifications` table for authenticated user
- ✅ Shows toast popup for `badge_unlocked` and `level_up` types only
- ✅ Auto-dismisses after 8 seconds
- ✅ Uses Supabase real-time channel with `INSERT` filter
- ✅ `level_up` notifications include the new level in the toast

**Observation:** The toast is the *only* place badge/level-up notifications are surfaced in the web UI. They don't appear in the NotificationBell dropdown. This is an intentional design (toast is more engaging) but creates inconsistency.

### 3.3 Settings — Notification Preferences
**File:** `web/src/app/settings/SettingsClient.tsx` (lines 438–456)

- ✅ Email toggle: reads/writes `user_settings.email_notifications`
- ✅ Push toggle: registers service worker, gets VAPID subscription, stores in `push_tokens`
- ✅ Auto-save with 2-second debounce
- ✅ Push toggle handles permission denied gracefully
- ⚠️ **No per-type notification preferences** — Same as Issue #3, users can't pick which notifications they want.

### 3.4 Service Worker (`sw.js`)
**File:** `web/public/sw.js` (71 lines)

- ✅ Handles `push` events with JSON body parsing
- ✅ Falls back to text body if JSON parse fails
- ✅ `notificationclick` focuses existing window or opens new one
- ✅ `data.url` is used for navigation on click
- ✅ Install → skipWaiting, Activate → claim clients

**Observations:**
- Handles `notification.data.url` for deep-linking
- ⚠️ **No notification grouping/collapsing** — Multiple notifications from the same source will stack individually
- ⚠️ **No image/icon in push payload** — Would improve visual quality

### 3.5 Unsubscribe Endpoint
**File:** `web/src/app/api/unsubscribe/route.ts`

- ✅ GET `/api/unsubscribe?token=...`
- ✅ HMAC-SHA256 token verification using `SUPABASE_SERVICE_ROLE_KEY`
- ✅ 90-day token expiry
- ✅ Sets `email_notifications = false` via admin client
- ✅ Redirects to `/settings` with success/error query param

---

## 4. Android Layer

### 4.1 `AppNotification.kt` (Data Model)
**File:** `android/app/src/main/java/app/roam/android/model/AppNotification.kt`

```kotlin
data class AppNotification(
    val id: String = "",
    val userId: String = "",
    val type: String = "",
    val title: String = "",
    val body: String? = null,
    val data: AppNotificationData? = null,
    val read: Boolean = false,
    val createdAt: String = ""
)

data class AppNotificationData(
    val url: String? = null,
    val queueId: String? = null,
    val title: String? = null
)
```

**Issues:**
- ⚠️ **`AppNotificationData` only models moderation data** — Missing fields for `badge_id`, `badge_name`, `badge_icon`, `new_level`, `follower_username`, `follower_id`, `v_profile_url`. Any notification of type `badge_unlocked`, `level_up`, or `new_follower` will have its `data` field partially or fully deserialized as null/missing.
- ⚠️ **`type` is a plain String** — No sealed class/enum for type safety. Invalid/unexpected types silently pass through.

### 4.2 `NotificationsScreen.kt`
**File:** `android/app/src/main/java/app/roam/android/ui/screen/NotificationsScreen.kt`

- ✅ Fetches notifications from Supabase via `RoamRepository`
- ✅ Shows unread count, mark-all-read, clear-all
- ✅ Deep-links URL notifications
- ✅ Pull-to-refresh
- ⚠️ **Same type handling gaps as web** — Badge/level-up notifications may not render correctly if `data` fields are unexpected.

### 4.3 `FCMService.kt`
**File:** `android/app/src/main/java/app/roam/android/FCMService.kt`

- ✅ Extends `FirebaseMessagingService`
- ✅ `onNewToken()` → saves to `push_tokens` table
- ✅ `onMessageReceived()` → creates Android notification channel, shows heads-up notification
- ✅ Handles notification click → deep-link via intent extras
- ✅ Registers notification channel on create
- ⚠️ **Only handles `data` payloads** (silent/background messages). If FCM sends a `notification` payload, the system tray handles it but `onMessageReceived` won't fire in background.

---

## 5. Notification Types — Complete Matrix

| Type | DB Triggers | Push (FCM) | Push (Web) | Email | Bell UI | Badge Toast | Android Screen |
|---|---|---|---|---|---|---|---|
| `url_approved` | ✅ moderation trigger | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| `url_rejected` | ✅ moderation trigger | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| `new_follower` | ✅ follow edge func | ✅ | ✅ | ❌ | ✅ (no action) | ❌ | ✅ |
| `badge_unlocked` | ✅ grant_badge() | ✅ | ✅ | ❌ | ⚠️ partial | ✅ | ⚠️ partial |
| `level_up` | ✅ award_xp() | ✅ | ✅ | ❌ | ⚠️ partial | ✅ | ⚠️ partial |

**Key:** ✅ = fully supported | ⚠️ = partially supported | ❌ = not supported

---

## 6. Issues Summary

### 🔴 CRITICAL — None

No data loss, security holes, or crashes found.

### 🟠 HIGH — 3 Issues

| # | Issue | Impact | Fix |
|---|---|---|---|
| **1** | Database webhook for `push-notify` not in migrations | Project recreation from scratch would silently break push notifications. | Add migration or script that creates the Supabase webhook. |
| **2** | `badge_unlocked`/`level_up` types missing from NotificationBell interface & `getIcon()` | Badge/level-up notifications in the bell dropdown render with wrong/default icon and no action. | Add types to TypeScript interface, add icons + actions to `getIcon()`. |
| **4** | Android `AppNotificationData` incomplete for badge/follow notifications | `badge_id`, `follower_username`, etc. are silently null on Android. | Add all notification `data` fields to `AppNotificationData`. |

### 🟡 MEDIUM — 3 Issues

| # | Issue | Impact | Fix |
|---|---|---|---|
| **3** | No per-type notification preferences | Users can't opt out of `new_follower` emails while keeping `url_approved` emails. | Add `notification_preferences` JSONB column to `user_settings`. |
| **5** | `new_follower` notification in bell has no click action | Tapping a new follower notification does nothing. | Link to follower's profile page `/u/${follower_username}`. |
| **6** | `checkPushState()` in NotificationBell has dead code | `sub` is fetched but never used. Adds unnecessary push permission prompt on every page load. | Remove `checkPushState()` or move push subscription logic to Settings. |

### 🟢 LOW — 1 Issue

| # | Issue | Impact | Fix |
|---|---|---|---|
| **7** | No notification retention/cleanup policy | `notifications` table grows unboundedly. | Add a cron job or scheduled function to delete notifications older than 90 days. |

---

## 7. Migration History (Notification-Related)

| Migration | Date | What It Does |
|---|---|---|
| `20260610000000_notifications.sql` | Jun 10 | Creates `notifications` table + moderation trigger |
| `20260611000000_push_tokens.sql` | Jun 11 | Creates `push_tokens` table |
| `20260613000001_badge_notifications.sql` | Jun 13 | Expands type CHECK, adds badge/level-up notification logic to `evaluate_badges()` |
| `20260616000000_badge_notification_deep_link.sql` | Jun 16 | Adds `v_profile_url` deep-link to badge/level-up notification data |
| `20260617000000_level_up_notifications.sql` | Jun 17 | Moves notification insertion to `award_xp()` and `grant_badge()` (more granular) |
| `20260707000000_email_notifications.sql` | Jul 7 | Adds `email_notifications` BOOLEAN column to `user_settings` |

**Anti-pattern noted:** `evaluate_badges()` is DROP + CREATE OR REPLACE'd across 3 migrations. This works but makes rollback impossible and increases risk of drift between migration versions. Consider using `CREATE OR REPLACE FUNCTION` consistently.

---

## 8. Recommendations (Priority Order)

### Immediate (this week)
1. **Add missing notification types to `NotificationBell.tsx`** — Add `badge_unlocked` and `level_up` to the TypeScript interface. Add icons for these types. Link `new_follower` to `/u/{username}`.
2. **Fix Android `AppNotificationData`** — Add nullable fields for `badge_id`, `badge_name`, `badge_icon`, `new_level`, `follower_username`, `follower_id`, `v_profile_url`.
3. **Remove dead `checkPushState()` code** — Either implement it or delete it. The push subscription should be managed only in Settings.

### Short-term (this sprint)
4. **Export database webhook configuration** — Either add a migration/script or document the webhook setup in `supabase/README.md`.
5. **Add notification action for `new_follower` in bell** — Click should navigate to `/u/{follower_username}`.
6. **Add icons to `getIcon()` for all types** — Currently only handles `url_approved`/`url_rejected`.

### Medium-term (next sprint)
7. **Per-type notification preferences** — Add `notification_preferences` JSONB to `user_settings`. Format: `{ "url_approved": { "push": true, "email": true }, "new_follower": { "push": true, "email": false }, ... }`.
8. **Notification retention policy** — Scheduled cleanup of notifications older than 90 days.

### Nice-to-have
9. **Notification grouping** — Group similar notifications (e.g., "3 new followers") in push/web.
10. **Rich push notifications** — Add images/icons to web push payloads.
11. **Analytics** — Track notification delivery, open rates, and unsubscribe rates.

---

## 9. Files Audited

| Layer | File | Lines |
|---|---|---|
| DB | `supabase/migrations/20260610000000_notifications.sql` | 83 |
| DB | `supabase/migrations/20260611000000_push_tokens.sql` | 27 |
| DB | `supabase/migrations/20260613000001_badge_notifications.sql` | 293 |
| DB | `supabase/migrations/20260616000000_badge_notification_deep_link.sql` | 290 |
| DB | `supabase/migrations/20260617000000_level_up_notifications.sql` | 481 |
| DB | `supabase/migrations/20260707000000_email_notifications.sql` | 32 |
| DB | `supabase/migrations/20260613000000_badges_gamification.sql` | 497 |
| Edge | `supabase/functions/push-notify/index.ts` | 602 |
| Edge | `supabase/functions/follow/index.ts` | ~150 |
| Edge | `supabase/functions/send-bulk-email/index.ts` | 306 |
| Web | `web/src/components/NotificationBell.tsx` | 276 |
| Web | `web/src/components/badges/BadgeUnlockToast.tsx` | ~120 |
| Web | `web/src/app/settings/SettingsClient.tsx` | 581 |
| Web | `web/src/app/settings/page.tsx` | 31 |
| Web | `web/src/app/api/unsubscribe/route.ts` | 105 |
| Web | `web/public/sw.js` | 71 |
| Web | `web/src/components/Header.tsx` | 365 |
| Web | `web/src/lib/hooks.ts` | 137 |
| Android | `android/.../model/AppNotification.kt` | 23 |
| Android | `android/.../ui/screen/NotificationsScreen.kt` | 284 |
| Android | `android/.../FCMService.kt` | 185 |
| Android | `android/.../ui/screen/MainScreen.kt` | ~400 |
| **Total** | **22 files** | **~5,260 lines** |

---

*Audit performed by Cline on 2026-07-03. Based on exhaustive review of all database migrations, edge functions, web components, Android components, and service workers involved in the notification pipeline.*