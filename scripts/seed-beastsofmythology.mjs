/**
 * seed-beastsofmythology.mjs — Beasts of Mythology seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "beastsofmythology.blogspot.com",
  cacheFileName: "beastsofmythology.json",
  displayName: "🐲 Beasts of Mythology",
  feedUrl: "https://beastsofmythology.blogspot.com/feeds/posts/default",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*beastsofmythology.blogspot.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL,
  source: "beastsofmythology",
  seeder_score: 0.5,
  maxArticles: 500,
  maxPages: 20,
});
