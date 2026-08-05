/**
 * seed-strangehistory.mjs — Strange History seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.strangehistory.net",
  cacheFileName: "strangehistory.json",
  displayName: "📜 Strange History",
  feedUrl: "https://www.strangehistory.net/feed/",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*strangehistory.net\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL,
  source: "strangehistory",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
