/**
 * Centralized constants for URLs, categories, and app-wide configuration.
 */

/** Fallback categories used when DB fetch fails */
export const FALLBACK_CATEGORIES = [
  { id: "c1000000-0000-0000-0000-000000000001", label: "Science & Nature", emoji: "🔬" },
  { id: "c1000000-0000-0000-0000-000000000002", label: "Technology", emoji: "💻" },
  { id: "c1000000-0000-0000-0000-000000000003", label: "Arts & Culture", emoji: "🎨" },
  { id: "c1000000-0000-0000-0000-000000000004", label: "History & Ideas", emoji: "📜" },
  { id: "c1000000-0000-0000-0000-000000000005", label: "Games & Hobbies", emoji: "🎮" },
  { id: "c1000000-0000-0000-0000-000000000006", label: "Weird & Wonderful", emoji: "🌀" },
  { id: "c1000000-0000-0000-0000-000000000007", label: "People & Places", emoji: "🌍" },
  { id: "c1000000-0000-0000-0000-000000000008", label: "Mind & Body", emoji: "🧠" },
];

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

/**
 * Canonical list of tracking/analytics query parameters to strip during URL
 * normalization. Keep in sync with:
 * - Android: MainViewModel.normalizeUrl() (trackingKeys set)
 * - Extension: extension/src/background/background.ts (STRIP array)
 */
export const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term',
  'utm_content', 'utm_id', 'fbclid', 'gclid', 'ref', 'source',
  'mc_cid', 'mc_eid',
] as const;
