# Roam Algorithm (v17)

**Last Updated:** 2026-11-07

> **Version note:** This document describes the scoring model at **v17**. Production discovery currently runs **v31–v35** (see `supabase/CHANGELOG.md` and `extension/CHANGELOG.md` for the version history). The scoring formula (Wilson score, calibrated weight, freshness, exploration bonus) is unchanged; what changed is the candidate-pool sampling and the pool-empty guard, noted in §8.

## Compact form

```
W = ( p̂ + z²/2n − z√((p̂(1−p̂))/n + z²/4n²) ) / (1 + z²/n)

C = clamp( (u𝜏 / (u𝜏 + d𝜏)) / 0.5,  0.4, 2.0 )

F = { published_at known → max(exp(−0.001·t), 0.2)
    { published_at NULL  → 0.7                        half-life ≈ 2 yrs, floor 0.2

E = (W + 0.3·S + 0.15·[n=0]) · C · F

rank = (E + 0.1) · r  →  argmax  →  pick URL
```

**Legend**

| Symbol        | Meaning |
|---------------|---------|
| p̂            | upvote rate for this URL = u / n |
| n             | total votes on this URL = u + d |
| u, d          | upvotes, downvotes on this URL |
| z             | 1.96 (95% confidence) |
| W ∈ [0,1]    | Wilson score (community quality) |
| S ∈ [0,1]    | seeder score (source quality, set at ingest) |
| u𝜏, d𝜏       | your upvotes / downvotes in topic τ |
| C ∈ [0.4, 2] | your interest weight for topic τ |
| t             | age in days since published_at |
| F ∈ [0.2, 1] | freshness multiplier |
| [n=0]         | 1 if URL has no votes yet, else 0 (exploration bonus) |
| E             | effective score |
| r ~ U(0,1)   | random jitter |

**Seeder score denominators**

| Source           | Denominator  | Rationale |
|------------------|--------------|-----------|
| Hacker News      | 1500 pts     | strong front-page post |
| Reddit           | 2000 pts     | strong post across tracked subreddits |
| LessWrong        | 500 karma    | top-tier post |
| Semantic Scholar | 500 cites    | highly cited paper |
| GitHub           | 10000 stars  | top-tier repository |

---

## 1. Wilson Score — content quality signal

Computed by trigger on every vote insert/update/delete. Uses the **Wilson score lower confidence bound** at 95% (z = 1.96):

```
W = (p̂ + z²/2n − z√((p̂(1−p̂) + z²/4n) / n)) / (1 + z²/n)
```

where `p̂ = upvotes / n`, `n = upvotes + downvotes`. Defaults to `0` with no votes.

---

## 2. Seeder Score — editorial quality signal

A normalised [0, 1] float set at ingest time, based on each source's social signal:

| Source           | Formula                              |
|------------------|--------------------------------------|
| Hacker News      | `min(points / 1500, 1.0)`            |
| Reddit           | `min(score / 2000, 1.0)`             |
| LessWrong        | `min(baseScore / 500, 1.0)`          |
| Semantic Scholar | `min(citationCount / 500, 1.0)`      |
| GitHub           | `min(stargazers_count / 10000, 1.0)` |
| All others       | `0.0`                                |

---

## 3. Calibrated Weight — personalisation multiplier

Maintained per `(user_id, subcategory_id)` by trigger on every rating:

```
C = (upvote_count / (upvote_count + downvote_count)) / 0.5
```

Clamped to [0.4, 2.0] at query time. Cold start = `1.0`.

Examples: 80% upvote rate → `1.6×`, 50% → `1.0×`, 30% → `0.6×`.

---

## 4. Freshness Multiplier

Applied per URL using `published_at`:

```
F = max(exp(−0.001 · t), 0.2)    if published_at is known
F = 0.7                           if published_at is NULL
```

`t` = age in days. Half-life ≈ 693 days (~2 years). Floor of `0.2` keeps evergreen content (Wikipedia, classic essays) surfacing. `NULL` gets a mild `0.7` penalty rather than full score or full penalty.

---

## 5. Exploration Bonus

URLs with **zero votes** receive `+0.15` added to their base score. The bonus disappears after the first vote, handing control back to Wilson score. Prevents newly seeded content from being permanently invisible.

---

## 6. Effective Score

```
E = (W + 0.3·S + 0.15·[n=0]) · C · F
```

The `0.3` coefficient means seeder_score contributes at most `0.3` to the base, so community voting dominates once a URL has ratings. `[n=0]` is 1 when the URL has no votes yet, else 0.

The base `W + 0.3·S` is precomputed into a `roam_score_static` column and kept current by a trigger on every vote. The query uses `roam_score_static` directly to avoid per-row arithmetic across the TABLESAMPLE pool.

---

## 7. Stochastic selection

```sql
ORDER BY (E + 0.1) * random() DESC
LIMIT 1
```

The `+0.1` floor prevents zero-score URLs from being permanently buried.

---

## 8. Candidate pool — TABLESAMPLE + conditional fallback

1. **Phase 1**: `TABLESAMPLE SYSTEM(2)` — a ~2% block sample of the table, so a large pool is decided from ~20k candidate rows (measured 1,019 ms on 990k approved URLs; v37)
2. **Phase 2** (conditional): only executed when Phase 1 finds no eligible URL, **and only after a strict probe confirms that at least one row can actually be served**. Takes an unordered `LIMIT 500` in both standard and collection mode (v37; it was top-500 `ORDER BY roam_score_static DESC`, which turned the branch into an index walk over every row in the table — 990,968 rows, 44,320 ms to produce zero rows — because it cannot stop early when fewer than 500 candidates exist, which is the only state it ever runs in. Unordered is bounded at 1,381 ms; the outer query still weights by `eff_score * (0.7 + 0.3·random())`)
3. **Pool-empty guard**: if both phases return no eligible URL, a single `EXISTS` probe decides between "genuinely empty" and "nothing available right now" (every domain still cooling down), and the wider `SYSTEM(5)` retry only runs when the probe found something that could be served. Never report "you've seen everything" for a query that timed out or scanned in vain (added in v31–v35; the probe is v37, issue #118)

Both phases apply: `approved = TRUE`, `wilson_score > -0.1`, language match, domain suppression, paywall opt-out, not already seen. The `roam_score_static` column is precomputed by a trigger on every vote and kept current, so the query avoids per-row arithmetic across the TABLESAMPLE pool.

---

## 9. Domain diversity cooldown

After each URL is served in **discovery mode** (standard, non-collection), its domain is suppressed for **24 hours** via `user_domain_cooldowns`. Prevents the same outlet dominating a session. Not applied in collection mode or deep_dive mode. (This is the mechanism that can make a narrow scope go permanently empty: 198 domains, 94 serves a minute, and no served URL can ever be served from a cooled domain again — see issue #118.)

**A prefetch no longer cools anything (v38, issue #122).** The cooldown — and the `seen_urls` row beside it — is written by `mark_url_seen()`, which `roam()` calls only when the transaction-local `roam.prefetch` flag is off. Prefetch calls go through `roam_prefetch()`, which sets that flag: they return URLs and record nothing. The state is created when the URL *reaches the screen*, which for a buffered URL is the client's job (`roamBufferNext()` on the web, the hot-queue pop on Android). Before v38 every prefetched URL cooled its whole domain for a day, so the deck could lock out a narrow scope in twelve reads — that is the "94 serves a minute" state above.

---

## 10. Discovery mode overlays

| Mode | Behaviour |
|------|-----------|
| `discovery` (default) | 12% chance of serving from an **adjacent** subcategory (highest `pair_weight` neighbour of the user's top interest) |
| `deep_dive` | Narrows pool to user's **top-3** subcategories by `calibrated_weight` (or falls back to all allowed subcategories if none exceed 1.0) |
| Collection mode | Filters pool to URLs in the specified collection; domain cooldown not applied |