# New Seeder Sources Plan

## Goal
Diversify data sources beyond the existing 50+ seeders. Current seeders heavily rely on Wikipedia, Wayback Machine of common sites, museum APIs, and RSS feeds. Need fresh, unique sources nobody else is scraping.

## Existing Source Backbone (what we already have)
- Wikipedia API (seed-wikipedia.js, seed-wikivoyage.js)
- Wayback Machine CDX (seed-iflscience.mjs, seed-atlasobscura.mjs, seed-kottke.mjs, etc.)
- Curlie/DMOZ dump (seed-curlie.js)
- Museum/gov APIs (Met, Smithsonian, LOC, DPLA, Europeana, Flickr Commons, NASA)
- RSS feeds (Atlantic, New Yorker, Longform, Quanta, Nautilus, Kottke, Substack)
- Academic APIs (arXiv, PubMed, Semantic Scholar, SEP)
- GitHub awesome lists / search
- Social/news aggregators (HN, Lobste.rs, Reddit, Pinboard, Mastodon)
- Project Gutenberg / LibriVox / OpenLibrary
- NPR / Guardian / NYT / ProPublica APIs
- BoardGameGeek / itch.io / Bandcamp
- Kagi Small Web / Wiby / Marginalia / Cloudhiker

---

## Seeding Results Log

| Date | Seeder | Result | Inserted | Notes |
|---|---|---|---|---|
| 2026-06-13 | seed-iflscience.mjs | SUCCESS | 987 | 987 passed liveness, 0 dead. Inserted across 6 subcategories (space:6, environment:270, technology:193, health-and-medicine:267, the-brain:3, plants-and-animals:248). Fetched metadata from Wayback Machine snapshots. |
| 2026-06-13 | seed-federalreserve.mjs | FAILED | 0 | All 414 cached URLs failed liveness check (site unreachable). No data inserted. Site may be blocked or down. |

---

## All Proposed Seeders (29 total, priority-ordered)

### Priority 1 — High Impact

#### 1. seed-sports-reference.mjs — Sports Reference family
- **Category:** GAMES_HOBBIES → SPORTS_ATHLETICS
- **Sources:** baseball-reference.com, basketball-reference.com, pro-football-reference.com, hockey-reference.com, fbref.com (soccer)
- **Content:** Player biographies, team histories, championship recaps, Hall of Fame profiles, notable season summaries
- **Access:** Direct HTML scrape — no API, minimal bot protection, robots.txt allows crawling
- **Volume:** 5,000–10,000+ pages
- **Pattern:** Direct scrape — HTML parsing

#### 2. seed-investopedia.mjs — Investopedia
- **Category:** HISTORY_IDEAS → ECONOMICS_HISTORY
- **Sources:** investopedia.com
- **Content:** Encyclopedia of finance terms, investing concepts, economic explainers, market history
- **Access:** Wayback CDX — Cloudflare-protected live, but Wayback snapshots work
- **Volume:** 10,000+ articles
- **Pattern:** Wayback CDX — follows seed-iflscience.mjs pattern

#### 3. seed-jalopnik.mjs — Jalopnik
- **Category:** GAMES_HOBBIES → (collecting/motorsport) + TECHNOLOGY → HARDWARE_ELECTRONICS
- **Sources:** jalopnik.com
- **Content:** Car culture, automotive engineering, motorsport coverage, industry analysis
- **Access:** Wayback CDX
- **Volume:** 3,000+ articles
- **Pattern:** Wayback CDX — follows seed-iflscience.mjs pattern

#### 4. seed-polygon.mjs — Polygon
- **Category:** GAMES_HOBBIES → VIDEO_GAMES
- **Sources:** polygon.com
- **Content:** Game reviews, gaming culture, retrospectives, developer interviews
- **Access:** Wayback CDX
- **Volume:** 5,000+ articles
- **Pattern:** Wayback CDX — follows seed-iflscience.mjs pattern

#### 5. seed-natgeo.mjs — National Geographic
- **Category:** PEOPLE_PLACES → TRAVEL_EXPLORATION + CITIES_URBAN_LIFE
- **Sources:** nationalgeographic.com
- **Content:** Travel, exploration, cultural anthropology, photography, geography
- **Access:** Wayback CDX
- **Volume:** 5,000+ articles
- **Pattern:** Wayback CDX — follows seed-iflscience.mjs pattern

#### 6. seed-federalreserve.mjs — Federal Reserve History
- **Category:** HISTORY_IDEAS → ECONOMICS_HISTORY
- **Sources:** federalreservehistory.org
- **Content:** Central banking history, economic crises, monetary policy explainers, biographies of Fed chairs
- **Access:** Direct scrape — public .gov-adjacent site, no bot protection
- **Volume:** 500+ in-depth articles
- **Pattern:** Direct scrape — sitemap-based discovery
- **Status:** FAILED (2026-06-13) — all 414 URLs dead/unreachable

#### 7. seed-bringatrailer.mjs — Bring a Trailer
- **Category:** GAMES_HOBBIES → COLLECTING
- **Sources:** bringatrailer.com
- **Content:** Collector car auction deep-dives with model history, specifications, restoration notes, community commentary
- **Access:** Wayback CDX
- **Volume:** 5,000+ listings with editorial content
- **Pattern:** Wayback CDX — follows seed-iflscience.mjs pattern

### Priority 2 — Sports (6 more)

#### 8. seed-ringer-sports.mjs — The Ringer (sports section)
- **Category:** GAMES_HOBBIES → SPORTS_ATHLETICS
- **Sources:** theringer.com
- **Content:** Long-form sports journalism, cultural analysis, athlete profiles
- **Access:** Wayback CDX
- **Volume:** 2,000+ articles
- **Pattern:** Wayback CDX

#### 9. seed-espn.mjs — ESPN Editorial
- **Category:** GAMES_HOBBIES → SPORTS_ATHLETICS
- **Sources:** espn.com (editorial/feature sections)
- **Content:** Feature stories, athlete profiles, sports history, investigative pieces
- **Access:** Wayback CDX
- **Volume:** 5,000+ articles
- **Pattern:** Wayback CDX

#### 10. seed-deadspin.mjs — Deadspin
- **Category:** GAMES_HOBBIES → SPORTS_ATHLETICS + WEIRD_WONDERFUL → ABSURDIST_HUMOUR
- **Sources:** deadspin.com
- **Content:** Sports meets culture, weird sports stories, irreverent takes
- **Access:** Wayback CDX
- **Volume:** 1,500+ articles
- **Pattern:** Wayback CDX

#### 11. seed-olympics.mjs — Olympics.org
- **Category:** GAMES_HOBBIES → SPORTS_ATHLETICS + HISTORY_IDEAS → MODERN_HISTORY
- **Sources:** olympics.com
- **Content:** Olympic Games history, athlete profiles, event records, host city stories
- **Access:** Direct scrape — public site
- **Volume:** 3,000+ articles
- **Pattern:** Direct scrape

#### 12. seed-sbnation.mjs — SBNation
- **Category:** GAMES_HOBBIES → SPORTS_ATHLETICS
- **Sources:** sbnation.com (300+ team blogs)
- **Content:** Deep fan content, team analysis, sports culture
- **Access:** Wayback CDX
- **Volume:** Massive — 10,000+ articles
- **Pattern:** Wayback CDX

#### 13. seed-theathletic.mjs — The Athletic
- **Category:** GAMES_HOBBIES → SPORTS_ATHLETICS
- **Sources:** theathletic.com
- **Content:** Premium sports journalism — football, soccer, basketball, Formula 1, baseball
- **Access:** Wayback CDX (paywall bypass)
- **Volume:** 3,000+ articles
- **Pattern:** Wayback CDX

### Priority 3 — Cars (5 more)

#### 14. seed-hagerty.mjs — Hagerty
- **Category:** GAMES_HOBBIES → COLLECTING + TECHNOLOGY → HARDWARE_ELECTRONICS
- **Sources:** hagerty.com
- **Content:** Classic car valuations, restoration guides, automotive history, collector profiles
- **Access:** Wayback CDX
- **Volume:** 2,000+ articles
- **Pattern:** Wayback CDX

#### 15. seed-petrolicious.mjs — Petrolicious
- **Category:** GAMES_HOBBIES → COLLECTING + ARTS_CULTURE → VISUAL_ART
- **Sources:** petrolicious.com
- **Content:** Enthusiast car culture, automotive design appreciation, owner stories
- **Access:** Wayback CDX
- **Volume:** 500+ articles
- **Pattern:** Wayback CDX

#### 16. seed-roadandtrack.mjs — Road & Track
- **Category:** GAMES_HOBBIES → SPORTS_ATHLETICS (motorsport) + TECHNOLOGY → HARDWARE_ELECTRONICS
- **Sources:** roadandtrack.com
- **Content:** Motorsport coverage, car reviews, automotive technology, racing history
- **Access:** Wayback CDX
- **Volume:** 2,000+ articles
- **Pattern:** Wayback CDX

#### 17. seed-thedrive.mjs — The Drive
- **Category:** TECHNOLOGY → HARDWARE_ELECTRONICS + GAMES_HOBBIES → COLLECTING
- **Sources:** thedrive.com
- **Content:** Car tech deep-dives, engineering explainers, industry news, restoration
- **Access:** Wayback CDX
- **Volume:** 1,500+ articles
- **Pattern:** Wayback CDX

#### 18. seed-hemmings.mjs — Hemmings
- **Category:** GAMES_HOBBIES → COLLECTING + HISTORY_IDEAS → SOCIAL_HISTORY
- **Sources:** hemmings.com
- **Content:** Classic car market, restoration stories, automotive history, auction coverage
- **Access:** Wayback CDX
- **Volume:** 2,000+ articles
- **Pattern:** Wayback CDX

### Priority 4 — Money (5 more)

#### 19. seed-planetmoney.mjs — Planet Money / The Indicator
- **Category:** HISTORY_IDEAS → ECONOMICS_HISTORY + MIND_BODY → PERSONAL_DEVELOPMENT
- **Sources:** NPR API (planet money + the indicator podcasts)
- **Content:** Economics explainers, behavioral economics stories, money in everyday life
- **Access:** NPR API (existing key)
- **Volume:** 500+ episodes with transcripts
- **Pattern:** API — reuses NPR infrastructure

#### 20. seed-nerdwallet.mjs — NerdWallet
- **Category:** HISTORY_IDEAS → ECONOMICS_HISTORY + MIND_BODY → PERSONAL_DEVELOPMENT
- **Sources:** nerdwallet.com
- **Content:** Personal finance explainers, investing guides, credit education, tax tips
- **Access:** Wayback CDX
- **Volume:** 1,500+ articles
- **Pattern:** Wayback CDX

#### 21. seed-freakonomics.mjs — Freakonomics
- **Category:** HISTORY_IDEAS → ECONOMICS_HISTORY + WEIRD_WONDERFUL → ODDITIES_CURIOSITIES
- **Sources:** freakonomics.com
- **Content:** Counterintuitive economics stories, behavioral science, hidden side of everything
- **Access:** Wayback CDX
- **Volume:** 500+ articles
- **Pattern:** Wayback CDX

#### 22. seed-coindesk.mjs — CoinDesk
- **Category:** TECHNOLOGY → EMERGING_TECHNOLOGY + HISTORY_IDEAS → ECONOMICS_HISTORY
- **Sources:** coindesk.com
- **Content:** Cryptocurrency explainers, blockchain technology, digital money history
- **Access:** Wayback CDX
- **Volume:** 2,000+ articles
- **Pattern:** Wayback CDX

#### 23. seed-bloomberg.mjs — Bloomberg Editorial
- **Category:** HISTORY_IDEAS → ECONOMICS_HISTORY + PEOPLE_PLACES → BIOGRAPHIES_PROFILES
- **Sources:** bloomberg.com (features/opinion section)
- **Content:** Market analysis, business profiles, financial history, economic commentary
- **Access:** Wayback CDX
- **Volume:** 2,000+ articles
- **Pattern:** Wayback CDX

### Priority 5 — Games (4 more)

#### 24. seed-kotaku.mjs — Kotaku
- **Category:** GAMES_HOBBIES → VIDEO_GAMES + ARTS_CULTURE → SCIFI_FANTASY
- **Sources:** kotaku.com
- **Content:** Gaming news, culture deep-dives, retrospectives, industry analysis
- **Access:** Wayback CDX
- **Volume:** 5,000+ articles
- **Pattern:** Wayback CDX

#### 25. seed-rockpapershotgun.mjs — Rock Paper Shotgun
- **Category:** GAMES_HOBBIES → VIDEO_GAMES
- **Sources:** rockpapershotgun.com
- **Content:** PC gaming coverage, indie game discovery, developer interviews, hardware guides
- **Access:** Wayback CDX
- **Volume:** 3,000+ articles
- **Pattern:** Wayback CDX

#### 26. seed-eurogamer.mjs — Eurogamer / Digital Foundry
- **Category:** GAMES_HOBBIES → VIDEO_GAMES + TECHNOLOGY → HARDWARE_ELECTRONICS
- **Sources:** eurogamer.net, digitalfoundry.net
- **Content:** Technical game analysis, performance deep-dives, gaming hardware reviews
- **Access:** Wayback CDX
- **Volume:** 2,000+ articles
- **Pattern:** Wayback CDX

#### 27. seed-mobygames.mjs — MobyGames
- **Category:** GAMES_HOBBIES → VIDEO_GAMES + ARTS_CULTURE → COMICS_ILLUSTRATION
- **Sources:** mobygames.com
- **Content:** Game database with reviews, trivia, credits, box art history
- **Access:** Direct scrape — public database
- **Volume:** Massive — tens of thousands
- **Pattern:** Direct scrape — structured HTML parsing

### Priority 6 — People & Places (3 more)

#### 28. seed-lonelyplanet.mjs — Lonely Planet
- **Category:** PEOPLE_PLACES → TRAVEL_EXPLORATION + CITIES_URBAN_LIFE
- **Sources:** lonelyplanet.com
- **Content:** Destination guides, travel stories, cultural insights
- **Access:** Wayback CDX
- **Volume:** 3,000+ articles
- **Pattern:** Wayback CDX

#### 29. seed-afar.mjs — AFAR
- **Category:** PEOPLE_PLACES → TRAVEL_EXPLORATION + PEOPLE_PLACES → INDIGENOUS_CULTURES
- **Sources:** afar.com
- **Content:** Immersive travel, cultural experiences, off-the-beaten-path destinations
- **Access:** Wayback CDX
- **Volume:** 1,000+ articles
- **Pattern:** Wayback CDX

#### 30. seed-roadtrippers.mjs — Roadtrippers
- **Category:** PEOPLE_PLACES → TRAVEL_EXPLORATION + WEIRD_WONDERFUL → UNUSUAL_PLACES
- **Sources:** roadtrippers.com
- **Content:** Road trip routes, roadside attractions, Americana, hidden gems
- **Access:** Wayback CDX
- **Volume:** 1,000+ articles
- **Pattern:** Wayback CDX

---

## Implementation Summary

| # | Seeder | Category | Pattern | Volume |
|---|---|---|---|---|
| 1 | seed-sports-reference.mjs | SPORTS_ATHLETICS | Direct scrape | 5k–10k |
| 2 | seed-investopedia.mjs | ECONOMICS_HISTORY | Wayback CDX | 10k+ |
| 3 | seed-jalopnik.mjs | Cars (motorsport + hardware) | Wayback CDX | 3k+ |
| 4 | seed-polygon.mjs | VIDEO_GAMES | Wayback CDX | 5k+ |
| 5 | seed-natgeo.mjs | TRAVEL_EXPLORATION | Wayback CDX | 5k+ |
| 6 | seed-federalreserve.mjs | ECONOMICS_HISTORY | Direct scrape | 500+ |
| 7 | seed-bringatrailer.mjs | COLLECTING | Wayback CDX | 5k+ |
| 8 | seed-ringer-sports.mjs | SPORTS_ATHLETICS | Wayback CDX | 2k+ |
| 9 | seed-espn.mjs | SPORTS_ATHLETICS | Wayback CDX | 5k+ |
| 10 | seed-deadspin.mjs | SPORTS + WEIRD | Wayback CDX | 1.5k+ |
| 11 | seed-olympics.mjs | SPORTS + HISTORY | Direct scrape | 3k+ |
| 12 | seed-sbnation.mjs | SPORTS_ATHLETICS | Wayback CDX | 10k+ |
| 13 | seed-theathletic.mjs | SPORTS_ATHLETICS | Wayback CDX | 3k+ |
| 14 | seed-hagerty.mjs | COLLECTING + TECH | Wayback CDX | 2k+ |
| 15 | seed-petrolicious.mjs | COLLECTING + ARTS | Wayback CDX | 500+ |
| 16 | seed-roadandtrack.mjs | Motorsport + Hardware | Wayback CDX | 2k+ |
| 17 | seed-thedrive.mjs | Hardware + Collecting | Wayback CDX | 1.5k+ |
| 18 | seed-hemmings.mjs | Collecting + History | Wayback CDX | 2k+ |
| 19 | seed-planetmoney.mjs | Economics + Personal Dev | NPR API | 500+ |
| 20 | seed-nerdwallet.mjs | Economics + Personal Dev | Wayback CDX | 1.5k+ |
| 21 | seed-freakonomics.mjs | Economics + Weird | Wayback CDX | 500+ |
| 22 | seed-coindesk.mjs | Emerging Tech + Economics | Wayback CDX | 2k+ |
| 23 | seed-bloomberg.mjs | Economics + Biographies | Wayback CDX | 2k+ |
| 24 | seed-kotaku.mjs | VIDEO_GAMES | Wayback CDX | 5k+ |
| 25 | seed-rockpapershotgun.mjs | VIDEO_GAMES | Wayback CDX | 3k+ |
| 26 | seed-eurogamer.mjs | VIDEO_GAMES + Hardware | Wayback CDX | 2k+ |
| 27 | seed-mobygames.mjs | VIDEO_GAMES | Direct scrape | Massive |
| 28 | seed-lonelyplanet.mjs | TRAVEL_EXPLORATION | Wayback CDX | 3k+ |
| 29 | seed-afar.mjs | TRAVEL + Cultures | Wayback CDX | 1k+ |
| 30 | seed-roadtrippers.mjs | Travel + Unusual Places | Wayback CDX | 1k+ |

## Implementation Notes
- All Wayback CDX seeders follow the proven `seed-iflscience.mjs` pattern:
  1. Query CDX API to discover URLs
  2. Fetch article metadata from Wayback snapshots  
  3. Extract title, description, og:image
  4. Upsert via shared `upsertUrls()` in `lib/seed.js`
- Direct-scrape seeders use HTML parsing with regex or node-html-parser
- All seeders support `--no-cache` and `--reset` flags for resumability
- Category/subcategory mappings align with existing `CATEGORY` and `SUBCATEGORY` constants in `lib/seed.js`