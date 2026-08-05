/**
 * seed-openminds.mjs — Open Minds seeder
 * Category: CATEGORY.WEIRD_WONDERFUL → SUBCATEGORY.FORTEANA_ANOMALIES
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.openminds.tv",
  cacheFileName: "openminds.json",
  displayName: "🧠 Open Minds",
  feedUrl: "https://www.openminds.tv/feed/",
  articlePathRegex: /(ufo-news|radio|articles)/,
  siteSuffixRegex: \s*[-–—]\s*openminds.tv\s*$,
  category_id: CATEGORY.WEIRD_WONDERFUL,
  subcategory_id: SUBCATEGORY.FORTEANA_ANOMALIES,
  source: "openminds",
  seeder_score: 0.55,
  maxArticles: 500,
  maxPages: 20,
});
