/**
 * seed-taklamakan.mjs — Taklamakan Desert seeder
 * Category: CATEGORY.PEOPLE_PLACES → SUBCATEGORY.DESERTS_ARID_LANDS
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "taklamakan-desert.blogspot.com",
  cacheFileName: "taklamakan.json",
  displayName: "🏜 Taklamakan Desert",
  feedUrl: "https://taklamakan-desert.blogspot.com/feeds/posts/default",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*taklamakan-desert.blogspot.com\s*$,
  category_id: CATEGORY.PEOPLE_PLACES,
  subcategory_id: SUBCATEGORY.DESERTS_ARID_LANDS,
  source: "taklamakan",
  seeder_score: 0.45,
  maxArticles: 500,
  maxPages: 20,
});
