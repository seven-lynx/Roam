/**
 * seed-cloudflare-blog.mjs — Cloudflare seeder
 * Category: CATEGORY.TECHNOLOGY → SUBCATEGORY.DEVOPS_INFRASTRUCTURE
 * Access: RSS feed → Sitemap → Wayback
 */
import { seedRssWithFallbacks, CATEGORY, SUBCATEGORY } from "./lib/seed.js";

await seedRssWithFallbacks({
  siteDomain: "blog.cloudflare.com",
  cacheFileName: "cloudflare-blog.json",
  displayName: "☁ Cloudflare",
  feedUrl: "https://blog.cloudflare.com/rss/",
  articlePathRegex: /([a-z0-9-]+-){2,}/,
  siteSuffixRegex: \s*[-–—]\s*blog.cloudflare.com\s*$,
  category_id: CATEGORY.TECHNOLOGY,
  subcategory_id: SUBCATEGORY.DEVOPS_INFRASTRUCTURE,
  source: "cloudflare",
  seeder_score: 0.8,
  maxArticles: 500,
  maxPages: 20,
});
