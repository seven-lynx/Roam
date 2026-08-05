/**
 * seed-forteanzoo.mjs — Fortean Zoology seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "forteanzoology.blogspot.com",
  cacheFileName: "forteanzoo.json",
  displayName: "🐉 Fortean Zoology",
  feedUrl: "https://forteanzoology.blogspot.com/feeds/posts/default",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*forteanzoology.blogspot.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL,
  source: "forteanzoology",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
