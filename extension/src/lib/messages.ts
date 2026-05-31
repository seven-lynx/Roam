// messages.ts — Type-safe message protocol between popup and background SW

import { Sentry } from './sentry';

export type Request =
  | { type: 'GET_STATE' }
  | { type: 'SIGN_IN_GOOGLE' }
  | { type: 'SIGN_IN_EMAIL'; email: string; password: string }
  | { type: 'SIGN_UP_EMAIL'; email: string; password: string }
  | { type: 'GET_CATEGORIES' }
  | { type: 'GET_USER_CATEGORIES' }
  | { type: 'SET_USER_CATEGORIES'; categoryIds: string[] }
  | { type: 'GET_USER_INTERESTS' }
  | { type: 'SET_USER_INTERESTS'; pillarIds: string[]; topicIds: string[] }
  | { type: 'GET_ALL_SUBCATEGORIES' }
  | { type: 'SIGN_OUT' }
  | { type: 'ROAM'; categoryId?: string; subcategoryId?: string }
  | { type: 'GET_SUBCATEGORIES'; categoryId: string }
  | { type: 'ROAM_COLLECTION'; collectionId: string }
  | { type: 'ROAM_CATEGORY'; categoryId: string }
  | { type: 'RATE'; url_id: string; vote: 1 | -1 }
  | { type: 'CHECK_URL'; url: string }
  | { type: 'SUBMIT_URL'; url: string; categoryId: string }
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
  | { type: 'REPORT_URL'; url_id: string };

export type Response<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface StateData {
  signedIn: boolean;
  email?: string;
  userId?: string;
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

export interface UserCategoriesData {
  categoryIds: string[];
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

/** Type-safe wrapper around chrome.runtime.sendMessage.
 *  Retries once if the SW was just woken from sleep, and captures any
 *  Chrome runtime errors (e.g. "Service worker response timeout") to Sentry. */
export async function sendToBackground<T = unknown>(req: Request): Promise<Response<T>> {
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
