/**
 * seed-hemmings.mjs — Hemmings seeder
 * Classic car market, restoration stories, automotive history, auction coverage.
 * Category: GAMES_HOBBIES → COLLECTING
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "hemmings.com",
  cacheFileName: "hemmings.json",
  displayName: "🚘 Hemmings",
  articlePathRegex: /\/(stories|blog|classifieds\/stories|auctions|magazine)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*[\|\-]\s*Hemmings\s*$/i,
  category_id: CATEGORY.GAMES_HOBBIES,
  subcategory_id: SUBCATEGORY.COLLECTING,
  source: "hemmings",
  seeder_score: 0.65,
  maxPages: 20,
});