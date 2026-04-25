// messages.ts — Type-safe message protocol between popup and background SW

export type Request =
  | { type: 'GET_STATE' }
  | { type: 'SIGN_IN_GOOGLE' }
  | { type: 'SIGN_OUT' }
  | { type: 'ROAM'; collectionId?: string }
  | { type: 'RATE'; url_id: string; vote: 1 | -1 }
  | { type: 'CHECK_URL'; url: string }
  | { type: 'SUBMIT_URL'; url: string; categoryId: string }
  | { type: 'SAVE_LATER'; url: string }
  | { type: 'SET_PAYWALL_PREF'; skip: boolean };

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
}

export interface CheckUrlData {
  known: boolean;
  url_id?: string;
}

/** Type-safe wrapper around chrome.runtime.sendMessage */
export function sendToBackground<T = unknown>(req: Request): Promise<Response<T>> {
  return chrome.runtime.sendMessage(req) as Promise<Response<T>>;
}
