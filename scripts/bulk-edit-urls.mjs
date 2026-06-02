/**
 * bulk-edit-urls.mjs — General-purpose bulk URL editor
 *
 * Perform common bulk operations on URLs with flexible filtering.
 *
 * Usage:
 *   node scripts/bulk-edit-urls.mjs --operation <op> [filters] [options]
 *
 * Operations:
 *   mark-inactive              Mark URLs as inactive (soft delete; preserves data)
 *   mark-active                Mark URLs as active (restore from inactive)
 *   approve                    Mark URLs as approved (eligible for discovery)
 *   unapprove                  Mark URLs as unapproved (pending review)
 *   delete                     Hard delete URLs (cascades to ratings, reports, collections)
 *   reassign-category          Reassign URLs to a new category (use --reassign-category <uuid>)
 *   update-language            Update language field (use --set-language <code>)
 *   update-metadata            Update title/description/og_image (use --set-title, --set-description, --set-og-image)
 *
 * Filters (all optional, AND-combined):
 *   --source <name>            Filter by URL source (e.g., flickr-commons, reddit, wikipedia)
 *   --approved <true|false>    Filter by approval status
 *   --inactive <true|false>    Filter by inactive status
 *   --category <uuid>          Filter by category UUID
 *   --language <code>          Filter by language code (e.g., en, fr)
 *
 * Options:
 *   --dry-run                  (default) Preview changes without writing to DB
 *   --commit                   Write changes to database
 *   --confirm                  With --commit, require explicit "yes" confirmation
 *   --resumable                Save progress to .cache/ and resume from checkpoint on crash
 *   --reset                    Delete checkpoint file and start fresh
 *
 * Operation-specific args:
 *   --reassign-category <uuid> Target category UUID (used with --operation reassign-category)
 *   --set-language <code>      Target language code (used with --operation update-language)
 *   --set-title <string>       New title (used with --operation update-metadata)
 *   --set-description <string> New description (used with --operation update-metadata)
 *   --set-og-image <url>       New OG image URL (used with --operation update-metadata)
 *
 * Examples:
 *   # Preview: mark all approved Flickr URLs as inactive
 *   node scripts/bulk-edit-urls.mjs --operation mark-inactive --source flickr-commons --approved true --dry-run
 *
 *   # Execute: mark them as inactive
 *   node scripts/bulk-edit-urls.mjs --operation mark-inactive --source flickr-commons --approved true --commit --confirm
 *
 *   # Approve all Reddit URLs
 *   node scripts/bulk-edit-urls.mjs --operation approve --source reddit --inactive false --commit --confirm
 *
 *   # Move category
 *   node scripts/bulk-edit-urls.mjs --operation reassign-category --source wikipedia --reassign-category c20000000000000000000000000000001 --commit --confirm
 *
 *   # Update language for a subset
 *   node scripts/bulk-edit-urls.mjs --operation update-language --source nasa --language null --set-language en --commit --confirm
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { config as dotenvConfig } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = resolve(__dirname, '.cache');
const dotenvPath = resolve(__dirname, '../.env');

// Create cache directory if needed
if (!existsSync(CACHE_DIR)) {
  mkdirSync(CACHE_DIR, { recursive: true });
}

dotenvConfig({ path: dotenvPath });

// ── CLI Parsing ──────────────────────────────────────────────────────────────
function parseArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

function hasArg(flag) {
  return process.argv.includes(flag);
}

const OPERATION = parseArg('--operation');
const SOURCE = parseArg('--source');
const APPROVED_FILTER = parseArg('--approved');
const INACTIVE_FILTER = parseArg('--inactive');
const CATEGORY_FILTER = parseArg('--category');
const LANGUAGE_FILTER = parseArg('--language');

const DRY_RUN = !hasArg('--commit');
const CONFIRM = hasArg('--confirm');
const RESUMABLE = hasArg('--resumable');
const RESET = hasArg('--reset');

const REASSIGN_CATEGORY = parseArg('--reassign-category');
const SET_LANGUAGE = parseArg('--set-language');
const SET_TITLE = parseArg('--set-title');
const SET_DESCRIPTION = parseArg('--set-description');
const SET_OG_IMAGE = parseArg('--set-og-image');

// ── Validation ───────────────────────────────────────────────────────────────
if (!OPERATION) {
  console.error('Error: --operation is required');
  console.error('Valid operations: mark-inactive, mark-active, approve, unapprove, delete, reassign-category, update-language, update-metadata');
  process.exit(1);
}

const VALID_OPS = [
  'mark-inactive',
  'mark-active',
  'approve',
  'unapprove',
  'delete',
  'reassign-category',
  'update-language',
  'update-metadata',
];

if (!VALID_OPS.includes(OPERATION)) {
  console.error(`Error: Invalid operation "${OPERATION}"`);
  console.error(`Valid operations: ${VALID_OPS.join(', ')}`);
  process.exit(1);
}

// Validate operation-specific args
if (OPERATION === 'reassign-category' && !REASSIGN_CATEGORY) {
  console.error('Error: --operation reassign-category requires --reassign-category <uuid>');
  process.exit(1);
}

if (OPERATION === 'update-language' && !SET_LANGUAGE) {
  console.error('Error: --operation update-language requires --set-language <code>');
  process.exit(1);
}

if (OPERATION === 'update-metadata' && !SET_TITLE && !SET_DESCRIPTION && !SET_OG_IMAGE) {
  console.error('Error: --operation update-metadata requires at least one of --set-title, --set-description, --set-og-image');
  process.exit(1);
}

// ── Supabase ─────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ── Constants ────────────────────────────────────────────────────────────────
const DB_BATCH_SIZE = 500;
const EXPORT_PAGE_SIZE = 1_000;

// ── Checkpoint management ────────────────────────────────────────────────────
function getCheckpointPath() {
  const ts = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const filterStr = [SOURCE, APPROVED_FILTER, INACTIVE_FILTER, CATEGORY_FILTER, LANGUAGE_FILTER]
    .filter(Boolean)
    .join('-')
    .replace(/[^a-z0-9-]/gi, '_');
  const name = filterStr ? `bulk-edit-${OPERATION}-${filterStr}-${ts}.json` : `bulk-edit-${OPERATION}-${ts}.json`;
  return resolve(CACHE_DIR, name);
}

function loadCheckpoint() {
  const path = getCheckpointPath();
  if (!existsSync(path) || RESET) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function saveCheckpoint(data) {
  const path = getCheckpointPath();
  writeFileSync(path, JSON.stringify(data, null, 2));
}

// ── Query builder ────────────────────────────────────────────────────────────
function buildWhereClause() {
  const conditions = [];

  if (SOURCE) {
    conditions.push(`source = '${SOURCE}'`);
  }

  if (APPROVED_FILTER !== undefined) {
    const val = APPROVED_FILTER.toLowerCase() === 'true';
    conditions.push(`approved = ${val}`);
  }

  if (INACTIVE_FILTER !== undefined) {
    const val = INACTIVE_FILTER.toLowerCase() === 'true';
    conditions.push(`inactive = ${val}`);
  }

  if (CATEGORY_FILTER) {
    conditions.push(`category_id = '${CATEGORY_FILTER}'`);
  }

  if (LANGUAGE_FILTER) {
    if (LANGUAGE_FILTER.toLowerCase() === 'null') {
      conditions.push(`language IS NULL`);
    } else {
      conditions.push(`language = '${LANGUAGE_FILTER}'`);
    }
  }

  return conditions.length > 0 ? conditions.join(' AND ') : '';
}

// ── Helper functions ────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function formatNumber(n) {
  return n.toLocaleString();
}

function formatTime(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m${String(s % 60).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h${String(m % 60).padStart(2, '0')}m`;
}

// ── Count matching URLs ──────────────────────────────────────────────────────
async function countUrls() {
  const whereClause = buildWhereClause();
  let query = supabase.from('urls').select('id', { count: 'exact', head: true });

  if (whereClause) {
    query = query.filter(whereClause);
  }

  const { count, error } = await query;

  if (error) {
    console.error('Error counting URLs:', error.message);
    process.exit(1);
  }

  return count;
}

// ── Export URLs for preview ──────────────────────────────────────────────────
async function exportUrls(limit = 5) {
  const whereClause = buildWhereClause();
  let query = supabase.from('urls').select('id, url, title, source, approved, inactive, category_id, language');

  if (whereClause) {
    query = query.filter(whereClause);
  }

  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error('Error exporting URLs:', error.message);
    process.exit(1);
  }

  return data || [];
}

// ── Get all matching URLs in batches ─────────────────────────────────────────
async function* streamAllUrls(resumeFromId = null) {
  const whereClause = buildWhereClause();

  let processed = 0;
  let startIndex = 0;
  let hitEnd = false;

  while (!hitEnd) {
    let query = supabase
      .from('urls')
      .select('id')
      .order('id')
      .range(startIndex, startIndex + EXPORT_PAGE_SIZE - 1);

    if (whereClause) {
      query = query.filter(whereClause);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching batch:', error.message);
      throw error;
    }

    if (!data || data.length === 0) {
      hitEnd = true;
      break;
    }

    if (data.length < EXPORT_PAGE_SIZE) {
      hitEnd = true;
    }

    // If resuming, skip until we reach the resume point
    let batch = data;
    if (resumeFromId) {
      const idx = batch.findIndex((r) => r.id === resumeFromId);
      if (idx >= 0) {
        batch = batch.slice(idx + 1);
        resumeFromId = null; // Only skip for the first batch
      }
    }

    yield batch;
    startIndex += EXPORT_PAGE_SIZE;
    processed += batch.length;
  }
}

// ── Operation handlers ───────────────────────────────────────────────────────
async function handleMarkInactive(urlIds) {
  let updated = 0;
  for (let i = 0; i < urlIds.length; i += DB_BATCH_SIZE) {
    const batch = urlIds.slice(i, i + DB_BATCH_SIZE);
    const { error } = await supabase
      .from('urls')
      .update({ inactive: true })
      .in('id', batch);

    if (error) {
      console.error(`Error updating batch ${Math.floor(i / DB_BATCH_SIZE) + 1}:`, error.message);
    } else {
      updated += batch.length;
    }
  }
  return updated;
}

async function handleMarkActive(urlIds) {
  let updated = 0;
  for (let i = 0; i < urlIds.length; i += DB_BATCH_SIZE) {
    const batch = urlIds.slice(i, i + DB_BATCH_SIZE);
    const { error } = await supabase
      .from('urls')
      .update({ inactive: false })
      .in('id', batch);

    if (error) {
      console.error(`Error updating batch ${Math.floor(i / DB_BATCH_SIZE) + 1}:`, error.message);
    } else {
      updated += batch.length;
    }
  }
  return updated;
}

async function handleApprove(urlIds) {
  let updated = 0;
  for (let i = 0; i < urlIds.length; i += DB_BATCH_SIZE) {
    const batch = urlIds.slice(i, i + DB_BATCH_SIZE);
    const { error } = await supabase
      .from('urls')
      .update({ approved: true })
      .in('id', batch);

    if (error) {
      console.error(`Error updating batch ${Math.floor(i / DB_BATCH_SIZE) + 1}:`, error.message);
    } else {
      updated += batch.length;
    }
  }
  return updated;
}

async function handleUnapprove(urlIds) {
  let updated = 0;
  for (let i = 0; i < urlIds.length; i += DB_BATCH_SIZE) {
    const batch = urlIds.slice(i, i + DB_BATCH_SIZE);
    const { error } = await supabase
      .from('urls')
      .update({ approved: false })
      .in('id', batch);

    if (error) {
      console.error(`Error updating batch ${Math.floor(i / DB_BATCH_SIZE) + 1}:`, error.message);
    } else {
      updated += batch.length;
    }
  }
  return updated;
}

async function handleDelete(urlIds) {
  let deleted = 0;
  for (let i = 0; i < urlIds.length; i += DB_BATCH_SIZE) {
    const batch = urlIds.slice(i, i + DB_BATCH_SIZE);
    const { error } = await supabase
      .from('urls')
      .delete()
      .in('id', batch);

    if (error) {
      console.error(`Error deleting batch ${Math.floor(i / DB_BATCH_SIZE) + 1}:`, error.message);
    } else {
      deleted += batch.length;
    }
  }
  return deleted;
}

async function handleReassignCategory(urlIds) {
  let updated = 0;
  for (let i = 0; i < urlIds.length; i += DB_BATCH_SIZE) {
    const batch = urlIds.slice(i, i + DB_BATCH_SIZE);
    const { error } = await supabase
      .from('urls')
      .update({ category_id: REASSIGN_CATEGORY })
      .in('id', batch);

    if (error) {
      console.error(`Error updating batch ${Math.floor(i / DB_BATCH_SIZE) + 1}:`, error.message);
    } else {
      updated += batch.length;
    }
  }
  return updated;
}

async function handleUpdateLanguage(urlIds) {
  let updated = 0;
  for (let i = 0; i < urlIds.length; i += DB_BATCH_SIZE) {
    const batch = urlIds.slice(i, i + DB_BATCH_SIZE);
    const { error } = await supabase
      .from('urls')
      .update({ language: SET_LANGUAGE })
      .in('id', batch);

    if (error) {
      console.error(`Error updating batch ${Math.floor(i / DB_BATCH_SIZE) + 1}:`, error.message);
    } else {
      updated += batch.length;
    }
  }
  return updated;
}

async function handleUpdateMetadata(urlIds) {
  const updates = {};
  if (SET_TITLE !== undefined) updates.title = SET_TITLE;
  if (SET_DESCRIPTION !== undefined) updates.description = SET_DESCRIPTION;
  if (SET_OG_IMAGE !== undefined) updates.og_image_url = SET_OG_IMAGE;

  let updated = 0;
  for (let i = 0; i < urlIds.length; i += DB_BATCH_SIZE) {
    const batch = urlIds.slice(i, i + DB_BATCH_SIZE);
    const { error } = await supabase
      .from('urls')
      .update(updates)
      .in('id', batch);

    if (error) {
      console.error(`Error updating batch ${Math.floor(i / DB_BATCH_SIZE) + 1}:`, error.message);
    } else {
      updated += batch.length;
    }
  }
  return updated;
}

// ── Confirmation prompt ──────────────────────────────────────────────────────
async function promptConfirm(message) {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const startTime = Date.now();

  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║ Bulk URL Editor                                            ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  console.log(`Operation:  ${OPERATION}`);
  console.log(`Filters:    ${[SOURCE && `source=${SOURCE}`, APPROVED_FILTER && `approved=${APPROVED_FILTER}`, INACTIVE_FILTER && `inactive=${INACTIVE_FILTER}`, CATEGORY_FILTER && `category=${CATEGORY_FILTER}`, LANGUAGE_FILTER && `language=${LANGUAGE_FILTER}`].filter(Boolean).join(', ') || '(none)'}`);
  console.log(`Mode:       ${DRY_RUN ? 'DRY-RUN (preview only)' : 'COMMIT (will write to DB)'}`);
  console.log();

  // Count matching URLs
  console.log('Counting matching URLs...');
  const count = await countUrls();

  if (count === 0) {
    console.log('No URLs match the filters. Nothing to do.\n');
    process.exit(0);
  }

  console.log(`Found:      ${formatNumber(count)} URLs\n`);

  // Preview sample URLs
  console.log('Sample URLs (first 5):');
  const samples = await exportUrls(5);
  for (const row of samples) {
    console.log(`  • [${row.source}] ${row.title || row.url}`);
  }
  console.log();

  // Warn if large batch
  if (count > 1000) {
    console.log(`⚠️  WARNING: This operation affects ${formatNumber(count)} URLs. Please review carefully.\n`);
  }

  // Show operation details
  if (OPERATION === 'mark-inactive') {
    console.log(`Will mark ${formatNumber(count)} URLs as inactive (soft delete).`);
    console.log(`URLs will no longer appear in discovery, but data is preserved.\n`);
  } else if (OPERATION === 'mark-active') {
    console.log(`Will mark ${formatNumber(count)} URLs as active (restore).\n`);
  } else if (OPERATION === 'approve') {
    console.log(`Will approve ${formatNumber(count)} URLs (eligible for discovery).\n`);
  } else if (OPERATION === 'unapprove') {
    console.log(`Will unapprove ${formatNumber(count)} URLs (pending review).\n`);
  } else if (OPERATION === 'delete') {
    console.log(`Will DELETE ${formatNumber(count)} URLs (hard delete, cascades to ratings/reports/collections).\n`);
    console.log(`⚠️  WARNING: This is permanent and cannot be easily undone!\n`);
  } else if (OPERATION === 'reassign-category') {
    console.log(`Will reassign ${formatNumber(count)} URLs to category ${REASSIGN_CATEGORY}.\n`);
  } else if (OPERATION === 'update-language') {
    console.log(`Will set language to '${SET_LANGUAGE}' for ${formatNumber(count)} URLs.\n`);
  } else if (OPERATION === 'update-metadata') {
    const fields = [];
    if (SET_TITLE !== undefined) fields.push(`title="${SET_TITLE}"`);
    if (SET_DESCRIPTION !== undefined) fields.push(`description="${SET_DESCRIPTION}"`);
    if (SET_OG_IMAGE !== undefined) fields.push(`og_image_url="${SET_OG_IMAGE}"`);
    console.log(`Will update ${fields.join(', ')} for ${formatNumber(count)} URLs.\n`);
  }

  if (DRY_RUN) {
    console.log('This is a DRY-RUN. Pass --commit to apply changes.\n');
    return;
  }

  // Require confirmation if --commit without --confirm
  if (!CONFIRM) {
    const answer = await promptConfirm(`Are you sure? Type "yes" to confirm: `);
    if (!answer) {
      console.log('Operation cancelled.\n');
      process.exit(0);
    }
  }

  // Load checkpoint if resumable
  let checkpoint = null;
  if (RESUMABLE && !RESET) {
    checkpoint = loadCheckpoint();
    if (checkpoint) {
      console.log(`\nResuming from checkpoint: ${formatNumber(checkpoint.processed)}/${formatNumber(checkpoint.totalCount)} processed.\n`);
    }
  }

  // Collect all URL IDs
  console.log('Collecting URL IDs...');
  const allIds = [];
  const resumeFromId = checkpoint?.lastId || null;

  for await (const batch of streamAllUrls(resumeFromId)) {
    allIds.push(...batch.map((r) => r.id));

    // Update checkpoint periodically
    if (RESUMABLE && allIds.length % (DB_BATCH_SIZE * 10) === 0) {
      checkpoint = {
        operation: OPERATION,
        filters: { SOURCE, APPROVED_FILTER, INACTIVE_FILTER, CATEGORY_FILTER, LANGUAGE_FILTER },
        totalCount: count,
        processed: allIds.length,
        lastId: allIds[allIds.length - 1],
        startTime,
      };
      saveCheckpoint(checkpoint);
    }
  }

  console.log(`Collected ${formatNumber(allIds.length)} URL IDs.\n`);

  // Execute operation
  console.log(`Executing operation: ${OPERATION}...`);
  const opStartTime = Date.now();

  let result = 0;
  if (OPERATION === 'mark-inactive') {
    result = await handleMarkInactive(allIds);
  } else if (OPERATION === 'mark-active') {
    result = await handleMarkActive(allIds);
  } else if (OPERATION === 'approve') {
    result = await handleApprove(allIds);
  } else if (OPERATION === 'unapprove') {
    result = await handleUnapprove(allIds);
  } else if (OPERATION === 'delete') {
    result = await handleDelete(allIds);
  } else if (OPERATION === 'reassign-category') {
    result = await handleReassignCategory(allIds);
  } else if (OPERATION === 'update-language') {
    result = await handleUpdateLanguage(allIds);
  } else if (OPERATION === 'update-metadata') {
    result = await handleUpdateMetadata(allIds);
  }

  const opElapsed = formatTime(Date.now() - opStartTime);
  console.log(`\n✓ Operation complete: ${formatNumber(result)} URLs updated`);
  console.log(`  Elapsed: ${opElapsed}`);
  console.log(`  Total time: ${formatTime(Date.now() - startTime)}\n`);

  // Clean up checkpoint
  if (RESUMABLE) {
    const checkpointPath = getCheckpointPath();
    if (existsSync(checkpointPath)) {
      const fs = await import('fs');
      fs.unlinkSync(checkpointPath);
      console.log('Checkpoint cleared.\n');
    }
  }
}

// Run
main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
