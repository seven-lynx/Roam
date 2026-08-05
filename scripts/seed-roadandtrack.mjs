/**
 * seed-roadandtrack.mjs — Road & Track seeder
 * Motorsport coverage, car reviews, automotive technology, racing history.
 * Category: GAMES_HOBBIES → SPORTS_ATHLETICS
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "roadandtrack.com",
  cacheFileName: "roadandtrack.json",
  displayName: "🏁 Road & Track",
  articlePathRegex: /\/(news|reviews|car-culture|motorsports|features)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*[\|\-]\s*(?:Road & Track|Road and Track)\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.SPORTS_ATHLETICS,
  source: "roadandtrack",
  seeder_score: 0.7,
  maxPages: 20,
});