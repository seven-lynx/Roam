/**
 * seed-mythicalcreatures-blog.mjs — Mythical Creatures Blog seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "mythicalcreatures.blog",
  cacheFileName: "mythicalcreatures-blog.json",
  displayName: "✍ Mythical Creatures Blog",
  feedUrl: "https://mythicalcreatures.blog/feed/",
  articlePathRegex: /([a-z0-9-]+-)+/,
  siteSuffixRegex: \s*[-–—]\s*mythicalcreatures.blog\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL,
  source: "mythicalcreatures-blog",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
