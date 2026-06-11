/**
 * Centralized constants for URLs and app-wide configuration.
 */

/** Extension URLs for download pages */
export const EXTENSION_URLS = {
  chrome: 'https://chromewebstore.google.com/detail/ojgphkdgkefokhjnojkddhalnlbajfpc?utm_source=roam-web',
  firefox: 'https://addons.mozilla.org/firefox/addon/roam-the-web/',
  android: 'https://play.google.com/store/apps/details?id=app.roam.android',
} as const;

/** App base URL used for share links */
export const APP_URL = 'https://roamtheweb.app';

/** Maximum number of collections a user can have */
export const MAX_COLLECTIONS = 20;

/** Maximum number of items per collection */
export const MAX_COLLECTION_ITEMS = 200;

/** Maximum saved URLs before oldest expire */
export const MAX_SAVED_URLS = 50;

/** Days before a saved URL expires */
export const SAVED_URL_EXPIRY_DAYS = 30;