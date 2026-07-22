# Roam Algorithm (v17)

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

1. **Phase 1**: `TABLESAMPLE BERNOULLI(25)` — random ~25% of the table (~787k rows at current scale), no sequential scan
2. **Phase 2** (conditional): only executed when Phase 1 finds no eligible URL — top **100** by `roam_score_static` for standard mode, top **50** for collection mode

Both phases apply: `approved = TRUE`, `wilson_score > -0.1`, language match, domain suppression, paywall opt-out, not already seen.

---

## 9. Domain diversity cooldown

After each URL is served in **discovery mode** (standard, non-collection), its domain is suppressed for **30 minutes** via `user_domain_cooldowns`. Prevents the same outlet dominating a session. Not applied in collection mode or deep_dive mode.

---

## 10. Discovery mode overlays

| Mode | Behaviour |
|------|-----------|
| `discovery` (default) | 12% chance of serving from an **adjacent** subcategory (highest `pair_weight` neighbour of the user's top interest) |
| `deep_dive` | Narrows pool to user's **top-3** subcategories by `calibrated_weight` (or falls back to all allowed subcategories if none exceed 1.0) |
| Collection mode | Filters pool to URLs in the specified collection; domain cooldown not applied |
