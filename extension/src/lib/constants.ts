// constants.ts ΓÇö Shared constants used across background and popup

import type { CategoryItem } from './messages';

// Hardcoded fallback category list used when the live DB fetch fails.
// IDs must match the seed data in supabase/migrations.
export const FALLBACK_CATEGORIES: CategoryItem[] = [
  { id: 'c1000000-0000-0000-0000-000000000001', name: 'Science & Nature', icon: '≡ƒö¼' },
  { id: 'c1000000-0000-0000-0000-000000000002', name: 'Technology',       icon: '≡ƒÆ╗' },
  { id: 'c1000000-0000-0000-0000-000000000003', name: 'Arts & Culture',   icon: '≡ƒÄ¿' },
  { id: 'c1000000-0000-0000-0000-000000000004', name: 'History & Ideas',  icon: '≡ƒô£' },
  { id: 'c1000000-0000-0000-0000-000000000005', name: 'Games & Hobbies',  icon: '≡ƒÄ«' },
  { id: 'c1000000-0000-0000-0000-000000000006', name: 'Weird & Wonderful', icon: '≡ƒîÇ' },
  { id: 'c1000000-0000-0000-0000-000000000007', name: 'People & Places',  icon: '≡ƒîì' },
  { id: 'c1000000-0000-0000-0000-000000000008', name: 'Mind & Body',      icon: '≡ƒºá' },
];