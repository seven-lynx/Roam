/**
 * seed-theathletic.mjs — The Athletic seeder
 * Premium sports journalism: football, soccer, basketball, F1, baseball.
 * Category: GAMES_HOBBIES → SPORTS_ATHLETICS
 * Access: Wayback CDX (paywall bypass via snapshots)
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "theathletic.com",
  cacheFileName: "theathletic.json",
  displayName: "⚽ The Athletic",
  articlePathRegex: /\/(\d+\/[a-z0-9-]+|news|analysis|feature)\/?$/i,
  siteSuffixRegex: /\s*[\|\-]\s*The Athletic\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.SPORTS_ATHLETICS,
  source: "theathletic",
  seeder_score: 0.75,
  maxPages: 30,
});