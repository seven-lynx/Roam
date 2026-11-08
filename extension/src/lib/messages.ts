// messages.ts — Type-safe message protocol between popup and background SW

import { Sentry } from './sentry';
import { isExtensionContext } from './extension-context';

export type Request =
  | { type: 'GET_STATE' }
  | { type: 'SIGN_IN_GOOGLE' }
  | { type: 'SIGN_IN_EMAIL'; email: string; password: string }
  | { type: 'SIGN_UP_EMAIL'; email: string; password: string }
  | { type: 'GET_CATEGORIES' }
  | { type: 'GET_USER_INTERESTS' }
  | { type: 'GET_USER_SETTINGS' }
  | { type: 'SET_USER_INTERESTS'; pillarIds: string[]; topicIds: string[] }
  | { type: 'GET_ALL_SUBCATEGORIES' }
  | { type: 'SIGN_OUT' }
  | { type: 'ROAM'; categoryId?: string; subcategoryId?: string }
  | { type: 'ROAM_COLLECTION'; collectionId: string }
  | { type: 'ROAM_CATEGORY'; categoryId: string }
  | { type: 'RATE'; url_id: string; vote: 1 | -1 }
  | { type: 'CHECK_URL'; url: string }
  | { type: 'SUBMIT_URL'; url: string; categoryId: string; subcategoryId?: string }
  | { type: 'SAVE_LATER'; url: string; title?: string }
  | { type: 'GET_SAVED_URLS' }
  | { type: 'REMOVE_SAVED_URL'; savedUrlId: string }
  | { type: 'SET_PAYWALL_PREF'; skip: boolean }
  | { type: 'SET_LANGUAGE_PREF'; languages: string[] }
  | { type: 'SET_DISCOVERY_MODE'; mode: 'discovery' | 'deep_dive' }
  | { type: 'SET_AUTO_TRANSLATE'; enabled: boolean }
  | { type: 'GET_COLLECTIONS' }
  | { type: 'CREATE_COLLECTION'; name: string }
  | { type: 'ADD_URL_TO_COLLECTION'; url: string; collectionId: string }
  | { type: 'EXCHANGE_CODE'; code: string }
  | { type: 'SAVE_SESSION'; accessToken: string; refreshToken: string }
  | { type: 'GET_PROFILE' }
  | { type: 'SEND_FEEDBACK'; message: string; email?: string; platform: string }
  | { type: 'REPORT_URL'; url_id: string }
  | { type: 'SET_PROFILE_PUBLIC'; isPublic: boolean }
  | { type: 'SHARE_URL_WITH_USER'; url: string; recipientId: string }
  | { type: 'GET_SHARE_RECIPIENTS'; search?: string }
  | { type: 'FOLLOW_USER'; userId: string }
  | { type: 'UNFOLLOW_USER'; userId: string }
  | { type: 'GET_FOLLOWERS' }
  | { type: 'GET_FOLLOWING' }
  | { type: 'GET_ACTIVITY_FEED'; limit?: number }
  | { type: 'GET_PROFILE_PUBLIC' }
  | { type: 'REPORT_ENGAGEMENT'; url_id: string; dwell_ms: number; skipped: boolean }
  | { type: 'GET_NOTIFICATIONS' }
  | { type: 'GET_UNREAD_COUNT' }
  | { type: 'MARK_NOTIFICATIONS_READ' }
  | { type: 'DELETE_NOTIFICATION'; notificationId: string }
  | { type: 'MARK_NOTIFICATION_READ'; notificationId: string }
  | { type: 'CLEAR_NOTIFICATIONS' }
  | { type: 'GET_BADGES' }
  | { type: 'GET_CHALLENGES' }
  | { type: 'GET_URL_HISTORY'; limit?: number }
  | { type: 'CLEAR_URL_HISTORY' }
  | { type: 'DELETE_COLLECTION'; collectionId: string }
  | { type: 'RENAME_COLLECTION'; collectionId: string; name: string }
  | { type: 'UPDATE_COLLECTION_PUBLIC'; collectionId: string; isPublic: boolean }
  | { type: 'GET_PROFILE_STATS' }
  | { type: 'GET_MY_PROFILE' }
  | { type: 'SET_PROFILE_FIELDS'; displayName: string; bio: string }
  | { type: 'CLAIM_USERNAME'; username: string }
  | { type: 'CHANGE_PASSWORD'; currentPassword: string; newPassword: string }
  | { type: 'SET_DESKTOP_NOTIFICATIONS'; enabled: boolean }
  | { type: 'GET_SUBCATEGORIES_FOR_CATEGORY'; categoryId: string };

export type Response<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface StateData {
  signedIn: boolean;
  email?: string;
  userId?: string;
  /** Auth provider reported by Supabase ('email', 'google', …). */
  provider?: string;
}

export interface RoamData {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  og_image_url: string | null;
  category_id?: string;
}

export interface CheckUrlData {
  known: boolean;
  url_id?: string;
  category_id?: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  icon: string;
}

/** Server-side preferences from public.user_settings (one row per user). */
export interface UserSettingsData {
  skip_paywalled: boolean;
  discovery_mode: 'discovery' | 'deep_dive';
  preferred_languages: string[];
}

export interface ProfileStatsData {
  roamed: number;
  submitted: number;
  level: number;
  xp_total: number;
  streak_days: number;
  max_streak: number;
}

export interface MyProfileData {
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_public: boolean;
  level: number;
  xp_total: number;
  streak_days: number;
  roamed: number;
  submitted: number;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string | null;
  body: string | null;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

/** A saved page held in chrome.storage.local while the user is signed out. */
export interface LocalSavedUrl {
  url: string;
  title: string;
  savedAt: number;
}

export interface UserInterestsData {
  mode: 'pillars' | 'topics';
  pillarIds: string[];
  topicIds: string[];
}

export interface SignUpEmailData {
  needsVerification: boolean;
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  is_public: boolean;
  item_count: number;
}

export interface FollowUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface ActivityItem {
  id: string;
  username: string;
  display_name: string | null;
  activity_type: string;
  subject_title: string | null;
  subject_url: string | null;
  badge_name: string | null;
  collection_slug: string | null;
  created_at: string;
}

export interface SavedUrlItem {
  id: string;
  url: string;
  title: string;
  saved_at: string;
}

export interface ProfileData {
  username: string;
}

export interface SubcategoryItem {
  id: string;
  name: string;
  category_id: string;
  sort_order: number;
}

export interface ChallengeInfo {
  id: string;
  key: string;
  title: string;
  goal_description: string | null;
  goal_count: number;
  xp_reward: number;
  type: 'daily' | 'weekly' | 'monthly';
  condition_type: string;
  time_restriction: string | null;
  expires_at: string;
}

export interface ChallengeData {
  instance_id: string;
  progress_current: number;
  completed_at: string | null;
  challenge: ChallengeInfo;
}

export interface BadgeData {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tier: number;
  required_count: number | null;
  is_unlocked: boolean;
  unlocked_at: string | null;
  progress_current: number;
  is_hidden: boolean;
  is_gift_only: boolean;
  xp_reward: number;
  parent_badge_slug: string | null;
  granted_by: string | null;
}

/** Type-safe wrapper around chrome.runtime.sendMessage.
 *  Retries once if the SW was just woken from sleep, and captures any
 *  Chrome runtime errors (e.g. "Service worker response timeout") to Sentry. */
export async function sendToBackground<T = unknown>(req: Request): Promise<Response<T>> {
  // Without an extension runtime there is no background worker to reach at all, so a
  // retry cannot help and capturing the ReferenceError would only file the phantom
  // issue described in #75. Report it plainly and leave the popup on its error state.
  if (!isExtensionContext()) {
    return {
      ok: false,
      error: 'Roam is not running as an installed extension.',
    } as Response<T>;
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) {
        // Brief pause — gives Chrome time to restart the SW before the retry.
        await new Promise<void>((r) => setTimeout(r, 300));
      }
      return (await chrome.runtime.sendMessage(req)) as Response<T>;
    } catch (err) {
      if (attempt === 1) {
        // Both attempts failed — capture to Sentry and return a safe error object.
        Sentry.captureException(err, {
          extra: { messageType: (req as { type: string }).type },
          tags: { context: 'sendToBackground' },
        });
        return {
          ok: false,
          error: 'Something went wrong. Please close and reopen the extension.',
        } as Response<T>;
      }
    }
  }
  // Unreachable, but TypeScript needs this.
  return { ok: false, error: 'Something went wrong.' } as Response<T>;
}