/**
 * seed-infoq-devops.mjs — InfoQ DevOps seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DEVOPS_INFRASTRUCTURE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.infoq.com",
  cacheFileName: "infoq-devops.json",
  displayName: "📋 InfoQ DevOps",
  feedUrl: "https://feed.infoq.com/devops/",
  articlePathRegex: /(articles|news|presentations)/,
  siteSuffixRegex: \s*[-–—]\s*infoq.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  source: "infoq-devops",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
