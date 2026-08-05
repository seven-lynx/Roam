/**
 * seed-darkplace.mjs — Dark Place seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.UNDERGROUND_SUBTERRANEAN
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.darkplace.co.uk",
  cacheFileName: "darkplace.json",
  displayName: "🌑 Dark Place",
  feedUrl: "https://www.darkplace.co.uk/feed/",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*darkplace.co.uk\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.UNDERGROUND_SUBTERRANEAN,
  source: "darkplace",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
