/**
 * seed-hiddencityphila.mjs — Hidden City Philadelphia seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.UNDERGROUND_SUBTERRANEAN
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "hiddencityphila.org",
  cacheFileName: "hiddencityphila.json",
  displayName: "🏙 Hidden City Philadelphia",
  feedUrl: "https://hiddencityphila.org/feed/",
  articlePathRegex: /d{4}/,
  siteSuffixRegex: \s*[-–—]\s*hiddencityphila.org\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.UNDERGROUND_SUBTERRANEAN,
  source: "hiddencityphila",
  seeder_score: 0.6,
  maxArticles: 500,
  maxPages: 20,
});
