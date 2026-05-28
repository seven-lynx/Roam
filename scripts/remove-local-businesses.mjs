#!/usr/bin/env node
/**
 * remove-local-businesses.mjs
 *
 * Scans the URL pool for local-business / retail storefront URLs and removes
 * them. Default mode is dry-run — pass --commit to apply deletions.
 *
 * Usage:
 *   node remove-local-businesses.mjs
 *   node remove-local-businesses.mjs --commit
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { config as dotenvConfig } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../.env') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const COMMIT = process.argv.includes('--commit');

// ── Detection rules ───────────────────────────────────────────────────────────
// Applied client-side after paginating through the DB in batches.
// Server-side ILIKE on 3M+ rows times out via PostgREST; cursor pagination avoids this.

function isLocalBusiness(url, title) {
  const u = url.toLowerCase();
  const t = (title ?? '').toLowerCase();

  // Domain-based (zero false positives)
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.endsWith('.myshopify.com')) return 'Shopify storefront';
    if (host.endsWith('.square.site'))  return 'Square commerce site';
    if (host === 'toasttab.com' || host.endsWith('.toasttab.com')) return 'Toast restaurant ordering';
    if (host === 'squareup.com' && u.includes('/store/')) return 'Square store page';
  } catch { /* malformed URL, skip */ }

  // URL path patterns
  if (/\/(online-ordering|order-online|order-now|place-an-order)(\/|\?|$)/.test(u)) return 'ordering page path';

  // Title patterns (high-signal phrases unlikely in editorial content)
  if (t.includes('store hours'))        return 'title: store hours';
  if (t.includes('hours of operation')) return 'title: hours of operation';

  return null;
}

const BATCH = 2000;

async function* scanAll() {
  let lastId = '00000000-0000-0000-0000-000000000000';
  while (true) {
    const { data, error } = await supabase
      .from('urls')
      .select('id, url, title')
      .gt('id', lastId)
      .order('id')
      .limit(BATCH);
    if (error) throw new Error(`PostgREST error: ${error.message}`);
    if (!data?.length) break;
    yield data;
    if (data.length < BATCH) break;
    lastId = data[data.length - 1].id;
  }
}

async function deleteByIds(ids) {
  const BATCH = 500;
  let total = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const { error } = await supabase.from('urls').delete().in('id', chunk);
    if (error) throw new Error(`Delete error: ${error.message}`);
    total += chunk.length;
    process.stdout.write(`\r  Deleting... ${total}/${ids.length}`);
  }
  process.stdout.write('\n');
  return total;
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n  Local Business URL Cleanup`);
console.log(`  Mode: ${COMMIT ? 'COMMIT — deletions will be applied' : 'dry-run — pass --commit to apply'}\n`);

const toRemove = [];
let scanned = 0;

process.stdout.write('  Scanning...');
for await (const batch of scanAll()) {
  for (const row of batch) {
    const reason = isLocalBusiness(row.url, row.title);
    if (reason) toRemove.push({ ...row, reason });
  }
  scanned += batch.length;
  process.stdout.write(`\r  Scanning... ${scanned.toLocaleString()} rows checked, ${toRemove.length} flagged`);
}
console.log();

if (toRemove.length === 0) {
  console.log('  Nothing to remove.\n');
  process.exit(0);
}

// Group by reason for display
const byReason = {};
for (const r of toRemove) {
  if (!byReason[r.reason]) byReason[r.reason] = [];
  byReason[r.reason].push(r);
}
console.log();
for (const [reason, rows] of Object.entries(byReason)) {
  console.log(`  ${reason}: ${rows.length}`);
  rows.slice(0, 3).forEach((r) => console.log(`    • ${r.url}`));
  if (rows.length > 3) console.log(`    … and ${rows.length - 3} more`);
}

console.log(`\n  Total to remove: ${toRemove.length}`);

if (!COMMIT) {
  console.log('\n  Run with --commit to delete.\n');
  process.exit(0);
}

const deleted = await deleteByIds(toRemove.map((r) => r.id));
console.log(`  Done. ${deleted} URLs removed.\n`);
