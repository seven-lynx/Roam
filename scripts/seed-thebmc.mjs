/**
 * seed-thebmc.mjs — The BMC seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.MOUNTAINS_ALPINE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.thebmc.co.uk",
  cacheFileName: "thebmc.json",
  displayName: "⛏ The BMC",
  feedUrl: "https://www.thebmc.co.uk/rss.xml",
  articlePathRegex: /(articles|news|events)/,
  siteSuffixRegex: \s*[-–—]\s*thebmc.co.uk\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.MOUNTAINS_ALPINE,
  source: "thebmc",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
