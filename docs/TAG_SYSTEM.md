# Tag System

## Status

| Item | Status |
|---|---|
| Schema (`tags`, `url_tags`, `tag_relations`, `subcategory_tag_mapping`, `tagging_jobs`) | ✅ Deployed |
| Seeded tags + subcategory→tag mappings | ✅ Deployed |
| URL tags backfilled from subcategories | ✅ Deployed |
| Legacy `url_tags` surrogate key removed | ✅ Deployed |
| Tag-boost wired into `roam()` discovery | ⏳ Pending (Phase E) |

## Tables

| Table | Purpose |
|---|---|
| `tags` | Tag definitions (slug, name, category) |
| `url_tags` | Many-to-many URL↔tag assignments; composite primary key `(url_id, tag_id)` |
| `tag_relations` | Relations between tags (parent/child, related) |
| `subcategory_tag_mapping` | Subcategory ↔ tag mapping used for backfill |
| `tagging_jobs` | Batch tagging job queue |

## Current state

The tag-graph schema was deployed in `20261008000000_tag_graph_schema.sql` with seeded tags, subcategory→tag mappings, and tag relations. URL tags were backfilled from subcategories in `20261008000004_backfill_url_tags_from_subcategories.sql`, superseding the legacy tagging system. The legacy `url_tags` table was dropped in `20260919000000_drop_legacy_url_tags.sql`, and the `url_tags` surrogate primary key was replaced with the composite key `(url_id, tag_id)` in `20261016000001_replace_url_tags_surrogate_pkey.sql` (see `RUNBOOK.md` for the rollback procedure).

## Pending work

**Wire the tag system into `roam()` (`tag_boost` — Phase E).** Per `docs/ROADMAP.md`, discovery weighting does not yet incorporate tag boost. Tags are stored and backfilled but are not used to influence which URL is served. See ROADMAP immediate next step #1.

## See also

- `supabase/SCHEMA.md` — tagging tables reference.
- `supabase/CHANGELOG.md` — tag-graph deployment history.
- `docs/ROADMAP.md` — Phase E tag-boost wiring.
- `RUNBOOK.md` — rollback procedures for tag migrations.