/**
 * _deactivate-curlie-regional.mjs
 *
 * One-off script: batch-deactivate all Curlie URLs in the People & Places category.
 * These come from rdf-Regional-c.tsv, rdf-NorthAmerica-c.tsv, rdf-Europe-c.tsv,
 * rdf-World-c.tsv and are overwhelmingly local business directories.
 * WikiVoyage and Atlas Obscura (97K+ active URLs) already cover quality places content.
 *
 * Run once from scripts/:
 *   node _deactivate-curlie-regional.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from repo root
const envPath = resolve(__dirname, '..', '.env');
const envLines = readFileSync(envPath, 'utf-8').split('\n');
for (const line of envLines) {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PEOPLE_PLACES_ID = 'c1000000-0000-0000-0000-000000000007';
const BATCH_SIZE = 500;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in scripts/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function run() {
  let total = 0;
  let iteration = 0;

  console.log('Deactivating Curlie People & Places URLs in batches of', BATCH_SIZE);

  while (true) {
    iteration++;

    // Fetch a batch of IDs to deactivate
    const { data: rows, error: fetchErr } = await supabase
      .from('urls')
      .select('id')
      .eq('source', 'curlie')
      .eq('category_id', PEOPLE_PLACES_ID)
      .eq('inactive', false)
      .limit(BATCH_SIZE);

    if (fetchErr) {
      console.error(`Fetch error on iteration ${iteration}:`, fetchErr.message);
      process.exit(1);
    }

    if (!rows || rows.length === 0) {
      console.log(`\nDone. Total deactivated: ${total}`);
      break;
    }

    const ids = rows.map(r => r.id);

    let updateErr;
    for (let attempt = 1; attempt <= 5; attempt++) {
      const { error } = await supabase
        .from('urls')
        .update({ inactive: true })
        .in('id', ids);
      updateErr = error;
      if (!updateErr) break;
      // Retry on deadlock or timeout
      const msg = updateErr.message ?? '';
      if (msg.includes('deadlock') || msg.includes('timeout')) {
        const wait = attempt * 1000;
        process.stdout.write(`\n  Retrying batch ${iteration} after ${wait}ms (${msg.split('\n')[0]})...\n`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        break; // Non-retryable error
      }
    }

    if (updateErr) {
      console.error(`\nUpdate error on iteration ${iteration}:`, updateErr.message);
      process.exit(1);
    }

    total += rows.length;
    if (iteration % 10 === 0) {
      process.stdout.write(`\r  ${total.toLocaleString()} deactivated...`);
    }

    // Brief pause to avoid hitting PostgREST rate limits
    await new Promise(r => setTimeout(r, 50));
  }
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
