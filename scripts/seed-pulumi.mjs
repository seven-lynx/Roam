/**
 * seed-pulumi.mjs — Pulumi seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DEVOPS_INFRASTRUCTURE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.pulumi.com",
  cacheFileName: "pulumi.json",
  displayName: "🏗 Pulumi",
  feedUrl: "https://www.pulumi.com/blog/rss.xml",
  articlePathRegex: /blog/,
  siteSuffixRegex: \s*[-–—]\s*pulumi.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  source: "pulumi",
  seeder_score: 0.65,
  maxArticles: 500,
  maxPages: 20,
});
