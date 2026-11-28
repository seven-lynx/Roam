// consent.ts — whether error reporting may leave the browser (E2).
//
// Two bits, one answer:
//   - `error_reporting` in chrome.storage.local is what the user asked for. D5 makes
//     it opt-out: absent means on. It is persistent by rule E.6 — never the session
//     store, which dies with the browser.
//   - the optional `technicalAndInteraction` data-collection permission is what the
//     browser will actually allow. Where it exists it is the truth: a user who
//     revoked it in about:addons has not touched the preference, and nothing may be
//     sent anyway.
//
// Which of the two decides is a property of the build target, not of the permission
// store: `@types/chrome` (0.0.320) does not model `data_collection` at all, and the
// shape Firefox returns from `getAll()` before the grant exists is unverified. On
// Firefox the grant decides and an unreadable grant means no — fail closed. On
// Chrome, which has no data-collection axis, the preference is the whole truth.
//
// `disableErrorReporting()` here is the user-facing path (revoke, then stop). The
// façade has one of its own that only flips its `enabled` flag; entry points call
// both.

import { PLATFORM } from './sentry-config';

/** Persistent preference. Default on (D5). */
const PREF_KEY = 'error_reporting';

/** The category Firefox's manifest declares under `data_collection_permissions.optional`. */
const CATEGORY = 'technicalAndInteraction';

/**
 * The members Firefox adds to the permissions API that `@types/chrome` does not
 * model. Extending the Chrome type keeps the request assignable without a cast —
 * an extra property on a value that is not a fresh literal is legal, and R9 bans
 * the unbounded cast in any case.
 */
interface DataCollectionPermissions extends chrome.permissions.Permissions {
  data_collection?: string[];
}

/** The request this module makes. `data_collection` is ignored by every other browser. */
const REQUEST: DataCollectionPermissions = { data_collection: [CATEGORY] };

/** The build target, which is also what E1 tags events with. */
function isFirefox(): boolean {
  return PLATFORM === 'firefox';
}

/**
 * The stored preference, or `true` when nothing is stored yet. A runtime without
 * `storage` cannot answer, and the documented default is on.
 */
export async function getPreference(): Promise<boolean> {
  try {
    const stored = await chrome.storage.local.get(PREF_KEY);
    const value: unknown = stored[PREF_KEY];
    return typeof value === 'boolean' ? value : true;
  } catch {
    return true;
  }
}

/**
 * Has the user answered the consent question yet? `getPreference()` cannot say —
 * it reports `true` for "nothing stored", which is the default, not an answer. The
 * card asks once and never again (D9), so it needs the distinction.
 */
export async function hasStoredPreference(): Promise<boolean> {
  try {
    const stored = await chrome.storage.local.get(PREF_KEY);
    return typeof stored[PREF_KEY] === 'boolean';
  } catch {
    return false;
  }
}

/** Persist the preference. Storage failures are not the caller's problem. */
export async function setPreference(value: boolean): Promise<void> {
  try {
    await chrome.storage.local.set({ [PREF_KEY]: value });
  } catch {
    // Nothing to do: the choice still governs this session's behaviour.
  }
}

/**
 * The granted data-collection categories, or `null` when this browser does not
 * expose them — no permissions API, no `data_collection` key, or a call that threw.
 */
async function grantedCategories(): Promise<string[] | null> {
  try {
    if (typeof chrome.permissions?.getAll !== 'function') return null;
    const all: DataCollectionPermissions = await chrome.permissions.getAll();
    const categories: unknown = all.data_collection;
    if (!Array.isArray(categories)) return null;
    return categories.filter((category): category is string => typeof category === 'string');
  } catch {
    return null;
  }
}

/**
 * May an error be reported right now? On Firefox the grant is the answer and its
 * absence means no, whatever the preference says. On Chrome the preference is.
 */
export async function isErrorReportingGranted(): Promise<boolean> {
  if (!isFirefox()) return getPreference();

  const granted = await grantedCategories();
  return granted !== null && granted.includes(CATEGORY);
}

/**
 * Ask for the grant and record the answer as the preference. On Chrome there is no
 * grant to ask for — the preference is the permission — so this only stores `true`.
 */
export async function requestErrorReporting(): Promise<boolean> {
  const granted = isFirefox() ? await requestGrant() : true;
  await setPreference(granted);
  return granted;
}

/** Stop reporting: give the grant back, then store the refusal. */
export async function disableErrorReporting(): Promise<void> {
  await removeGrant();
  await setPreference(false);
}

async function requestGrant(): Promise<boolean> {
  try {
    if (typeof chrome.permissions?.request !== 'function') return false;
    return await chrome.permissions.request(REQUEST);
  } catch {
    return false;
  }
}

async function removeGrant(): Promise<void> {
  if (!isFirefox()) return;
  try {
    if (typeof chrome.permissions?.remove !== 'function') return;
    await chrome.permissions.remove(REQUEST);
  } catch {
    // A browser that never granted it has nothing to take away.
  }
}
