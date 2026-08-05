/**
 * seed-netflix-tech.mjs — Netflix Tech Blog seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DEVOPS_INFRASTRUCTURE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "netflixtechblog.com",
  cacheFileName: "netflix-tech.json",
  displayName: "🎬 Netflix Tech Blog",
  feedUrl: "https://netflixtechblog.com/feed",
  articlePathRegex: /([a-z0-9-]+-){2,}/,
  siteSuffixRegex: \s*[-–—]\s*netflixtechblog.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  source: "netflix-tech",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
