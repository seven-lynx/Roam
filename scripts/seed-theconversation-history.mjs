/**
 * seed-theconversation-history.mjs — The Conversation History seeder
 * Category: CATEGORY.HISTORY_IDEAS → SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "theconversation.com",
  cacheFileName: "theconversation-history.json",
  displayName: "💬 The Conversation History",
  feedUrl: "https://theconversation.com/us/history/rss",
  articlePathRegex: /(us|global)/,
  siteSuffixRegex: \s*[-–—]\s*theconversation.com\s*$,
  category_id: CATEGORY.HISTORY_IDEAS,
  subcategory_id: SUBCATEGORY.CULTURAL_INTELLECTUAL_HISTORY,
  source: "theconversation-history",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
