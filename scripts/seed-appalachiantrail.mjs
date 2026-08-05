/**
 * seed-appalachiantrail.mjs — Appalachian Trail Conservancy seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.MOUNTAINS_ALPINE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "appalachiantrail.org",
  cacheFileName: "appalachiantrail.json",
  displayName: "🥾 Appalachian Trail Conservancy",
  feedUrl: "https://appalachiantrail.org/feed/",
  articlePathRegex: /(explore|news|about)/,
  siteSuffixRegex: \s*[-–—]\s*appalachiantrail.org\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.MOUNTAINS_ALPINE,
  source: "appalachiantrail",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
