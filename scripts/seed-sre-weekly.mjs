/**
 * seed-sre-weekly.mjs — SRE Weekly seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DEVOPS_INFRASTRUCTURE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "sreweekly.com",
  cacheFileName: "sre-weekly.json",
  displayName: "📰 SRE Weekly",
  feedUrl: "https://sreweekly.com/feed/",
  articlePathRegex: /issue/,
  siteSuffixRegex: \s*[-–—]\s*sreweekly.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  source: "sre-weekly",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
