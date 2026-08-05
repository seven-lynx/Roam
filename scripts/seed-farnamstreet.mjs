/**
 * seed-farnamstreet.mjs — Scott H Young seeder
 * Deep-dive articles on learning, productivity, habits, and deliberate practice.
 * Category: MIND_BODY → PERSONAL_DEVELOPMENT
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.scotthyoung.com",
  cacheFileName: "scotthyoung.json",
  displayName: "🎯 Scott H Young",
  feedUrl: "https://www.scotthyoung.com/blog/feed/",
  articlePathRegex: /\/(blog|articles|programs|podcast)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*[-–—]\s*Scott\s+H\.\s*Young\s*$/i,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.PERSONAL_DEVELOPMENT,
  source: "scotthyoung",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 5,
});