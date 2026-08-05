/**
 * seed-gottman.mjs — The Gottman Institute seeder
 * Research-based relationship advice, marriage and couples psychology.
 * Category: MIND_BODY → RELATIONSHIPS_SOCIAL
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.gottman.com",
  cacheFileName: "gottman.json",
  displayName: "❤️ Gottman Institute",
  feedUrl: "https://www.gottman.com/blog/feed/",
  articlePathRegex: /\/(blog|articles|resource)\/[a-z0-9-]/i,
  siteSuffixRegex: /\s*[-–—]\s*(?:The\s+)?Gottman\s+(Institute|Referral Network)\s*$/i,
  category_id: CATEGORY.MIND_BODY,
  subcategory_id: SUBCATEGORY.RELATIONSHIPS_SOCIAL,
  source: "gottman",
  seeder_score: 0.6,
  maxArticles: 800,
  maxPages: 10,
});