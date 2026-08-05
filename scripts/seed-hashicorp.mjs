/**
 * seed-hashicorp.mjs — HashiCorp seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DEVOPS_INFRASTRUCTURE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "www.hashicorp.com",
  cacheFileName: "hashicorp.json",
  displayName: "🏰 HashiCorp",
  feedUrl: "https://www.hashicorp.com/feed.xml",
  articlePathRegex: /blog/,
  siteSuffixRegex: \s*[-–—]\s*hashicorp.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  source: "hashicorp",
  seeder_score: 0.75,
  maxArticles: 500,
  maxPages: 20,
});
