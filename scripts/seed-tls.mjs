/**
 * seed-tls.mjs — TLS seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.the-tls.co.uk",
  cacheFileName: "tls.json",
  displayName: "📚 TLS",
  feedUrl: "https://www.the-tls.co.uk/feed/",
  articlePathRegex: /(articles|regulars)/,
  siteSuffixRegex: \s*[-–—]\s*the-tls.co.uk\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY,
  source: "tls",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
