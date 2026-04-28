// messages.ts — Type-safe message protocol between popup and background SW

export type Request =
  | { type: 'GET_STATE' }
  | { type: 'SIGN_IN_GOOGLE' }
  | { type: 'SIGN_OUT' }
  | { type: 'ROAM'; collectionId?: string }
  | { type: 'ROAM_COLLECTION'; collectionId: string }
  | { type: 'ROAM_CATEGORY'; categoryId: string }
  | { type: 'RATE'; url_id: string; vote: 1 | -1 }
  | { type: 'CHECK_URL'; url: string }
  | { type: 'SUBMIT_URL'; url: string; categoryId: string }
  | { type: 'SAVE_LATER'; url: string }
  | { type: 'SET_PAYWALL_PREF'; skip: boolean }
  | { type: 'GET_COLLECTIONS' }
  | { type: 'CREATE_COLLECTION'; name: string }
  | { type: 'ADD_URL_TO_COLLECTION'; url: string; collectionId: string }
  | { type: 'GET_QUEUE_STATE' }
  | { type: 'REFRESH_CATEGORIES'; categoryIds: string[] };

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

export interface QueueState {
  hot_count: number;
  warming_count: number;
  failed_count: number;
  category_filter: string[];
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  is_public: boolean;
  item_count: number;
}

/** Type-safe wrapper around chrome.runtime.sendMessage */
export function sendToBackground<T = unknown>(req: Request): Promise<Response<T>> {
  return chrome.runtime.sendMessage(req) as Promise<Response<T>>;
}
