/**
 * seed-historytoday.mjs — History Today seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.historytoday.com",
  cacheFileName: "historytoday.json",
  displayName: "📰 History Today",
  feedUrl: "https://www.historytoday.com/rss.xml",
  articlePathRegex: /(archive|blog)/,
  siteSuffixRegex: \s*[-–—]\s*historytoday.com\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY,
  source: "historytoday",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
