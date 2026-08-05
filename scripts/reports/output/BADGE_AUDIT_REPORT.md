# Badge System Full Audit

**Date:** 2026-07-30
**Database:** https://yrhckctwtdjowulfuaqc.supabase.co


## 1. Database Overview

- **Total profiles:** 26
- **Total badge definitions:** 300
- **Total user_badges rows:** 225
- **Total unlocked badges:** TBD (need separate query)
- **Total XP log entries:** 4727

## 2. Badge Definitions

| Category | Count | Badges |
|----------|-------|--------|
| contributing | 28 | 100-club, approval-streak, approved-bronze, approved-gold, approved-silver, archivist, category-filler, citizen-journalist, community-builder, contributor-bronze, contributor-gold, contributor-platinum, contributor-silver, fast-track, first-submission, global-contributor, night-owl-submitter, pioneer, prolific, quality-control, quality-first, speed-submitter, subcategory-scout, submission-streak, top-contributor, variety-submitter, weekday-warrior, weekend-submitter |
| gift | 17 | ambassador, beta-pioneer, bug-hunter, community-hero, curator-spotlight, early-adopter, good-citizen, innovator, moderator, record-breaker, roam-legend, roam-royalty, roam-scholar, seasonal-hero, spotlight, top-gun, trailblazer |
| collecting | 37 | archivist-bronze, archivist-gold, archivist-silver, bookworm, category-filler-collector, collector-bronze, collector-gold, collector-platinum, collector-silver, collectors-collector, completionist, consistent-collector, domain-collector, early-bird-collector, emergency-fund, first-save, hoarder, hoarder-strikes-back, language-collector, long-term-storage, mega-collector, minimalist, one-stop-shop, pack-mule, pocket-filler, quick-save, save-streak, save-wave, speed-collector, tag-master, tagger-bronze, tagger-gold, tagger-silver, un-saver, weekend-hoarder, weekly-collector, year-old |
| curating | 33 | award-winner, collection-remix, collection-streak, curator-bronze, curator-gold, curator-silver, curator-supreme, curators-block, curators-eye, curators-pick, daily-curation, descriptivist, diverse-collections, favorited-bronze, favorited-gold, favorited-silver, first-collection, hidden-gem, linker, mega-collection, mega-share, micro-curator, niched-down, pack-rat-bronze, pack-rat-gold, pack-rat-silver, public-curator, recycler, refined-taste, solo-artist, thematic, theme-master, weekly-publisher |
| social | 37 | beloved, bio-hacker, birthday-buddy, broadcaster, celebrity, chatterbox, connector, fan-club, first-follower, first-share, follow-back, follow-frenzy, follower-50, friendly-face, full-profile, influencer-bronze, influencer-gold, influencer-platinum, influencer-silver, inner-circle, link-in-bio, mutual-admiration, name-dropper, profile-perfectionist, profile-pic, public-figure, share-happy-hour, social-butterfly-bronze, social-butterfly-gold, social-butterfly-silver, social-network, the-lurker, two-way-street, verified-roamer, viral-bronze, viral-gold, viral-silver |
| exploration | 43 | category-explorer-bronze, category-explorer-gold, category-explorer-silver, century-club, curious-george, daily-double, dawn-patrol, day-tripper, deep-dive, domain-hoarder, early-bird, explorer-supreme, fifty-fifty, first-roam, fresh-finds, globetrotter-bronze, globetrotter-gold, globetrotter-platinum, globetrotter-silver, home-turf, insomniac, jet-setter, lunch-break, monthly-explorer, night-owl, nocturnal, nomad-bronze, nomad-gold, nomad-platinum, nomad-silver, pinball-wizard, repeat-visitor, roam-marathon, session-beast, speed-demon, speed-reader, subcategory-specialist, sunset-seeker, the-wanderer, wanderer-bronze, wanderer-gold, wanderer-silver, world-traveler |
| milestone | 18 | centurion-badges, demigod, grandmaster, level-10, level-100, level-125, level-15, level-150, level-20, level-25, level-30, level-40, level-5, level-50, level-60, level-75, master-roamer, xp-millionaire |
| secret | 43 | century-roam, china-national-day, christmas-day, cinco-de-mayo, dia-consciencia, diwali, earth-day, easter, easter-egg, eclipse-hunter, error-404-explorer, first-day-of-season, friday-13th, halloween, independence-day, india-independence, leap-day, lucky-777, lunar-new-year, lunar-roamer, may-the-fourth, mexico-independence, midnight-oil, millennium-roam, new-year, new-years-day, new-years-eve, oktoberfest, palindrome-day, pi-day, polyglot, ramadan, remembrance-day, rosh-hashanah, snake-eyes, solstice-seeker, st-patricks-day, talk-like-pirate, thanksgiving, time-traveler, triple-sevens, valentines-day, youth-day |
| streaks | 17 | comeback, consistency-king, double-digits, early-riser-streak, full-year, half-year-hero, hot-streak-bronze, hot-streak-gold, hot-streak-silver, night-owl-streak, phoenix, seasoned, the-marathon, twenty-one, unstoppable, weekend-streak, weekly-warrior |
| engagement | 27 | critic, daily-routine, deep-reader, diversity-champ, downer, feedback-loop, loyalist, marathon, morning-rater, non-committal, omnivore, power-user, rate-by-category, rate-everything, rate-spree, rate-streak, rater-bronze, rater-gold, rater-silver, session-beast-engagement, session-surfer, the-completionist-rate, the-equalizer, the-judge, voting-power, weekend-warrior, well-rounded |


## 3. Badge Unlock Statistics

(querying unlock counts per badge...)
| Slug | Name | Category | Tier | Req | Unlocked | In-Progress |
|------|------|----------|------|-----|----------|-------------|
| 100-club | 100 Club | contributing | 3 | - | 0 | 0 |
| ambassador | Ambassador | gift | 0 | - | 0 | 0 |
| approval-streak | Approval Streak | contributing | 2 | - | 0 | 0 |
| approved-bronze | Approved | contributing | 1 | 5 | 1 | 0 |
| approved-gold | Approved III | contributing | 3 | 100 | 0 | 0 |
| approved-silver | Approved II | contributing | 2 | 25 | 0 | 0 |
| archivist | The Archivist | contributing | 3 | - | 0 | 0 |
| archivist-bronze | Archivist | collecting | 1 | 500 | 0 | 0 |
| archivist-gold | Archivist III | collecting | 3 | 5000 | 0 | 0 |
| archivist-silver | Archivist II | collecting | 2 | 2000 | 0 | 0 |
| award-winner | Award Winner | curating | 4 | 500 | 0 | 0 |
| beloved | Beloved | social | 1 | 25 | 0 | 0 |
| beta-pioneer | Beta Pioneer | gift | 0 | - | 2 | 0 |
| bio-hacker | Bio Hacker | social | 1 | - | 3 | 0 |
| birthday-buddy | Birthday Buddy | social | 1 | - | 0 | 0 |
| bookworm | Bookworm | collecting | 2 | - | 1 | 0 |
| broadcaster | Broadcaster | social | 1 | 10 | 0 | 0 |
| bug-hunter | Bug Hunter | gift | 0 | - | 1 | 0 |
| category-explorer-bronze | Category Explorer | exploration | 1 | 3 | 10 | 0 |
| category-explorer-gold | Category Explorer III | exploration | 3 | - | 0 | 0 |
| category-explorer-silver | Category Explorer II | exploration | 2 | 5 | 10 | 0 |
| category-filler | Category Filler | contributing | 1 | - | 0 | 0 |
| category-filler-collector | Subcategory Filler | collecting | 3 | - | 0 | 0 |
| celebrity | Celebrity | social | 3 | 500 | 0 | 0 |
| centurion-badges | Centurion | milestone | 3 | 100 | 0 | 0 |
| century-club | Century Club | exploration | 2 | - | 6 | 0 |
| century-roam | Century Roam | secret | 1 | - | 0 | 0 |
| chatterbox | Chatterbox | social | 3 | 500 | 0 | 0 |
| china-national-day | China National Day | secret | 1 | - | 0 | 0 |
| christmas-day | Christmas Day | secret | 1 | - | 0 | 0 |
| cinco-de-mayo | Cinco de Mayo | secret | 1 | - | 0 | 0 |
| citizen-journalist | Citizen Journalist | contributing | 3 | - | 0 | 0 |
| collection-remix | Collection Remix | curating | 2 | - | 0 | 0 |
| collection-streak | Collection Streak | curating | 3 | - | 0 | 0 |
| collector-bronze | Collector | collecting | 1 | 10 | 2 | 0 |
| collector-gold | Collector III | collecting | 3 | 200 | 0 | 0 |
| collector-platinum | Collector Supreme | collecting | 4 | 1000 | 0 | 0 |
| collector-silver | Collector II | collecting | 2 | 50 | 0 | 0 |
| collectors-collector | Collector's Collector | collecting | 3 | - | 0 | 0 |
| comeback | Comeback Kid | streaks | 1 | - | 3 | 0 |
| community-builder | Community Builder | contributing | 4 | - | 0 | 0 |
| community-hero | Community Hero | gift | 0 | - | 0 | 0 |
| completionist | Completionist | collecting | 2 | - | 3 | 0 |
| connector | Connector | social | 1 | 3 | 0 | 0 |
| consistency-king | Consistency King | streaks | 4 | 200 | 0 | 0 |
| consistent-collector | Consistent Collector | collecting | 2 | - | 0 | 0 |
| contributor-bronze | Contributor | contributing | 1 | 5 | 1 | 0 |
| contributor-gold | Contributor III | contributing | 3 | 100 | 0 | 0 |
| contributor-platinum | Contributor Supreme | contributing | 4 | 1000 | 0 | 0 |
| contributor-silver | Contributor II | contributing | 2 | 25 | 0 | 0 |
| critic | Critic | engagement | 3 | 1000 | 0 | 0 |
| curator-bronze | Curator | curating | 1 | 3 | 2 | 0 |
| curator-gold | Curator III | curating | 3 | 25 | 0 | 0 |
| curator-silver | Curator II | curating | 2 | 10 | 0 | 0 |
| curator-spotlight | Curator Spotlight | gift | 0 | - | 1 | 0 |
| curator-supreme | Curator Supreme | curating | 3 | 50 | 0 | 0 |
| curators-block | Curator's Block | curating | 2 | - | 0 | 0 |
| curators-eye | Curator's Eye | curating | 1 | - | 0 | 0 |
| curators-pick | Curator's Pick | curating | 2 | - | 0 | 0 |
| curious-george | Curious George | exploration | 1 | - | 10 | 0 |
| daily-curation | Daily Curation | curating | 2 | - | 0 | 0 |
| daily-double | Daily Double | exploration | 2 | - | 0 | 0 |
| daily-routine | Daily Routine | engagement | 1 | - | 0 | 0 |
| dawn-patrol | Dawn Patrol | exploration | 3 | - | 0 | 0 |
| day-tripper | Day Tripper | exploration | 1 | - | 3 | 0 |
| deep-dive | Deep Dive | exploration | 2 | - | 1 | 0 |
| deep-reader | Deep Reader | engagement | 1 | - | 0 | 0 |
| demigod | Demigod | milestone | 5 | - | 0 | 0 |
| descriptivist | Descriptivist | curating | 1 | - | 0 | 0 |
| dia-consciencia | Dia da Consciência | secret | 1 | - | 0 | 0 |
| diverse-collections | Diverse Collections | curating | 2 | - | 0 | 0 |
| diversity-champ | Diversity Champion | engagement | 1 | - | 0 | 0 |
| diwali | Diwali | secret | 1 | - | 0 | 0 |
| domain-collector | Domain Collector | collecting | 3 | - | 2 | 0 |
| domain-hoarder | Domain Hoarder | exploration | 2 | - | 6 | 0 |
| double-digits | Double Digits | streaks | 1 | - | 1 | 0 |
| downer | Downer | engagement | 1 | - | 0 | 0 |
| early-adopter | Early Adopter | gift | 0 | - | 1 | 0 |
| early-bird | Early Bird | exploration | 1 | - | 0 | 0 |
| early-bird-collector | Early Bird Collector | collecting | 1 | - | 0 | 0 |
| early-riser-streak | Early Riser Streak | streaks | 2 | - | 1 | 0 |
| earth-day | Earth Day | secret | 1 | - | 0 | 0 |
| easter | Easter | secret | 1 | - | 0 | 0 |
| easter-egg | Easter Egg Hunter | secret | 3 | - | 0 | 0 |
| eclipse-hunter | Eclipse Hunter | secret | 4 | - | 0 | 0 |
| emergency-fund | Emergency Fund | collecting | 2 | - | 0 | 0 |
| error-404-explorer | 404 Explorer | secret | 1 | - | 0 | 0 |
| explorer-supreme | Explorer Supreme | exploration | 4 | - | 0 | 0 |
| fan-club | Fan Club | social | 3 | - | 0 | 0 |
| fast-track | Fast Track | contributing | 2 | - | 0 | 0 |
| favorited-bronze | Favorited | curating | 1 | 5 | 0 | 0 |
| favorited-gold | Favorited III | curating | 3 | 100 | 0 | 0 |
| favorited-silver | Favorited II | curating | 2 | 25 | 0 | 0 |
| feedback-loop | Feedback Loop | engagement | 1 | - | 0 | 0 |
| fifty-fifty | 50/50 Split | exploration | 3 | - | 0 | 0 |
| first-collection | First Collection | curating | 1 | 1 | 4 | 0 |
| first-day-of-season | Season Opener | secret | 1 | - | 0 | 0 |
| first-follower | First Follower | social | 3 | - | 0 | 0 |
| first-roam | First Roam | exploration | 1 | 1 | 10 | 0 |
| first-save | First Save | collecting | 1 | 1 | 4 | 0 |
| first-share | First Share | social | 1 | - | 0 | 0 |
| first-submission | First Submission | contributing | 1 | 1 | 3 | 0 |
| follow-back | Follow Back | social | 1 | - | 3 | 0 |
| follow-frenzy | Follow Frenzy | social | 1 | - | 0 | 0 |
| follower-50 | Fifty Followers | social | 2 | - | 0 | 0 |
| fresh-finds | Fresh Finds | exploration | 1 | - | 0 | 0 |
| friday-13th | Friday the 13th | secret | 1 | - | 0 | 0 |
| friendly-face | Friendly Face | social | 1 | - | 3 | 0 |
| full-profile | Full Profile | social | 1 | - | 0 | 0 |
| full-year | 365 | streaks | 5 | 365 | 0 | 0 |
| global-contributor | Global Contributor | contributing | 2 | - | 0 | 0 |
| globetrotter-bronze | Globetrotter | exploration | 1 | 5 | 10 | 0 |
| globetrotter-gold | Globetrotter III | exploration | 3 | 30 | 0 | 0 |
| globetrotter-platinum | Globetrotter Supreme | exploration | 4 | 50 | 0 | 0 |
| globetrotter-silver | Globetrotter II | exploration | 2 | 15 | 8 | 0 |
| good-citizen | Good Citizen | gift | 0 | - | 0 | 0 |
| grandmaster | Grandmaster | milestone | 5 | - | 0 | 0 |
| half-year-hero | Half-Year Hero | streaks | 5 | - | 0 | 0 |
| halloween | Halloween | secret | 1 | - | 0 | 0 |
| hidden-gem | Hidden Gem | curating | 4 | - | 0 | 0 |
| hoarder | Hoarder | collecting | 2 | - | 0 | 0 |
| hoarder-strikes-back | The Hoarder Strikes Back | collecting | 4 | - | 0 | 0 |
| home-turf | Home Turf | exploration | 1 | - | 0 | 0 |
| hot-streak-bronze | Hot Streak | streaks | 1 | 3 | 1 | 0 |
| hot-streak-gold | Hot Streak III | streaks | 3 | 30 | 0 | 0 |
| hot-streak-silver | Hot Streak II | streaks | 2 | 7 | 1 | 0 |
| independence-day | Independence Day | secret | 1 | - | 0 | 0 |
| india-independence | India Independence | secret | 1 | - | 0 | 0 |
| influencer-bronze | Influencer | social | 1 | 10 | 0 | 0 |
| influencer-gold | Influencer III | social | 3 | 200 | 0 | 0 |
| influencer-platinum | Influencer Supreme | social | 4 | 1000 | 0 | 0 |
| influencer-silver | Influencer II | social | 2 | 50 | 0 | 0 |
| inner-circle | Inner Circle | social | 2 | - | 0 | 0 |
| innovator | Innovator | gift | 0 | - | 0 | 0 |
| insomniac | Insomniac | exploration | 2 | - | 0 | 0 |
| jet-setter | Jet Setter | exploration | 3 | - | 6 | 0 |
| language-collector | Language Collector | collecting | 2 | - | 0 | 0 |
| leap-day | Leap Day Explorer | secret | 2 | - | 0 | 0 |
| level-10 | Level 10 | milestone | 0 | 10 | 2 | 0 |
| level-100 | Century Mark | milestone | 0 | 100 | 0 | 0 |
| level-125 | Level 125 | milestone | 0 | 125 | 0 | 0 |
| level-15 | Level 15 | milestone | 0 | 15 | 0 | 0 |
| level-150 | Level 150 | milestone | 0 | 150 | 0 | 0 |
| level-20 | Level 20 | milestone | 0 | 20 | 0 | 0 |
| level-25 | Level 25 | milestone | 0 | 25 | 0 | 0 |
| level-30 | Level 30 | milestone | 0 | 30 | 0 | 0 |
| level-40 | Level 40 | milestone | 0 | 40 | 0 | 0 |
| level-5 | Level 5 | milestone | 0 | 5 | 5 | 0 |
| level-50 | Half Century | milestone | 0 | 50 | 0 | 0 |
| level-60 | Level 60 | milestone | 0 | 60 | 0 | 0 |
| level-75 | Level 75 | milestone | 0 | 75 | 0 | 0 |
| link-in-bio | Link In Bio | social | 1 | - | 0 | 0 |
| linker | Linker | curating | 1 | - | 0 | 0 |
| long-term-storage | Long-Term Storage | collecting | 3 | - | 0 | 0 |
| loyalist | Loyalist | engagement | 3 | - | 0 | 0 |
| lucky-777 | Lucky 777 | secret | 2 | - | 0 | 0 |
| lunar-new-year | Lunar New Year | secret | 1 | - | 0 | 0 |
| lunar-roamer | Lunar Roamer | secret | 2 | - | 0 | 0 |
| lunch-break | Lunch Break | exploration | 1 | - | 0 | 0 |
| marathon | Marathon Runner | engagement | 1 | - | 0 | 0 |
| master-roamer | Master Roamer | milestone | 4 | - | 0 | 0 |
| may-the-fourth | May the Fourth | secret | 1 | - | 0 | 0 |
| mega-collection | Mega-Collection | curating | 4 | - | 0 | 0 |
| mega-collector | Mega Collector | collecting | 2 | - | 0 | 0 |
| mega-share | Mega Share | curating | 1 | - | 0 | 0 |
| mexico-independence | Mexico Independence | secret | 1 | - | 0 | 0 |
| micro-curator | Micro-Curator | curating | 1 | - | 0 | 0 |
| midnight-oil | Midnight Oil | secret | 1 | - | 0 | 0 |
| millennium-roam | Millennium Roam | secret | 3 | - | 0 | 0 |
| minimalist | Minimalist | collecting | 1 | - | 3 | 0 |
| moderator | Moderator | gift | 4 | - | 2 | 0 |
| monthly-explorer | Monthly Explorer | exploration | 2 | - | 3 | 0 |
| morning-rater | Morning Rater | engagement | 1 | - | 0 | 0 |
| mutual-admiration | Mutual Admiration | social | 2 | - | 0 | 0 |
| name-dropper | Name Dropper | social | 1 | - | 5 | 0 |
| new-year | New Year Roamer | secret | 1 | - | 0 | 0 |
| new-years-day | New Year's Day | secret | 1 | - | 0 | 0 |
| new-years-eve | New Year's Eve | secret | 1 | - | 0 | 0 |
| niched-down | Niched Down | curating | 1 | - | 3 | 0 |
| night-owl | Night Owl | exploration | 1 | - | 0 | 0 |
| night-owl-streak | Night Owl Streak | streaks | 2 | - | 1 | 0 |
| night-owl-submitter | Night Owl Submitter | contributing | 1 | - | 0 | 0 |
| nocturnal | Nocturnal | exploration | 2 | - | 8 | 0 |
| nomad-bronze | Nomad | exploration | 1 | 500 | 3 | 0 |
| nomad-gold | Nomad III | exploration | 3 | 5000 | 0 | 0 |
| nomad-platinum | Nomad Supreme | exploration | 4 | 10000 | 0 | 0 |
| nomad-silver | Nomad II | exploration | 2 | 1000 | 2 | 0 |
| non-committal | Non-Committal | engagement | 2 | - | 0 | 0 |
| oktoberfest | Oktoberfest | secret | 1 | - | 0 | 0 |
| omnivore | Omnivore | engagement | 1 | - | 0 | 0 |
| one-stop-shop | One-Stop Shop | collecting | 1 | - | 0 | 0 |
| pack-mule | Pack Mule | collecting | 3 | - | 0 | 0 |
| pack-rat-bronze | Pack Rat | curating | 1 | 10 | 1 | 0 |
| pack-rat-gold | Pack Rat III | curating | 3 | 200 | 0 | 0 |
| pack-rat-silver | Pack Rat II | curating | 2 | 50 | 0 | 0 |
| palindrome-day | Palindrome Day | secret | 2 | - | 0 | 0 |
| phoenix | Phoenix | streaks | 4 | 100 | 0 | 0 |
| pi-day | Pi Day | secret | 2 | - | 0 | 0 |
| pinball-wizard | Pinball Wizard | exploration | 2 | - | 8 | 0 |
| pioneer | Pioneer | contributing | 3 | - | 0 | 0 |
| pocket-filler | Pocket Filler | collecting | 3 | - | 0 | 0 |
| polyglot | Polyglot | secret | 2 | - | 0 | 0 |
| power-user | Power User | engagement | 2 | - | 0 | 0 |
| profile-perfectionist | Profile Perfectionist | social | 1 | - | 0 | 0 |
| profile-pic | Profile Pic | social | 1 | - | 0 | 0 |
| prolific | Prolific | contributing | 4 | 500 | 0 | 0 |
| public-curator | Public Curator | curating | 2 | 5 | 1 | 0 |
| public-figure | Public Figure | social | 4 | - | 0 | 0 |
| quality-control | Quality Control | contributing | 2 | - | 1 | 0 |
| quality-first | Quality First | contributing | 2 | - | 0 | 0 |
| quick-save | Quick Save | collecting | 1 | - | 0 | 0 |
| ramadan | Ramadan | secret | 1 | - | 0 | 0 |
| rate-by-category | Rate by Category | engagement | 1 | - | 0 | 0 |
| rate-everything | Rate Everything | engagement | 2 | - | 0 | 0 |
| rate-spree | Rate Spree | engagement | 2 | - | 0 | 0 |
| rate-streak | Rate at least 1 URL for 7 consecutive days | engagement | 2 | - | 0 | 0 |
| rater-bronze | Rater | engagement | 1 | 25 | 0 | 0 |
| rater-gold | Rater III | engagement | 3 | 500 | 0 | 0 |
| rater-silver | Rater II | engagement | 2 | 100 | 0 | 0 |
| record-breaker | Record Breaker | gift | 0 | - | 0 | 0 |
| recycler | Recycler | curating | 1 | - | 0 | 0 |
| refined-taste | Refined Taste | curating | 2 | - | 0 | 0 |
| remembrance-day | Remembrance Day | secret | 1 | - | 0 | 0 |
| repeat-visitor | Repeat Visitor | exploration | 1 | - | 0 | 0 |
| roam-legend | Roam Legend | gift | 0 | - | 1 | 0 |
| roam-marathon | Half Marathon | exploration | 1 | - | 1 | 0 |
| roam-royalty | Roam Royalty | gift | 0 | - | 0 | 0 |
| roam-scholar | Roam Scholar | gift | 0 | - | 0 | 0 |
| rosh-hashanah | Rosh Hashanah | secret | 1 | - | 0 | 0 |
| save-streak | Save Streak | collecting | 3 | - | 0 | 0 |
| save-wave | Save Wave | collecting | 1 | - | 0 | 0 |
| seasonal-hero | Seasonal Hero | gift | 0 | - | 0 | 0 |
| seasoned | Seasoned | streaks | 4 | - | 0 | 0 |
| session-beast | Session Beast | exploration | 2 | - | 0 | 0 |
| session-beast-engagement | Sprint Master | engagement | 2 | - | 0 | 0 |
| session-surfer | Session Surfer | engagement | 3 | - | 0 | 0 |
| share-happy-hour | Share Happy Hour | social | 1 | - | 0 | 0 |
| snake-eyes | Snake Eyes | secret | 1 | - | 0 | 0 |
| social-butterfly-bronze | Social Butterfly | social | 1 | 5 | 0 | 0 |
| social-butterfly-gold | Social Butterfly III | social | 3 | 100 | 0 | 0 |
| social-butterfly-silver | Social Butterfly II | social | 2 | 25 | 0 | 0 |
| social-network | Social Network | social | 2 | - | 3 | 0 |
| solo-artist | Solo Artist | curating | 1 | - | 23 | 0 |
| solstice-seeker | Solstice Seeker | secret | 2 | - | 0 | 0 |
| speed-collector | Speed Collector | collecting | 1 | - | 0 | 0 |
| speed-demon | Speed Demon | exploration | 2 | - | 0 | 0 |
| speed-reader | Speed Reader | exploration | 3 | - | 0 | 0 |
| speed-submitter | Speed Submitter | contributing | 2 | - | 0 | 0 |
| spotlight | Spotlight | gift | 0 | - | 0 | 0 |
| st-patricks-day | St. Patrick's Day | secret | 1 | - | 0 | 0 |
| subcategory-scout | Subcategory Scout | contributing | 2 | - | 0 | 0 |
| subcategory-specialist | Subcategory Specialist | exploration | 1 | - | 0 | 0 |
| submission-streak | Submission Streak | contributing | 1 | - | 0 | 0 |
| sunset-seeker | Sunset Seeker | exploration | 1 | - | 3 | 0 |
| tag-master | Tag Master | collecting | 2 | - | 0 | 0 |
| tagger-bronze | Tagger | collecting | 1 | 3 | 0 | 0 |
| tagger-gold | Tagger III | collecting | 3 | 10 | 0 | 0 |
| tagger-silver | Tagger II | collecting | 2 | 6 | 0 | 0 |
| talk-like-pirate | Talk Like a Pirate | secret | 1 | - | 0 | 0 |
| thanksgiving | Thanksgiving | secret | 1 | - | 0 | 0 |
| the-completionist-rate | The Completionist | engagement | 3 | - | 0 | 0 |
| the-equalizer | The Equalizer | engagement | 2 | - | 0 | 0 |
| the-judge | The Judge | engagement | 4 | 2000 | 0 | 0 |
| the-lurker | The Lurker | social | 2 | - | 0 | 0 |
| the-marathon | The Marathon | streaks | 3 | - | 0 | 0 |
| the-wanderer | The Wanderer | exploration | 1 | - | 2 | 0 |
| thematic | Thematic | curating | 2 | - | 0 | 0 |
| theme-master | Theme Master | curating | 2 | - | 0 | 0 |
| time-traveler | Time Traveler | secret | 2 | - | 0 | 0 |
| top-contributor | Top Contributor | contributing | 2 | - | 0 | 0 |
| top-gun | Top Gun | gift | 0 | - | 0 | 0 |
| trailblazer | Trailblazer | gift | 0 | - | 2 | 0 |
| triple-sevens | Triple Sevens | secret | 2 | - | 0 | 0 |
| twenty-one | Twenty-One | streaks | 2 | - | 0 | 0 |
| two-way-street | Two-Way Street | social | 2 | - | 1 | 0 |
| un-saver | Un-Saver | collecting | 1 | - | 0 | 0 |
| unstoppable | Unstoppable | streaks | 3 | 60 | 0 | 0 |
| valentines-day | Valentine's Day | secret | 1 | - | 0 | 0 |
| variety-submitter | Variety Submitter | contributing | 1 | 5 | 0 | 0 |
| verified-roamer | Verified Roamer | social | 3 | - | 0 | 0 |
| viral-bronze | Viral | social | 1 | 10 | 0 | 0 |
| viral-gold | Viral III | social | 3 | 1000 | 0 | 0 |
| viral-silver | Viral II | social | 2 | 100 | 0 | 0 |
| voting-power | Voting Power | engagement | 2 | - | 0 | 0 |
| wanderer-bronze | Wanderer | exploration | 1 | 10 | 9 | 0 |
| wanderer-gold | Wanderer III | exploration | 3 | 200 | 0 | 0 |
| wanderer-silver | Wanderer II | exploration | 2 | 50 | 8 | 0 |
| weekday-warrior | Weekday Warrior | contributing | 3 | - | 0 | 0 |
| weekend-hoarder | Weekend Hoarder | collecting | 2 | - | 0 | 0 |
| weekend-streak | Weekend Streak | streaks | 1 | - | 0 | 0 |
| weekend-submitter | Weekend Submitter | contributing | 1 | - | 0 | 0 |
| weekend-warrior | Weekend Warrior | engagement | 1 | - | 0 | 0 |
| weekly-collector | Weekly Collector | collecting | 2 | - | 0 | 0 |
| weekly-publisher | Weekly Publisher | curating | 2 | - | 0 | 0 |
| weekly-warrior | Weekly Warrior | streaks | 2 | - | 0 | 0 |
| well-rounded | Well-Rounded | engagement | 1 | - | 0 | 0 |
| world-traveler | World Traveler | exploration | 2 | - | 0 | 0 |
| xp-millionaire | XP Millionaire | milestone | 4 | 1000000 | 0 | 0 |
| year-old | Year Old | collecting | 4 | - | 0 | 0 |
| youth-day | Youth Day | secret | 1 | - | 0 | 0 |


## 4. Milestone Badge Gap Analysis

### Level-Based Milestone Badges

| Badge | Min Level | Users Qualified | Users Have Badge | Missing |
|-------|-----------|-----------------|------------------|---------|
| level-10 | 10 | 2 | 2 | 0 |
| level-100 | 100 | 0 | 0 | 0 |
| level-20 | 20 | 0 | 0 | 0 |
| level-30 | 30 | 0 | 0 | 0 |
| level-40 | 40 | 0 | 0 | 0 |
| level-50 | 50 | 0 | 0 | 0 |
| level-75 | 75 | 0 | 0 | 0 |

### Combo Milestone Badges

These require both level + badge count thresholds. Checking...
- **centurion-badges** (100+ badges): 0 users qualify, 0 have it, 0 missing
- **master-roamer** (Lv50 + 50 badges): 0 users qualify, 0 have it, 0 missing
- **grandmaster** (Lv100 + all non-secret): 0 users qualify, 0 have it, 0 missing

## 5. XP & Level Integrity Check

Checking XP totals against xp_log sums for a sample of users...


- **XP mismatches (sample of 26):** 0 users
- **Level mismatches (sample of 26):** 0 users
- **Extrapolated XP mismatches (full userbase):** ~0 users

## 6. profile.badge_count vs Actual Unlocked Badges


- **Users with badge_count drift (sample of 300):** 0

## 7. Duplicate Badge Assignments Check

(Could not check duplicates via RPC)

## 8. Summary & Recommendations

See console output for full details.

### Known Issues in rebuild-badges-client-side.mjs

1. **Missing `break` statements** (lines 198-222) — fall-through in switch/case silently mis-evaluates badges
2. **Missing combo milestone badges** (`centurion-badges`, `master-roamer`, `grandmaster`)
3. **XP update is broken** (line 295 sets `xp_total: undefined`)
4. **Many badges unevaluated** — `nomad-*`, `globetrotter-*`, `tagger-*`, `rater-*`, `critic`, `marathon`, `loyalist`, `weekend-warrior`, `diversity-champ`, `quality-control`, `citizen-journalist`, `comeback`, `completionist`, `mega-collector`, `lucky-777`, etc.
