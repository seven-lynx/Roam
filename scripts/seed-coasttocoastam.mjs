/**
 * seed-coasttocoastam.mjs — Coast to Coast AM seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.FORTEANA_ANOMALIES
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.coasttocoastam.com",
  cacheFileName: "coasttocoastam.json",
  displayName: "📻 Coast to Coast AM",
  feedUrl: "https://www.coasttocoastam.com/feed/",
  articlePathRegex: /(article|show|pages)/,
  siteSuffixRegex: \s*[-–—]\s*coasttocoastam.com\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.FORTEANA_ANOMALIES,
  source: "coasttocoastam",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
