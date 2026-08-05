/**
 * seed-americanmonsters.mjs — American Monsters seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.americanmonsters.com",
  cacheFileName: "americanmonsters.json",
  displayName: "👹 American Monsters",
  feedUrl: "https://www.americanmonsters.com/feed/",
  articlePathRegex: /([a-z0-9-]+-)+/,
  siteSuffixRegex: \s*[-–—]\s*americanmonsters.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.CRYPTOZOOLOGY_MYTHICAL,
  source: "americanmonsters",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
