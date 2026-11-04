# Glossary

Shared vocabulary for the product and the discovery scoring system. Where a term is defined more precisely elsewhere, the relevant doc is linked.

## Discovery & rating

**Discovery (a.k.a. "roam")** — Serving the next page to a user. The `roam()` RPC scores candidate URLs and returns the best match for the current user.

**Rating** — A user's up/down vote on a served page. Ratings drive both the global scores and the user's personal taste calibration.

**Wilson score** — The statistical lower bound of a URL's up/down ratio, used to rank pages with few votes conservatively. See [ALGORITHM.md](ALGORITHM.md).

**Editorial signal (seeder score)** — A manual/seeder-provided quality boost applied on top of the vote-derived score.

**Taste calibration** — Per-user, per-subcategory (and per-category) weight adjustments learned from the user's ratings, stored in `user_interest_scores` and `user_category_scores`.

**Freshness** — A recency bonus that favours newly discovered pages over stale ones.

**Exploration bonus** — A score boost for content the user hasn't seen before, promoting variety.

**Domain cooldown** — A 30-minute per-session suppression that prevents the same domain from being served repeatedly in quick succession.

**Auto-mute (domain suppression)** — After repeated downvotes on a domain, that domain is suppressed for the user for 30 days (`user_suppressed_domains`).

**Adjacent topic (serendipity)** — Discovery that occasionally surfaces content from a neighbouring category via `interest_pair_scores`.

## Categories

**Category pillar** — One of the eight top-level categories (`categories`).

**Subcategory (topic)** — A finer-grained topic under a pillar (~72 subcategories). **Pillar vs. topic interest selection** lets users choose between broad pillar discovery and focused subcategory discovery.

## Curation & collections

**Collection** — A user-saved list of URLs (public or private), stored in `collections` / `collection_items`.

**Collection mode** — A discovery mode scoped to a single collection rather than the whole catalogue.

**Focus mode** — A discovery mode that narrows results to a single category.

## Social

**Follow** — Subscribing to another user's activity (`follows`).

**Activity feed** — Recent actions by users you follow (`user_activity`).

**Profile stats** — Pages rated, submitted, and followers shown on a user's profile (`profiles`).

**URL sharing** — Sending a URL directly to another user, with push notification (`shared_urls`).

## Gamification

**XP** — Experience points earned from rating, submitting, and discovering (`xp_actions` / `xp_log`).

**Level** — Progression from 1–50 driven by accumulated XP.

**Badge** — An unlockable achievement; ~150 badges across 12 categories (`badges` / `user_badges`).

**Streak** — Consecutive days of activity (`user_daily_activity`).

**Daily challenge** — A time-boxed task (e.g. rate N URLs, explore a category) that awards bonus XP (`challenges` / `user_challenges`).

**Leaderboard** — Weekly, monthly, and all-time XP rankings (`leaderboard_snapshots`).

## Content intake

**Seeder** — A script under `scripts/` (`seed-*.mjs`) that fetches and normalises URLs from a specific source into the `urls` table.

**Moderation** — Human review of submitted URLs (`moderation_queue`) with an immutable decision log (`moderation_audit_log`).

**Paywalled domains** — Known paywalled domains (`paywalled_domains`) that are deprioritised in discovery.
