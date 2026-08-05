/**
 * seed-arabian-desert.mjs — Arabian Desert seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.DESERTS_ARID_LANDS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "arabian-desert.blogspot.com",
  cacheFileName: "arabian-desert.json",
  displayName: "🏜 Arabian Desert",
  feedUrl: "https://arabian-desert.blogspot.com/feeds/posts/default",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*arabian-desert.blogspot.com\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.DESERTS_ARID_LANDS,
  source: "arabian-desert",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
