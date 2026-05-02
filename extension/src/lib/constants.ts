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
