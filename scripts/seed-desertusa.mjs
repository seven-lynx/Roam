/**
 * seed-desertusa.mjs — DesertUSA seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.DESERTS_ARID_LANDS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.desertusa.com",
  cacheFileName: "desertusa.json",
  displayName: "🏜 DesertUSA",
  feedUrl: "https://www.desertusa.com/feed/",
  articlePathRegex: /(articles|adventures|animals)/,
  siteSuffixRegex: \s*[-–—]\s*desertusa.com\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.DESERTS_ARID_LANDS,
  source: "desertusa",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
