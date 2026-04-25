// messages.ts — Type-safe message protocol between popup and background SW

export type Request =
  | { type: 'GET_STATE' }
  | { type: 'SIGN_IN_GOOGLE' }
  | { type: 'SIGN_OUT' }
  | { type: 'ROAM' }
  | { type: 'RATE'; url: string; vote: 1 | -1 }
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

/** Type-safe wrapper around chrome.runtime.sendMessage */
export function sendToBackground<T = unknown>(req: Request): Promise<Response<T>> {
  return chrome.runtime.sendMessage(req) as Promise<Response<T>>;
}
