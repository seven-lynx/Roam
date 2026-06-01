# Roam Seeding Scripts — Testing Guide

This guide covers quick validation for the seeding and cleanup scripts in `scripts/`.

## 1. Environment validation

Run the environment check before touching any live data.

```bash
cd scripts
node validate-env.mjs
```

## 2. Seeder dry runs

Prefer dry runs first so you can verify normalization and deduplication without writing to the database.

```bash
node seed-wikipedia.js --dry-run
node seed-guardian.js --dry-run
node seed-reddit.js --dry-run
```

## 3. Dead link checker

Use the PowerShell wrapper for the dead-link pipeline.

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\Seito\Github\roam\scripts\run-dead-link-checker.ps1" --concurrency 50
```

Validation points:
- The run resumes from `scripts/.cache/` if interrupted.
- Dry runs should report findings without committing them.
- `--commit` should only be used after reviewing the results.

## 4. Categorization / backfill scripts

```bash
node categorize-urls.mjs --dry-run
node backfill-og-metadata.mjs --dry-run
```

Check that:
- Source rules produce the expected `subcategory_id` values.
- The script can resume from cached state.
- No unexpected rows are updated in dry-run mode.

## 5. Expected outputs

- Seeder logs should show counts inserted, skipped, and deduplicated.
- Cleanup scripts should clearly state when rows are marked inactive.
- Any API failures should fail fast with actionable messages.