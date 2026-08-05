/**
 * seed-mind-hacks.mjs — Mind Hacks seeder
 * Category: CATEGORY.SCIENCE → SUBCATEGORY.NEUROSCIENCE_COGNITION
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "mindhacks.com",
  cacheFileName: "mind-hacks.json",
  displayName: "💡 Mind Hacks",
  feedUrl: "https://mindhacks.com/feed/",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*mindhacks.com\s*$,
  category_id: CATEGORY.SCIENCE,
  subcategory_id: SUBCATEGORY.NEUROSCIENCE_COGNITION,
  source: "mind-hacks",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
