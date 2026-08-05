// Direct insert of Cars & Automotive subcategory
import { createClient } from '@supabase/supabase-js';
import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenvConfig({ path: resolve(ROOT, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { error } = await supabase.from('subcategories').upsert({
  id: 'c2000005-0000-0000-0000-000000000013',
  category_id: 'c1000000-0000-0000-0000-000000000005',
  name: 'Cars & Automotive',
  slug: 'cars-automotive',
  sort_order: 13,
});

if (error) {
  console.error('Failed:', error.message);
  process.exit(1);
}
console.log('Cars & Automotive subcategory inserted successfully');