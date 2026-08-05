/**
 * seed-atlasobscura-crime.mjs — Atlas Obscura crime/mystery articles
 * True crime stories, historical mysteries, unsolved cases, criminal history.
 * Category: WEIRD_WONDERFUL → TRUE_CRIME_MYSTERIES
 * Access: Wayback CDX
 */
import { seedWaybackCdx, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedWaybackCdx({
  siteDomain: "atlasobscura.com",
  cacheFileName: "atlasobscura-crime.json",
  displayName: "🕵️ Atlas Obscura Crime",
  articlePathRegex: /\/(articles|categories)\/[a-z0-9-]+$/i,
  siteSuffixRegex: /\s*\|\s*Atlas Obscura\s*$/i,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.TRUE_CRIME_MYSTERIES,
  source: "atlasobscura-crime",
  seeder_score: 0.7,
  maxPages: 10,
});