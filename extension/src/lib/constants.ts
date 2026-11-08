// constants.ts — Shared constants used across background and popup

import type { CategoryItem } from './messages';

// Hardcoded fallback category list used when the live DB fetch fails.
// IDs must match the seed data in supabase/migrations.
export const FALLBACK_CATEGORIES: CategoryItem[] = [
  { id: 'c1000000-0000-0000-0000-000000000001', name: 'Science & Nature', icon: '🔬' },
  { id: 'c1000000-0000-0000-0000-000000000002', name: 'Technology',       icon: '💻' },
  { id: 'c1000000-0000-0000-0000-000000000003', name: 'Arts & Culture',   icon: '🎨' },
  { id: 'c1000000-0000-0000-0000-000000000004', name: 'History & Ideas',  icon: '📜' },
  { id: 'c1000000-0000-0000-0000-000000000005', name: 'Games & Hobbies',  icon: '🎮' },
  { id: 'c1000000-0000-0000-0000-000000000006', name: 'Weird & Wonderful', icon: '🌀' },
  { id: 'c1000000-0000-0000-0000-000000000007', name: 'People & Places',  icon: '🌍' },
  { id: 'c1000000-0000-0000-0000-000000000008', name: 'Mind & Body',      icon: '🧠' },
];

// Content languages offered for discovery filtering and translation.
// Mirrors web/src/app/settings/SettingsClient.tsx (LANGUAGES) plus Arabic,
// which the popup has always offered.
export const LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'pl', label: 'Polski' },
  { code: 'ar', label: 'العربية' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
  { code: 'ru', label: 'Русский' },
  { code: 'ko', label: '한국어' },
];

/** English is always included by the backend language filter. */
export const DEFAULT_LANGUAGE = 'en';

/** Stale engagement samples (popup closed before the next roam) are dropped. */
export const ENGAGEMENT_MAX_DWELL_MS = 30 * 60 * 1000;
