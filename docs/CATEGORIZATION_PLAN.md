# URL Subcategory Categorization Plan

**Date:** May 5, 2026  
**Goal:** Assign `subcategory_id` to the ~60–70% of URLs that currently have `category_id` but no `subcategory_id`.

---

## Background

72 subcategories across 8 categories. Every uncategorized seeder already sets `category_id` — so we only need to resolve the subcategory level. The `categorize-urls.mjs` script implements Option A: source + URL-path rules with no network requests.

---

## Tier 1 — Whole-source mapping (100% accurate)

| Source | Subcategory |
|--------|------------|
| `nasa` | Space & Astronomy |
| `bandcamp` | Music |
| `boardgamegeek` | Board Games & Tabletop RPGs |
| `itchio` | Video Games |
| `librivox` | Literature & Writing |
| `gutenberg` | Literature & Writing |
| `wikivoyage` | Travel & Exploration |
| `lobsters` | Programming & Software Development |
| `openlibrary` | Literature & Writing |

---

## Tier 2 — URL path extraction

### Reddit (`source = 'reddit'`)
URL pattern: `reddit.com/r/{SUBREDDIT}/comments/...`

| Subreddit | Subcategory |
|-----------|------------|
| programming, webdev, devops | Programming & Software Development |
| MachineLearning | AI & Machine Learning |
| opensource | Open Source & Dev Communities |
| netsec | Cybersecurity & Privacy |
| science | Biology & Evolution |
| space | Space & Astronomy |
| Physics | Physics & Chemistry |
| biology | Biology & Evolution |
| chemistry | Physics & Chemistry |
| nutrition | Nutrition & Health |
| Fitness | Fitness & Movement |
| meditation | Mindfulness & Meditation |
| psychology | Psychology & Human Behaviour |
| mentalhealth | Mental Health & Wellbeing |
| history, AskHistorians | Modern History |
| philosophy | Philosophy & Ethics |
| geopolitics | Politics & Geopolitics |
| books, literature, writing, poetry | Literature & Writing |
| Art | Visual Art & Painting |
| design | Design & UX |
| architecture | Architecture & Urban Design |
| movies | Film & Television |
| Music | Music |
| travel, solotravel | Travel & Exploration |
| geography | Maps & Cartography |
| boardgames, chess | Board Games & Tabletop RPGs |
| DIY | Crafts, DIY & Making |
| homebrewing | Cooking & Food |

### Guardian (`source = 'guardian'`)
URL pattern: `theguardian.com/{section}/...`

| Section | Subcategory |
|---------|------------|
| science | Biology & Evolution |
| environment | Environment & Climate |
| technology | Programming & Software Development |
| books | Literature & Writing |
| film | Film & Television |
| music | Music |
| artanddesign | Visual Art & Painting |
| fashion | Fashion & Textiles |
| world, politics | Politics & Geopolitics |
| business | Economics & Economic History |
| society | Social History & Movements |
| lifeandstyle | Personal Development & Habits |
| travel | Travel & Exploration |
| cities | Cities & Urban Life |
| sport | Sports & Athletics |
| food | Cooking & Food |
| games | Video Games |
| culture | *(too broad — skipped)* |

### Smithsonian (`source = 'smithsonian'`)
Uses existing `category_id` to determine subcategory:

| Category | Subcategory |
|----------|------------|
| Arts & Culture | Visual Art & Painting |
| History & Ideas | Anthropology & Archaeology |
| Science & Nature | Paleontology & Natural History |

---

## Not classifiable via Option A

These sources have no reliable signal in `source` or `url`:

| Source | Problem |
|--------|---------|
| `hackernews` | URL is `news.ycombinator.com/item?id=xxx` — no content signal. Revisit later. |
| `wiby`, `kagisweb`, `marginalia` | General web search — spans all categories |
| `substack` | Each newsletter is a different topic |
| `kottke`, `longform` | Curated links from all domains |
| `pinboard` | Tags not stored in DB |
| `awesome`, `github` | Topic known at seed time but not stored in URL record |
| `propublica`, `nyt` | Varied news desks |
| `semanticscholar` | Papers across all science fields |
| `lesswrong` | Philosophy/AI/rationality mix |
| `internetarchive` | Query-dependent |
| `europeana` | Mixed art/history per query |
| `ted` | TED covers everything; slug keywords insufficient |
| `npr` | Section not encoded in article URL |
| `loc` | URL doesn't encode subject |

---

## Coverage Estimate

| Tier | Sources | Est. URLs classified |
|------|---------|---------------------|
| Tier 1 (whole-source) | 9 | ~150–250k |
| Tier 2 URL path (reddit, guardian, smithsonian) | 3 | ~300–600k |
| **Option A total** | ~12 sources | **~30–40% of uncategorized pool** |
| Remaining (need LLM/Option B) | ~17 sources | ~60–70% |

---

## Future: Option B — LLM classification

For the remaining sources, feed `title + description` to an LLM with the subcategory list. Estimated cost at 3M URLs: $50–200 depending on model and batch pricing. Target sources: hackernews, substack, kottke, ted, npr, nyt, wiby, longform.

---

## Script

`scripts/categorize-urls.mjs` — 3-phase resumable tool:
1. Export all `subcategory_id IS NULL` URLs
2. Classify via rules (pure CPU, no network)
3. Commit — batch UPDATE in groups of 500
