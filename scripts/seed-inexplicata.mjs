/**
 * seed-inexplicata.mjs — Inexplicata seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "inexplicata.blogspot.com",
  cacheFileName: "inexplicata.json",
  displayName: "🛸 Inexplicata",
  feedUrl: "https://inexplicata.blogspot.com/feeds/posts/default",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*inexplicata.blogspot.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL,
  source: "inexplicata",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
