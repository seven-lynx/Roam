# StumbleUpon URL Capture Expansion Plan

> **Goal:** Broaden the pool of StumbleUpon-sourced URLs in Roam by tapping new data sources and expanding existing ones.
>
> **Created:** 2026-07-18
> **Status:** In Progress

---

## Current State Summary

The existing `scripts/seed-stumbleupon.mjs` taps **6 data sources**:

| # | Source | Status | Est. URLs | Notes |
|---|--------|--------|-----------|-------|
| 1 | Kaggle Evergreen | ✅ Done | ~7,400 | Fixed dataset; no expansion possible |
| 2 | Social-ODP-2k9 | ✅ Done | ~100k+ | Requires manual academic download |
| 3 | Wayback CDX API | ✅ Done (capped) | ~50k | Hard-coded `limit=50000`, no pagination |
| 4 | ASU DMML | ✅ Done | unknown | Obscure academic dataset |
| 5 | StumbleUponAwesome | ✅ Done | curated | Already fully extracted |
| 6 | Fallover (l3gacyb3ta) | ✅ Done | large | Static dump; no further expansion |

---

## Phase 1 — Quick Wins (Hours of work, large yield)

### 1A. Remove the 50k CDX cap & add pagination

- [ ] Modify `fetchWaybackCdx()` in `scripts/seed-stumbleupon.mjs` to iterate pages
- [ ] Add `maxCdxPages` config (default 20 = ~1M URLs)
- [ ] Stop when fewer than `limit` results are returned or ceiling hit
- [ ] Add resume checkpoint for CDX pagination (in case of crash mid-fetch)

**Expected yield:** 300k–1M additional URLs

### 1B. Add year-range batching to CDX queries

- [ ] Query CDX year-by-year (2001–2018 = 18 buckets) to bypass result caps
- [ ] Each bucket retrieves up to 50k URLs that would be hidden in broad query
- [ ] Enrich rows with `published_at` based on CDX timestamp
- [ ] Add `--source=wayback-yearly` flag for targeted runs

**Expected yield:** 200k–600k additional unique URLs

### 1C. GitHub search scraper for StumbleUpon URL dumps

- [ ] Create `scripts/extract-stumbleupon-github.mjs`
- [ ] Use GitHub Search API (or scrape) for queries:
  - `"stumbleupon.com"` in JSON/CSV/TSV/markdown files
  - Repos named `stumbleupon-*`, `su-favorites`, `stumbleupon-backup`
  - Gist dumps of personal StumbleUpon history
- [ ] Parse discovered files for URLs, extract titles where possible
- [ ] Cache to `scripts/.cache/stumbleupon-github.json`
- [ ] Add `--source=github` flag to `seed-stumbleupon.mjs`

**Expected yield:** 5k–50k URLs

---

## Phase 2 — Medium Effort (Days of work, medium yield)

### 2A. Common Crawl extractor

- [ ] Create `scripts/extract-stumbleupon-commoncrawl.mjs`
- [ ] Query Common Crawl Index API (`index.commoncrawl.org`) for:
  - All pages on `stumbleupon.com` domain
  - All outlinks from pages containing `stumbleupon.com/url/` patterns
- [ ] Iterate over monthly crawl indices (2008–2024)
- [ ] Extract destination URLs from SU redirect paths
- [ ] Cache to `scripts/.cache/stumbleupon-commoncrawl.json`
- [ ] Add `--source=commoncrawl` flag

**Expected yield:** 500k–2M URLs

### 2B. Reddit thread scraper (Pushshift API)

- [ ] Create `scripts/extract-stumbleupon-reddit.mjs`
- [ ] Search Pushshift for:
  - `/r/StumbleUpon` posts containing URLs
  - `/r/internetnostalgia` threads about SU shutdown
  - `/r/DataHoarder` posts about SU archives
- [ ] Extract URLs from post bodies and comments
- [ ] Deduplicate and cache to `scripts/.cache/stumbleupon-reddit.json`
- [ ] Add `--source=reddit` flag

**Expected yield:** 1k–10k high-quality, human-curated URLs

### 2C. Archive.org dedicated collections search

- [ ] Research Archive.org for dedicated StumbleUpon crawls beyond CDX
- [ ] Look for ArchiveTeam collections and structured data exports
- [ ] Create extractor if structured data is found
- [ ] Add corresponding `--source=` flag

**Expected yield:** variable, worth investigating

---

## Phase 3 — Enrichment & Curation

### 3A. Fallover dataset keyword-to-category enrichment

- [ ] Analyze Fallover keywords to auto-categorize URLs
- [ ] Build keyword→category mapping table similar to Awesome extractor
- [ ] Re-process Fallover URLs with new category assignments
- [ ] Currently all Fallover URLs → ODDITIES_CURIOSITIES (wasteful)

**Expected yield:** better category distribution for existing URLs

### 3B. StumbleUpon browser extension unpacking

- [ ] Locate original SU Firefox .xpi and Chrome .crx extensions
- [ ] Unpack (ZIP format) and search for:
  - Hardcoded category/topic lists
  - Default/starter URL lists
  - Recommendation cache data
- [ ] Extract any embedded URLs and add as new source

**Expected yield:** unknown but historically significant

---

## Phase 4 — Longer-Term / Research

### 4A. Delicious/Pinboard bookmarks tagged "stumbleupon"

- [ ] Search Pinboard API for `stumbleupon` tag
- [ ] Search Delicious archive dumps for SU-tagged bookmarks
- [ ] Extract URLs with titles and user-applied tags

### 4B. Data hoarder / torrent communities

- [ ] Search /r/DataHoarder and related forums for SU database dumps
- [ ] Check academic torrent sites for "StumbleUpon" datasets
- [ ] Check MEGA/drive shares referenced in archival communities

### 4C. Academic papers citing StumbleUpon datasets

- [ ] Google Scholar search: "StumbleUpon dataset" (2007–2018)
- [ ] Locate supplementary data from papers studying SU's algorithm
- [ ] Check for datasets hosted on university repositories

### 4D. Fallover keyword-driven discovery

- [ ] Use Fallover keywords to query Wikipedia API for related articles
- [ ] Use keywords to search Wayback CDX for related content
- [ ] Cross-reference with existing Roam categories for enrichment

---

## Implementation Notes

### Pattern for New Extractors

All new extractors follow the existing architecture:

1. **Extractor script** (`scripts/extract-stumbleupon-{source}.mjs`)
   - Fetch/parse source → produce normalized JSON array
   - Cache to `scripts/.cache/stumbleupon-{source}.json`
   - Each row: `{ url, title?, description?, category_id, subcategory_id, source, seeder_score }`

2. **Seeder integration** in `scripts/seed-stumbleupon.mjs`
   - Add new `--source={name}` flag
   - Add `parseStumbleUpon{Name}()` function
   - Reads from cache JSON, feeds to `upsertUrls()`

3. **Quality gates** (provided by `upsertUrls` pipeline):
   - URL normalization & dedup
   - Domain blocklist filtering
   - Liveness HEAD check (15 concurrent)
   - OG metadata fetch (8 concurrent)
   - Title quality gate
   - Batch upsert with logging

### Usage Examples (target state)

```bash
# Phase 1 — Quick wins
node scripts/seed-stumbleupon.mjs --source=wayback-paginated --max-pages=20
node scripts/seed-stumbleupon.mjs --source=wayback-yearly
node scripts/seed-stumbleupon.mjs --source=github

# Phase 2 — Medium effort
node scripts/seed-stumbleupon.mjs --source=commoncrawl
node scripts/seed-stumbleupon.mjs --source=reddit

# All sources (existing + new)
node scripts/seed-stumbleupon.mjs                    # all sources, caches results
node scripts/seed-stumbleupon.mjs --dry-run          # parse only, don't insert
node scripts/seed-stumbleupon.mjs --no-cache         # re-fetch from all sources
```

---

## Progress Log

| Date | Task | Status |
|------|------|--------|
| 2026-07-18 | Plan created | ✅ |
| 2026-07-18 | 1A: CDX pagination | ✅ (--source=wayback-paginated, checkpoint/resume, rate-limit handling) |
| 2026-07-18 | 1B: CDX year-range batching | ✅ (--source=wayback-yearly, 18 buckets 2001-2018) |
| 2026-07-18 | 1C: GitHub scraper | ✅ (--source=github, searches repos/gists/code for SU dumps) |
| 2026-07-18 | 2A: Common Crawl extractor | ✅ (--source=commoncrawl, ~150 CC indices 2013-2024) |
| 2026-07-18 | 2B: Reddit scraper | ✅ (--source=reddit, Pushshift API, 7 query groups) |
| — | 2C: Archive.org collections | ⬜ (research task) |
| 2026-07-18 | 3A: Fallover enrichment | ✅ (scripts/enrich-stumbleupon-fallover.mjs — keyword→subcategory mapping) |
| 2026-07-18 | 3B: Extension unpacking | ✅ (--source=extension, unpacks .xpi/.crx, scans HTML/JS/JSON for URLs) |
| — | 4A: Pinboard/Delicious | ⬜ (future) |
| — | 4B: Data hoarder communities | ⬜ (future) |
| — | 4C: Academic papers | ⬜ (future) |
| — | 4D: Keyword-driven discovery | ⬜ (future) |
