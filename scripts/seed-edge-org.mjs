/**
 * seed-edge-org.mjs — Edge.org seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.edge.org",
  cacheFileName: "edge-org.json",
  displayName: "🧠 Edge.org",
  feedUrl: "https://www.edge.org/feed/",
  articlePathRegex: /(conversation|annual-question)/,
  siteSuffixRegex: \s*[-–—]\s*edge.org\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY,
  source: "edge-org",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
