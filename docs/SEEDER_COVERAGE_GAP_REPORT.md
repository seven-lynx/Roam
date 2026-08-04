# Seeder Coverage Gap Report

**Generated:** 2026-07-23
**Pool Size:** 1.57M URLs | **Sources:** 138 unique (122 in DB) | **Seeder Health:** 22 healthy, 31 warning, 8 broken

---

## 1. Top-Heavy Pool

| Category | URLs | % Pool | Dominant Subcategory |
|---|---|---|---|
| Technology | 644,585 | 41.2% | Programming (609K — **39% of entire pool**) |
| Arts & Culture | 280,047 | 17.9% | Visual Art (184K) |
| Science & Nature | 240,657 | 15.4% | Biology (224K) |
| People & Places | 138,672 | 8.9% | Travel (95K) |
| History & Ideas | 98,157 | 6.3% | Modern History (80K) |
| Games & Hobbies | 92,110 | 5.9% | Video Games (36K) |
| Weird & Wonderful | 55,403 | 3.5% | Oddities (39K) |
| Mind & Body | 15,282 | 1.0% | Personal Dev (6K) |

---

## 2. Subcategories with ZERO or Near-Zero URLs

These are defined in `scripts/lib/seed.js` (SUBCATEGORY constants) but have no meaningful population in DB.

### 🔬 Science & Nature (7 missing)
| Subcategory | Status | Existing Seeder? |
|---|---|---|
| Oceanography & Marine Life | 0 URLs | `oceana` (broken), `hakai` (17), `oceanographic` (2K in Biology) |
| Paleontology & Natural History | 0 URLs | None |
| Astrobiology & Exoplanets | 0 URLs | None |
| Botany & Plant Science | 0 URLs | None |
| Climate & Atmospheric Science | 0 URLs | None |
| Neuroscience & Cognition | 525 URLs | Generic seeders only, no dedicated source |
| Geology & Earth Science | 279 URLs | `usgs` (broken, all 2K dead) |

### 💻 Technology (2 missing)
| Subcategory | Status | Existing Seeder? |
|---|---|---|
| Robotics & Automation | 0 URLs | None |
| Cryptography & Security | 0 URLs | None |

### 🎨 Arts & Culture (4 missing)
| Subcategory | Status | Existing Seeder? |
|---|---|---|
| Comics & Illustration | 0 URLs | None |
| Theatre & Performance | 0 URLs | `playbill` (cached 82, not committed) |
| Architecture & Urban | 0 URLs | `seed-archdaily.mjs` exists (not in health audit) |
| Anime & Manga | 0 URLs | `seed-animenewsnetwork.mjs` exists (not in health audit) |

### 📜 History & Ideas (7 missing)
| Subcategory | Status | Existing Seeder? |
|---|---|---|
| Ancient & Medieval History | 0 URLs | None |
| Religion & Mythology | 0 URLs | None |
| Anthropology & Archaeology | 0 URLs | None |
| Legal History & Constitutional | 0 URLs | None |
| History of Science & Technology | 0 URLs | None |
| Exploration & Discovery | 0 URLs | None |
| Cultural & Intellectual History | 0 URLs | None |

### 🎮 Games & Hobbies (4 missing)
| Subcategory | Status | Existing Seeder? |
|---|---|---|
| Board Games & Tabletop | 99 URLs | `boardgamegeek` (49 committed + 50 cached) |
| Crafts & DIY Making | 22 URLs | `car-diy-curated`, `seed-instructables-cars.mjs` |
| Gardening & Horticulture | 80 URLs | `gardenista` (40 cached + 40 committed) |
| Puzzles & Brain Teasers | 0 URLs | None |

### 🌀 Weird & Wonderful (8 missing)
| Subcategory | Status | Existing Seeder? |
|---|---|---|
| True Crime & Mysteries | 0 URLs | `crimereads` exists (targets Literature) |
| Vintage Internet | 0 URLs | None |
| Urban Legends & Folklore | 0 URLs | None |
| Conspiracy & Fringe | 0 URLs | None |
| Lost Media | 0 URLs | None |
| Cryptozoology & Mythical | 0 URLs | None |
| Forteana & Anomalies | 0 URLs | None |
| Underground & Subterranean | 0 URLs | None |

### 🌍 People & Places (10 missing)
| Subcategory | Status | Existing Seeder? |
|---|---|---|
| Biographies & Profiles | 0 URLs | None dedicated |
| Languages & Linguistics | 0 URLs | `seed-language-log.mjs` exists (not in audit) |
| Indigenous Cultures | 0 URLs | None |
| Subcultures & Communities | 0 URLs | None |
| Migration & Diaspora | 0 URLs | None |
| Maps & Cartography | 0 URLs | None |
| Festivals & Customs | 0 URLs | None |
| Oceans & Maritime | 0 URLs | None |
| Deserts & Arid Lands | 0 URLs | None |
| Mountains & Alpine | 0 URLs | None |

### 🧠 Mind & Body (7 missing)
| Subcategory | Status | Existing Seeder? |
|---|---|---|
| Psychology & Behaviour | 0 URLs | `seed-psyche.mjs` exists (not in audit) |
| Fitness & Movement | 0 URLs | `seed-strength-fitness.mjs` exists (not in audit) |
| Mindfulness & Meditation | 20 URLs | `mindful` (10 cached + 10 committed) |
| Sleep & Recovery | 173 URLs | `sleep` (173 cached), `sleepreview` (173 committed) |
| Aging & Longevity | 0 URLs | None |
| Addiction & Recovery | 0 URLs | None |
| Human Performance | 0 URLs | None |

---

## 3. Broken Seeders (8 — need repair, not replacement)

| Seeder | Error | Last Run |
|---|---|---|
| audio-hifi | error | 7/17/2026 |
| craft-beer | error | 7/17/2026 |
| noaa-fisheries | error | 7/12/2026 |
| oceana | error | 7/17/2026 |
| smithsonians-animals | error | 7/17/2026 |
| sports-reference | error | 7/17/2026 |
| watches | error | 7/17/2026 |
| whiskey | error | 7/17/2026 |

---

## 4. New Seeders Needed — Priority-Ordered List

### Priority 1 — High-Impact Gaps (>5K potential URLs each)

| # | Seeder Name | Target Subcategory | Source | Pattern | Est. Volume |
|---|---|---|---|---|---|
| 1 | `seed-psychology-today` | Psychology & Behaviour (MIND_BODY) | psychologytoday.com | Wayback CDX | 5,000+ |
| 2 | `seed-boardgamegeek` | Board Games & Tabletop (GAMES_HOBBIES) | boardgamegeek.com | Direct scrape / API | 5,000+ |
| 3 | `seed-british-museum` | Anthropology & Archaeology (HISTORY_IDEAS) | britishmuseum.org/blog | Wayback CDX | 2,000+ |
| 4 | `seed-nhm-paleo` | Paleontology & Natural History (SCIENCE) | nhm.ac.uk | Wayback CDX | 1,500+ |
| 5 | `seed-smithsonian-ocean` | Oceanography & Marine Life (SCIENCE) | ocean.si.edu | Wayback CDX | 2,000+ |
| 6 | `seed-botany-one` | Botany & Plant Science (SCIENCE) | botany.one / kew.org | Direct scrape / RSS | 800+ |

### Priority 2 — Category Round-Out

| # | Seeder Name | Target Subcategory | Source | Pattern | Est. Volume |
|---|---|---|---|---|---|
| 7 | `seed-smithsonian-history` | Ancient & Medieval History (HISTORY_IDEAS) | smithsonianmag.com/history | Wayback CDX | 3,000+ |
| 8 | `seed-atlas-mythology` | Religion & Mythology (HISTORY_IDEAS) | worldhistory.org | Direct scrape | 2,000+ |
| 9 | `seed-comics-journal` | Comics & Illustration (ARTS_CULTURE) | tcj.com | Wayback CDX | 1,500+ |
| 10 | `seed-royal-society` | History of Science & Tech (HISTORY_IDEAS) | royalsociety.org/blog | Wayback CDX | 1,000+ |
| 11 | `seed-architectural-review` | Architecture & Urban (ARTS_CULTURE) | architectural-review.com | Wayback CDX | 1,500+ |
| 12 | `seed-garden-org` | Gardening & Horticulture (GAMES_HOBBIES) | rhs.org.uk / garden.org | Direct scrape | 2,000+ |
| 13 | `seed-explorersweb` | Exploration & Discovery (HISTORY_IDEAS) | explorersweb.com | RSS / Direct | 1,000+ |

### Priority 3 — Weird & Wonderful Expansion

| # | Seeder Name | Target Subcategory | Source | Pattern | Est. Volume |
|---|---|---|---|---|---|
| 14 | `seed-snopes` | Urban Legends & Folklore (WEIRD) | snopes.com/fact-check | Wayback CDX | 3,000+ |
| 15 | `seed-atlasobscura-crime` | True Crime & Mysteries (WEIRD) | atlasobscura.com (crime articles) | Wayback CDX | 500+ |
| 16 | `seed-lost-media-wiki` | Lost Media (WEIRD) | lostmediawiki.com | Direct scrape | 500+ |
| 17 | `seed-vintage-web` | Vintage Internet (WEIRD) | webdesignmuseum.org | Direct scrape | 300+ |
| 18 | `seed-conspiracy-archive` | Conspiracy & Fringe (WEIRD) | archive.org (conspiracy theory collections) | Wayback CDX | 500+ |

### Priority 4 — Mind & Body + People & Places Gaps

| # | Seeder Name | Target Subcategory | Source | Pattern | Est. Volume |
|---|---|---|---|---|---|
| 19 | `seed-headspace` | Mindfulness & Meditation (MIND_BODY) | headspace.com/articles | Wayback CDX | 500+ |
| 20 | `seed-sleep-foundation` | Sleep & Recovery (MIND_BODY) | sleepfoundation.org | Direct scrape | 800+ |
| 21 | `seed-bluezones` | Aging & Longevity (MIND_BODY) | bluezones.com | Direct scrape | 300+ |
| 22 | `seed-cartography-society` | Maps & Cartography (PEOPLE_PLACES) | cartography.org.uk / loc.gov/maps | Direct scrape | 500+ |
| 23 | `seed-biography-com` | Biographies & Profiles (PEOPLE_PLACES) | biography.com | Wayback CDX | 3,000+ |
| 24 | `seed-survival-international` | Indigenous Cultures (PEOPLE_PLACES) | survivalinternational.org | Direct scrape | 300+ |

---

## 5. Summary

| Priority | Count | Focus Areas |
|---|---|---|
| P1 — High-Impact | 6 | Psychology, Board Games, Anthropology, Paleontology, Oceanography, Botany |
| P2 — Round-Out | 7 | Ancient History, Mythology, Comics, Science History, Architecture, Gardening, Exploration |
| P3 — Weird | 5 | Urban Legends, True Crime, Lost Media, Vintage Web, Conspiracy |
| P4 — Mind+Places | 6 | Mindfulness, Sleep, Longevity, Maps, Biographies, Indigenous Cultures |
| **TOTAL** | **24** | |

### Combined with Existing Plan (docs/NEW_SEEDERS_PLAN.md)

The existing plan already covers:
- **Sports** (6 seeders): sports-reference, ringer, espn, deadspin, olympics, sbnation, theathletic
- **Cars** (5 seeders): jalopnik, bringatrailer, hagerty, petrolicious, roadandtrack, thedrive, hemmings
- **Money** (5 seeders): investopedia, planetmoney, nerdwallet, freakonomics, coindesk, bloomberg
- **Games** (4 seeders): polygon, kotaku, rockpapershotgun, eurogamer, mobygames
- **Travel** (3 seeders): natgeo, lonelyplanet, afar, roadtrippers

Combined total: **30 (existing plan) + 24 (this report) = 54 total new seeders** to achieve comprehensive subcategory coverage.