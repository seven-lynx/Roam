/**
 * seed-atlassian-eng.mjs — Atlassian Engineering seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DEVOPS_INFRASTRUCTURE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.atlassian.com",
  cacheFileName: "atlassian-eng.json",
  displayName: "🛠 Atlassian Engineering",
  feedUrl: "https://www.atlassian.com/engineering/feed",
  articlePathRegex: /engineering/,
  siteSuffixRegex: \s*[-–—]\s*atlassian.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  source: "atlassian-eng",
  seeder_score: 0.7,
  maxArticles: 500,
  maxPages: 20,
});
