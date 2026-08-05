/**
 * seed-lrb.mjs — London Review of Books seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.lrb.co.uk",
  cacheFileName: "lrb.json",
  displayName: "📖 London Review of Books",
  feedUrl: "https://www.lrb.co.uk/feeds/rss",
  articlePathRegex: /(the-paper|blog|podcasts)/,
  siteSuffixRegex: \s*[-–—]\s*lrb.co.uk\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY,
  source: "lrb",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
