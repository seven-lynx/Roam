/**
 * seed-aws-devops.mjs — AWS DevOps seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DEVOPS_INFRASTRUCTURE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "aws.amazon.com",
  cacheFileName: "aws-devops.json",
  displayName: "☁ AWS DevOps",
  feedUrl: "https://aws.amazon.com/blogs/devops/feed/",
  articlePathRegex: /blogs/devops/,
  siteSuffixRegex: \s*[-–—]\s*aws.amazon.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  source: "aws-devops",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
